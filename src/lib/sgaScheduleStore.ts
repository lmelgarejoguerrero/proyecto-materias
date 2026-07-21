import { del, list, put } from "@vercel/blob";

import { parseSgaScheduleSnapshot } from "@/lib/sgaScheduleUtils";
import type { SgaScheduleSnapshot } from "@/types/sgaSchedule";

const SNAPSHOT_PREFIX = "sga/horarios-";
const MAX_SNAPSHOTS = 8;

function newestFirst<T extends { uploadedAt: Date }>(left: T, right: T): number {
  return right.uploadedAt.getTime() - left.uploadedAt.getTime();
}

export async function getLatestSgaScheduleSnapshot(): Promise<SgaScheduleSnapshot | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return null;

  try {
    const { blobs } = await list({ prefix: SNAPSHOT_PREFIX, limit: MAX_SNAPSHOTS });
    const latest = blobs.sort(newestFirst)[0];
    if (!latest) return null;

    const response = await fetch(latest.url, { cache: "no-store" });
    if (!response.ok) return null;
    return parseSgaScheduleSnapshot(await response.text());
  } catch {
    return null;
  }
}

export async function publishSgaScheduleSnapshot(snapshot: SgaScheduleSnapshot): Promise<void> {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  await put(`${SNAPSHOT_PREFIX}${timestamp}.json`, JSON.stringify(snapshot), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });

  const { blobs } = await list({ prefix: SNAPSHOT_PREFIX, limit: 100 });
  const obsolete = blobs.sort(newestFirst).slice(MAX_SNAPSHOTS);
  if (obsolete.length > 0) await del(obsolete.map((blob) => blob.url));
}
