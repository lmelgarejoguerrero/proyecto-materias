import { NextResponse } from "next/server";

const CEITBA_SCHEDULE_URL = "https://ceitba.org.ar/api/v1/subjects?plan=L20";

export const revalidate = 3600;

export async function GET() {
  try {
    const response = await fetch(CEITBA_SCHEDULE_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "El CEITBA no pudo responder la consulta de horarios." },
        { status: 502 },
      );
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json(
        { error: "El CEITBA devolvió un formato de horarios inesperado." },
        { status: 502 },
      );
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron actualizar los horarios del CEITBA." },
      { status: 502 },
    );
  }
}
