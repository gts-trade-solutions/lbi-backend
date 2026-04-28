// Lightweight health/reachability endpoint used by the mobile app to detect
// real internet (vs. NetInfo-only "connected"). Intentionally has no DB calls,
// no auth, and no business logic so it stays fast on weak networks.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { ok: true, timestamp: new Date().toISOString() },
    {
      status: 200,
      headers: {
        // Prevent any intermediate cache from masking real reachability.
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
