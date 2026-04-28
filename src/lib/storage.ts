import {
  GetObjectCommand,
  ListBucketsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

function requireS3Config() {
  if (!env.s3Bucket) throw new Error("AWS_S3_BUCKET is not configured.");
  if (!env.s3Region && !env.s3Endpoint) {
    throw new Error("AWS_REGION (or AWS_S3_ENDPOINT) is not configured.");
  }
}

function makeClient() {
  requireS3Config();

  return new S3Client({
    region: env.s3Region || "us-east-1",
    endpoint: env.s3Endpoint || undefined,
    forcePathStyle: env.s3ForcePathStyle,
    credentials:
      env.s3AccessKeyId && env.s3SecretAccessKey
        ? {
            accessKeyId: env.s3AccessKeyId,
            secretAccessKey: env.s3SecretAccessKey,
            sessionToken: env.s3SessionToken || undefined,
          }
        : undefined,
  });
}

function normalizeKeyPart(v: string) {
  return String(v || "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .trim();
}

function toS3Key(logicalBucket: string, key: string) {
  return `${normalizeKeyPart(logicalBucket)}/${normalizeKeyPart(key)}`;
}

function getPublicUrlForKey(key: string) {
  const encoded = key
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");

  if (env.s3PublicBaseUrl) {
    return `${env.s3PublicBaseUrl.replace(/\/$/, "")}/${encoded}`;
  }

  if (env.s3Endpoint) {
    return `${env.backendPublicBaseUrl.replace(/\/$/, "")}/api/storage/public/${encoded}`;
  }

  return `https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com/${encoded}`;
}

export async function ensureStorageRoot() {
  // S3-backed: no-op for filesystem root creation.
}

export async function putObject(params: {
  bucket: string;
  path: string;
  bytes: Buffer;
  contentType?: string;
  upsert?: boolean;
}) {
  const logicalBucket = normalizeKeyPart(params.bucket);
  const logicalPath = normalizeKeyPart(params.path);
  if (!logicalBucket) throw new Error("bucket is required");
  if (!logicalPath) throw new Error("path is required");

  const key = toS3Key(logicalBucket, logicalPath);
  const client = makeClient();

  await client.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: params.bytes,
      ContentType: params.contentType || "application/octet-stream",
    })
  );

  return {
    bucket: logicalBucket,
    path: logicalPath,
    key,
    publicUrl: getPublicUrlForKey(key),
  };
}

export async function readObject(logicalBucket: string, logicalPath: string) {
  const key = toS3Key(logicalBucket, logicalPath);
  const client = makeClient();

  const out = await client.send(
    new GetObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
    })
  );

  const body = out.Body;
  if (!body) throw new Error("Object not found");
  const bytes = Buffer.from(await body.transformToByteArray());
  return { bytes, key, contentType: out.ContentType || undefined };
}

export async function listBuckets() {
  if (env.logicalStorageBuckets?.length) return env.logicalStorageBuckets;

  const client = makeClient();
  const out = await client.send(new ListBucketsCommand({}));
  return (out.Buckets || [])
    .map((b) => b.Name)
    .filter((n): n is string => Boolean(n));
}

export async function createSignedObjectUrl(params: {
  bucket: string;
  path: string;
  expiresInSec: number;
}) {
  const key = toS3Key(params.bucket, params.path);
  const client = makeClient();
  const command = new GetObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: Math.max(1, params.expiresInSec) });
}
