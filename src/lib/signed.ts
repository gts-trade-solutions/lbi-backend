import crypto from "node:crypto";
import { env } from "./env";

export function signStorageToken(payload: { bucket: string; path: string; exp: number }) {
  const raw = `${payload.bucket}|${payload.path}|${payload.exp}`;
  const sig = crypto
    .createHmac("sha256", env.jwtSecret)
    .update(raw)
    .digest("hex");
  return `${payload.exp}.${sig}`;
}

export function verifyStorageToken(params: {
  bucket: string;
  path: string;
  token: string;
}) {
  const [expRaw, sig] = String(params.token || "").split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !sig) return false;
  if (Date.now() > exp * 1000) return false;

  const expected = signStorageToken({
    bucket: params.bucket,
    path: params.path,
    exp,
  });
  return expected === params.token;
}
