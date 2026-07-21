import { NextResponse } from "next/server";

import sgaSnapshotData from "@/data/sgaHorarios.json";
import { mergeSgaScheduleSnapshot } from "@/lib/sgaScheduleUtils";
import type { CeitbaSubjectsResponse } from "@/types/schedule";
import type { SgaScheduleSnapshot } from "@/types/sgaSchedule";

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
      const imported = mergeSgaScheduleSnapshot(
        {},
        sgaSnapshotData as unknown as SgaScheduleSnapshot,
      );
      if (Object.keys(imported).length > 0) return NextResponse.json(imported);
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

    const merged = mergeSgaScheduleSnapshot(
      data as CeitbaSubjectsResponse,
      sgaSnapshotData as unknown as SgaScheduleSnapshot,
    );

    return NextResponse.json(merged, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    const imported = mergeSgaScheduleSnapshot(
      {},
      sgaSnapshotData as unknown as SgaScheduleSnapshot,
    );
    if (Object.keys(imported).length > 0) return NextResponse.json(imported);
    return NextResponse.json(
      { error: "No se pudieron actualizar los horarios del CEITBA." },
      { status: 502 },
    );
  }
}
