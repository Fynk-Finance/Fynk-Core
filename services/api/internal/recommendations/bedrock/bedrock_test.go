package bedrock

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/document"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/advisor"
)

type fakeClient struct {
	in  *bedrockruntime.ConverseInput
	out *bedrockruntime.ConverseOutput
}

func (f *fakeClient) Converse(_ context.Context, in *bedrockruntime.ConverseInput, _ ...func(*bedrockruntime.Options)) (*bedrockruntime.ConverseOutput, error) {
	f.in = in
	return f.out, nil
}

func request() advisor.ModelRequest {
	return advisor.ModelRequest{System: "sistema", User: "datos", OutputSchema: advisor.OutputSchema, MaxTokens: 800, Temperature: 0.2}
}

func TestInputUsesTheSettingsOfM11(t *testing.T) {
	in, err := New(nil, "amazon.nova-lite-v1:0").Input(request())
	if err != nil {
		t.Fatal(err)
	}
	if aws.ToString(in.ModelId) != "amazon.nova-lite-v1:0" {
		t.Fatalf("model id %q", aws.ToString(in.ModelId))
	}
	if aws.ToInt32(in.InferenceConfig.MaxTokens) != 800 || aws.ToFloat32(in.InferenceConfig.Temperature) != 0.2 {
		t.Fatal("max tokens 800 and temperature 0.2 expected")
	}
	if len(in.System) != 2 {
		t.Fatal("system prompt plus a cache point expected")
	}
	if _, ok := in.System[1].(*types.SystemContentBlockMemberCachePoint); !ok {
		t.Fatal("the system prompt must be followed by a cache point (prompt caching)")
	}
	choice, ok := in.ToolConfig.ToolChoice.(*types.ToolChoiceMemberTool)
	if !ok || aws.ToString(choice.Value.Name) != ToolName {
		t.Fatal("the answer must be forced through the write_recommendations tool")
	}
	if len(in.Messages) != 1 || in.Messages[0].Role != types.ConversationRoleUser {
		t.Fatal("one user message: a single, one shot call")
	}
}

func TestGenerateReturnsTheToolInputAndTokenCounts(t *testing.T) {
	answer := map[string]any{"summary": "Vas bien.", "steps": []any{}}
	client := &fakeClient{out: &bedrockruntime.ConverseOutput{
		Output: &types.ConverseOutputMemberMessage{Value: types.Message{
			Role: types.ConversationRoleAssistant,
			Content: []types.ContentBlock{&types.ContentBlockMemberToolUse{Value: types.ToolUseBlock{
				Name: aws.String(ToolName), ToolUseId: aws.String("t1"), Input: document.NewLazyDocument(answer),
			}}},
		}},
		Usage: &types.TokenUsage{InputTokens: aws.Int32(950), OutputTokens: aws.Int32(310), TotalTokens: aws.Int32(1260)},
	}}
	resp, err := New(client, "amazon.nova-lite-v1:0").Generate(context.Background(), request())
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal([]byte(resp.Text), &got); err != nil || got["summary"] != "Vas bien." {
		t.Fatalf("tool input not returned as JSON: %q", resp.Text)
	}
	if resp.InputTokens != 950 || resp.OutputTokens != 310 || resp.ModelID != "amazon.nova-lite-v1:0" {
		t.Fatalf("counts: %+v", resp)
	}
}

func TestGenerateFallsBackToText(t *testing.T) {
	client := &fakeClient{out: &bedrockruntime.ConverseOutput{
		Output: &types.ConverseOutputMemberMessage{Value: types.Message{
			Content: []types.ContentBlock{&types.ContentBlockMemberText{Value: `{"summary":"Hola","steps":[]}`}},
		}},
	}}
	resp, err := New(client, "m").Generate(context.Background(), request())
	if err != nil || !strings.Contains(resp.Text, "Hola") {
		t.Fatalf("text answer: %q %v", resp.Text, err)
	}
}
