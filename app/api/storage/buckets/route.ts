import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { parseBearer, verifyToken } from "@/lib/auth";
import { listBuckets } from "@/lib/storage";

export async function GET(req: NextRequest) {
  try {
    const token = parseBearer(req.headers.get("authorization"));
    if (!token) return fail("Unauthorized", 401);
    await verifyToken(token);

    const buckets = await listBuckets();
    return ok({ data: buckets.map((name) => ({ name })), error: null });
  } catch (e: any) {
    return fail(String(e?.message || "Failed to list buckets"), 400);
  }
}
