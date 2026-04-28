import { NextRequest } from "next/server";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import ImageModule from "docxtemplater-image-module-free";
import { parseBearer, verifyToken } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { readObject } from "@/lib/storage";

type Img =
  | string
  | {
      url?: string;
      bucket?: string;
      path?: string;
      width?: number;
      height?: number;
    };

type Payload = {
  template: { bucket: string; path: string };
  fileName?: string;
  data: any;
};

function u8ToBase64(u8: Uint8Array) {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return Buffer.from(binary, "binary").toString("base64");
}

function normalizeImg(v: any): Img | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v;
  return null;
}

async function getImageBytes(img: Img) {
  if (typeof img === "string") {
    if (!img.startsWith("http")) return new Uint8Array();
    const r = await fetch(img);
    if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }

  if (img.url) {
    const r = await fetch(img.url);
    if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }

  if (img.bucket && img.path) {
    const { bytes } = await readObject(img.bucket, img.path);
    return new Uint8Array(bytes);
  }

  return new Uint8Array();
}

export async function POST(req: NextRequest) {
  try {
    const token = parseBearer(req.headers.get("authorization"));
    if (!token) return fail("Unauthorized", 401);
    await verifyToken(token);

    const payload = (await req.json()) as Payload;
    if (!payload?.template?.bucket || !payload?.template?.path) {
      return fail("Missing template.bucket/template.path", 400);
    }

    const { bytes } = await readObject(payload.template.bucket, payload.template.path);

    const imageModule = new ImageModule({
      async getImage(tagValue: any) {
        const img = normalizeImg(tagValue);
        if (!img) return new Uint8Array();
        return getImageBytes(img);
      },
      getSize(tagValue: any) {
        const img = normalizeImg(tagValue);
        const w = typeof img === "object" && img?.width ? img.width : 520;
        const h = typeof img === "object" && img?.height ? img.height : 320;
        return [w, h];
      },
    });

    const zip = new PizZip(bytes);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [imageModule],
    });

    doc.setData(payload.data || {});
    doc.render();

    const out = doc.getZip().generate({ type: "uint8array" }) as Uint8Array;
    const base64 = u8ToBase64(out);

    return ok({
      data: {
        base64,
        fileName: payload.fileName || "report.docx",
      },
      error: null,
    });
  } catch (e: any) {
    return fail(String(e?.message || "Function crashed"), 500);
  }
}
