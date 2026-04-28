import path from "node:path";

function parseBool(v: string | undefined, fallback = false) {
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export const env = {
  mysqlHost: process.env.MYSQL_HOST || "127.0.0.1",
  mysqlPort: Number(process.env.MYSQL_PORT || 3306),
  mysqlUser: process.env.MYSQL_USER || "root",
  mysqlPassword: process.env.MYSQL_PASSWORD || "",
  mysqlDatabase: process.env.MYSQL_DATABASE || "tracker",
  jwtSecret: process.env.AUTH_JWT_SECRET || "change-me-in-production",
  jwtExpiresInSec: Number(process.env.AUTH_JWT_EXPIRES_SEC || 60 * 60 * 24 * 7),
  backendPublicBaseUrl:
    process.env.BACKEND_PUBLIC_BASE_URL || "http://localhost:3000",
  s3Region: process.env.AWS_REGION || "",
  s3Bucket: process.env.AWS_S3_BUCKET || "",
  s3AccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  s3SecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  s3SessionToken: process.env.AWS_SESSION_TOKEN || "",
  s3Endpoint: process.env.AWS_S3_ENDPOINT || "",
  s3ForcePathStyle: parseBool(process.env.AWS_S3_FORCE_PATH_STYLE, false),
  s3PublicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL || "",
  logicalStorageBuckets: (process.env.STORAGE_BUCKETS || "reports,templates")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
