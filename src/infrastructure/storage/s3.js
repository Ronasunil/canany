// S3 adapter for #ask attachments. One client; two operations:
//  - putAttachment: stream a file's bytes into the private bucket (ingest)
//  - signedUrl:     mint a short-lived GET URL the browser loads directly (serve)
// Credentials come from the AWS SDK's default provider chain (see src/config).
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../../config');

const client = new S3Client({ region: config.storage.awsRegion });

// Key layout: attachments/<orgId>/<askId>/<index>-<fileUniqueId>. The <index>-
// prefix (0-based position of the file within its message/album) makes the key
// collision-safe: fileUniqueId is stable per file in Telegram, so the same image
// attached twice to one ask would otherwise compute the same key and overwrite.
function keyFor({ orgId, askId, index, fileUniqueId }) {
  return `attachments/${orgId}/${askId}/${index}-${fileUniqueId}`;
}

// Upload via lib-storage's Upload, which streams a body of unknown length cleanly.
// Returns the stored object key.
async function putAttachment({ orgId, askId, index, fileUniqueId, body, contentType }) {
  const Key = keyFor({ orgId, askId, index, fileUniqueId });
  await new Upload({
    client,
    params: {
      Bucket: config.storage.s3Bucket,
      Key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
      CacheControl: 'private, max-age=31536000, immutable',
    },
  }).done();
  return Key;
}

// A presigned GET URL (default 1h). Pure local HMAC signing — no network call.
function signedUrl(key, { expiresIn = 3600 } = {}) {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.storage.s3Bucket, Key: key }),
    { expiresIn },
  );
}

module.exports = { putAttachment, signedUrl, keyFor };
