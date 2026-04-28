import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { parseBearer, verifyToken } from "@/lib/auth";
import { ensureStorageRoot, putObject } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const token = parseBearer(req.headers.get("authorization"));
    if (!token) return fail("Unauthorized", 401);
    await verifyToken(token);

    const body = await req.json();
    const bucket = String(body?.bucket || "").trim();
    const path = String(body?.path || "").trim();
    const base64 = String(body?.base64 || "");
    const contentType = String(body?.contentType || "").trim() || undefined;
    const upsert = Boolean(body?.upsert);

    if (!bucket || !path || !base64) {
      return fail("bucket, path and base64 are required", 400);
    }

    await ensureStorageRoot();
    const bytes = Buffer.from(base64, "base64");
    const data = await putObject({ bucket, path, bytes, contentType, upsert });

    return ok({ data, error: null });
  } catch (e: any) {
    return fail(String(e?.message || "Upload failed"), 400);
  }
}
