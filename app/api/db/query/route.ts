import { NextRequest } from "next/server";
import { parseBearer, verifyToken } from "@/lib/auth";
import { executeQuery } from "@/lib/query";
import { fail, ok } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    const token = parseBearer(req.headers.get("authorization"));
    if (!token) return fail("Unauthorized", 401);

    const user = await verifyToken(token);
    const body = await req.json();
    const valuesCount = Array.isArray(body?.values)
      ? body.values.length
      : body?.values
      ? 1
      : 0;
    console.log(
      `[api/db/query] hit table=${String(body?.table || "")} op=${String(
        body?.op || ""
      )} single=${String(body?.single || "none")} valuesCount=${valuesCount} user=${user.id}`
    );

    const data = await executeQuery(body, user.id);
    if (Array.isArray(data)) {
      console.log(`[api/db/query] response rows=${data.length}`);
    } else if (data == null) {
      console.log("[api/db/query] response rows=0");
    } else {
      console.log("[api/db/query] response rows=1");
    }
    return ok({ data, error: null });
  } catch (e: any) {
    return fail(String(e?.message || "Query failed"), 400);
  }
}
