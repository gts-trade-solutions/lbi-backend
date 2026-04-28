import { NextRequest, NextResponse } from "next/server";
import mime from "mime-types";
import { readObject } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ bucket: string; path: string[] }> }
) {
  try {
    const params = await ctx.params;
    const bucket = decodeURIComponent(params.bucket);
    const key = (params.path || []).map((s) => decodeURIComponent(s)).join("/");
    const { bytes, contentType: ct } = await readObject(bucket, key);
    const contentType = ct || mime.lookup(key) || "application/octet-stream";

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": String(contentType),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: { message: String(e?.message || "Not found") } },
      { status: 404 }
    );
  }
}
