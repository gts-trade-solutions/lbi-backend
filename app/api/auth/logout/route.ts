import { ok } from "@/lib/http";

export async function POST() {
  return ok({ data: { success: true }, error: null });
}
