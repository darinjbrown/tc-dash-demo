import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 wiring for per-tenant logo uploads (decision #2). R2 is
 * S3-compatible, so we use the AWS SDK pointed at the R2 endpoint.
 *
 * DEGRADES GRACEFULLY: if any required env var is missing, isR2Configured() is
 * false, the upload control is hidden in the UI, and a logo URL can still be set
 * manually. The app builds and runs with no R2 configured.
 */
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;
const PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

export function isR2Configured(): boolean {
  return Boolean(
    ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_BASE_URL,
  );
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY_ID as string,
        secretAccessKey: SECRET_ACCESS_KEY as string,
      },
    });
  }
  return client;
}

/**
 * Upload a logo to R2 and return its public URL. Throws if R2 is not configured
 * (callers must check isR2Configured() first and disable the control otherwise).
 */
export async function uploadLogoToR2(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error('R2 is not configured.');
  }
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET as string,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  // Stored URL = public base + '/' + object key.
  return `${(PUBLIC_BASE_URL as string).replace(/\/$/, '')}/${key}`;
}
