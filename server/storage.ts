/**
 * S3 file storage helpers
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION || 'eu-west-1',
  credentials: {
    accessKeyId:     process.env.AWS_S3_ACCESS_KEY || '',
    secretAccessKey: process.env.AWS_S3_SECRET_KEY || '',
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'laro-evidence';

export async function storagePut(key: string, body: Buffer, contentType = 'application/octet-stream'): Promise<string> {
  if (!process.env.AWS_S3_BUCKET) {
    console.warn('[Storage] S3 not configured — file not uploaded:', key);
    return `/local/${key}`;
  }
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return `https://${BUCKET}.s3.amazonaws.com/${key}`;
}

export async function storageGet(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: 3600 });
}

export async function storageDelete(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
