import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { parseBearer, verifyToken } from "@/lib/auth";
import { createSignedObjectUrl } from "@/lib/storage";

export async function GET(req: NextRequest) {
  try {
    const token = parseBearer(req.headers.get("authorization"));
    if (!token) return fail("Unauthorized", 401);
    await verifyToken(token);

    const { searchParams } = new URL(req.url);
    const bucket = String(searchParams.get("bucket") || "").trim();
    const path = String(searchParams.get("path") || "").trim();
    const expiresIn = Number(searchParams.get("expiresIn") || 60);

    if (!bucket || !path) return fail("bucket and path are required", 400);
    const signedUrl = await createSignedObjectUrl({
      bucket,
      path,
      expiresInSec: expiresIn,
    });

    return ok({ data: { signedUrl }, error: null });
  } catch (e: any) {
    return fail(String(e?.message || "Failed to create signed URL"), 400);
  }
}
