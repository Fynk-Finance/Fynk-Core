package keys

import (
	"context"
	"errors"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/kms/types"
)

// AWSKMS is the KMS of the bank keys over the AWS SDK. Credentials come from the ECS task role.
type AWSKMS struct {
	client *kms.Client
}

var _ KMS = AWSKMS{}

// NewAWSKMS wraps an SDK client (kms.NewFromConfig).
func NewAWSKMS(c *kms.Client) AWSKMS { return AWSKMS{client: c} }

// SignDigest implements KMS: Sign with MessageType DIGEST and RSASSA_PSS_SHA_256.
func (k AWSKMS) SignDigest(ctx context.Context, keyID string, digest []byte) ([]byte, error) {
	out, err := k.client.Sign(ctx, &kms.SignInput{
		KeyId:            aws.String(keyID),
		Message:          digest,
		MessageType:      types.MessageTypeDigest,
		SigningAlgorithm: types.SigningAlgorithmSpecRsassaPssSha256,
	})
	if err != nil {
		return nil, err
	}
	if len(out.Signature) == 0 {
		return nil, errors.New("keys: KMS returned no signature")
	}
	return out.Signature, nil
}

// GenerateMac implements KMS: GenerateMac with HMAC_SHA_256.
func (k AWSKMS) GenerateMac(ctx context.Context, keyID string, message []byte) ([]byte, error) {
	out, err := k.client.GenerateMac(ctx, &kms.GenerateMacInput{
		KeyId:        aws.String(keyID),
		Message:      message,
		MacAlgorithm: types.MacAlgorithmSpecHmacSha256,
	})
	if err != nil {
		return nil, err
	}
	if len(out.Mac) == 0 {
		return nil, errors.New("keys: KMS returned no mac")
	}
	return out.Mac, nil
}
