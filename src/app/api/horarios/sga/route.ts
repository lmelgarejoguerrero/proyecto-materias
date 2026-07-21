import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { parseSgaScheduleSnapshot } from "@/lib/sgaScheduleUtils";
import { publishSgaScheduleSnapshot } from "@/lib/sgaScheduleStore";

const MAX_BODY_BYTES = 1_000_000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.SGA_IMPORT_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      { error: "Clave de actualización inválida." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "El snapshot supera el tamaño permitido." },
      { status: 413, headers: CORS_HEADERS },
    );
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "El snapshot supera el tamaño permitido." },
      { status: 413, headers: CORS_HEADERS },
    );
  }

  const snapshot = parseSgaScheduleSnapshot(raw);
  if (!snapshot || snapshot.courses.length === 0 || snapshot.courses.length > 500) {
    return NextResponse.json(
      { error: "El snapshot del SGA no tiene un formato válido." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    await publishSgaScheduleSnapshot(snapshot);
    return NextResponse.json(
      { ok: true, courses: snapshot.courses.length, capturedAt: snapshot.capturedAt },
      { headers: CORS_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: "No se pudieron guardar los horarios en Vercel." },
      { status: 503, headers: CORS_HEADERS },
    );
  }
}
