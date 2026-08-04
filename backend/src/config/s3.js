// S3 client. Credentials come ONLY from environment variables - on EC2 the
// better practice is an IAM instance role (no keys on disk at all), which the
// SDK picks up automatically if the env keys are absent.
const { S3Client } = require('@aws-sdk/client-s3');
const config = require('./env');

const isConfigured = Boolean(config.aws.region && config.aws.bucket);

const s3 = isConfigured
  ? new S3Client({
      region: config.aws.region,
      // If accessKeyId/secret are unset, the SDK falls back to the default
      // credential chain (IAM role on EC2, ~/.aws/credentials locally).
      ...(config.aws.accessKeyId && {
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        },
      }),
    })
  : null;

module.exports = { s3, isConfigured };
