import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { parseBearer, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const token = parseBearer(req.headers.get("authorization"));
    if (!token) {
      return ok({ data: { session: null }, error: null });
    }

    const user = await verifyToken(token);
    return ok({
      data: {
        session: {
          access_token: token,
          token_type: "bearer",
          user,
        },
      },
      error: null,
    });
  } catch {
    return ok({ data: { session: null }, error: null });
  }
}
