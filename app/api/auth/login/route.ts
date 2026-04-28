import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { signInWithEmailPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");

    if (!email || !password) {
      return fail("Email and password are required", 400);
    }

    const data = await signInWithEmailPassword(email, password);
    return ok({ data, error: null });
  } catch (e: any) {
    const message = String(e?.message || "Login failed");
    const status = /invalid login credentials/i.test(message) ? 401 : 400;
    return fail(message, status);
  }
}
