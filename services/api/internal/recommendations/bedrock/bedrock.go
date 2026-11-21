// Package bedrock is the advisor.Model adapter on AWS Bedrock (Converse API). The system prompt
// carries a cache point, so the long, stable prompt is cached by Bedrock between calls, and the
// answer is forced through one tool whose input schema is advisor.OutputSchema.
package bedrock

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/document"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/advisor"
)

// ToolName is the only tool the model may call: its input is the answer.
const ToolName = "write_recommendations"

// Converser is the part of the Bedrock runtime client the adapter uses (a fake in tests).
type Converser interface {
	Converse(ctx context.Context, in *bedrockruntime.ConverseInput, opts ...func(*bedrockruntime.Options)) (*bedrockruntime.ConverseOutput, error)
}

// Model calls one Bedrock model.
type Model struct {
	client  Converser
	modelID string
}

// New returns the adapter for modelID, for example amazon.nova-lite-v1:0.
func New(client Converser, modelID string) *Model {
	return &Model{client: client, modelID: modelID}
}

// Input builds the Converse request. Exported for tests.
func (m *Model) Input(req advisor.ModelRequest) (*bedrockruntime.ConverseInput, error) {
	var schema any
	if err := json.Unmarshal(req.OutputSchema, &schema); err != nil {
		return nil, fmt.Errorf("output schema: %w", err)
	}
	return &bedrockruntime.ConverseInput{
		ModelId: aws.String(m.modelID),
		System: []types.SystemContentBlock{
			&types.SystemContentBlockMemberText{Value: req.System},
			&types.SystemContentBlockMemberCachePoint{Value: types.CachePointBlock{Type: types.CachePointTypeDefault}},
		},
		Messages: []types.Message{{
			Role:    types.ConversationRoleUser,
			Content: []types.ContentBlock{&types.ContentBlockMemberText{Value: req.User}},
		}},
		InferenceConfig: &types.InferenceConfiguration{
			MaxTokens:   aws.Int32(req.MaxTokens),
			Temperature: aws.Float32(req.Temperature),
		},
		ToolConfig: &types.ToolConfiguration{
			Tools: []types.Tool{&types.ToolMemberToolSpec{Value: types.ToolSpecification{
				Name:        aws.String(ToolName),
				Description: aws.String("Devuelve el resumen y los pasos en el formato exigido."),
				InputSchema: &types.ToolInputSchemaMemberJson{Value: document.NewLazyDocument(schema)},
			}}},
			ToolChoice: &types.ToolChoiceMemberTool{Value: types.SpecificToolChoice{Name: aws.String(ToolName)}},
		},
	}, nil
}

// Generate makes one Converse call and returns the tool input as JSON text (or the plain text
// when a model answers without the tool).
func (m *Model) Generate(ctx context.Context, req advisor.ModelRequest) (advisor.ModelResponse, error) {
	in, err := m.Input(req)
	if err != nil {
		return advisor.ModelResponse{}, err
	}
	out, err := m.client.Converse(ctx, in)
	if err != nil {
		return advisor.ModelResponse{ModelID: m.modelID}, fmt.Errorf("bedrock converse: %w", err)
	}
	resp := advisor.ModelResponse{ModelID: m.modelID}
	if out.Usage != nil {
		resp.InputTokens = int(aws.ToInt32(out.Usage.InputTokens))
		resp.OutputTokens = int(aws.ToInt32(out.Usage.OutputTokens))
	}
	msg, ok := out.Output.(*types.ConverseOutputMemberMessage)
	if !ok {
		return resp, errors.New("bedrock: no message in the answer")
	}
	for _, block := range msg.Value.Content {
		switch b := block.(type) {
		case *types.ContentBlockMemberToolUse:
			if b.Value.Input == nil {
				continue
			}
			raw, err := b.Value.Input.MarshalSmithyDocument()
			if err != nil {
				return resp, fmt.Errorf("bedrock tool input: %w", err)
			}
			resp.Text = string(raw)
			return resp, nil
		case *types.ContentBlockMemberText:
			resp.Text += b.Value
		}
	}
	if resp.Text == "" {
		return resp, errors.New("bedrock: empty answer")
	}
	return resp, nil
}
