import { randomUUID } from "node:crypto";

import { del, list, put, type ListBlobResultBlob } from "@vercel/blob";

import { parseSgaScheduleSnapshot } from "@/lib/sgaScheduleUtils";
import type { SgaScheduleSnapshot } from "@/types/sgaSchedule";

const SNAPSHOT_PREFIX = "sga/horarios-";
const MAX_SNAPSHOTS = 8;
const READ_TIMEOUT_MS = 5_000;
const WRITE_TIMEOUT_MS = 8_000;
const CLEANUP_TIMEOUT_MS = 3_000;

function newestFirst<T extends { uploadedAt: Date }>(left: T, right: T): number {
  return right.uploadedAt.getTime() - left.uploadedAt.getTime();
}

async function listSnapshots(abortSignal: AbortSignal): Promise<ListBlobResultBlob[]> {
  const snapshots: ListBlobResultBlob[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    abortSignal.throwIfAborted();
    const page = await list({ prefix: SNAPSHOT_PREFIX, limit: 1000, cursor, abortSignal });
    snapshots.push(...page.blobs);
    if (!page.hasMore) return snapshots;
    if (!page.cursor || seenCursors.has(page.cursor)) throw new Error("Invalid Blob pagination cursor");
    seenCursors.add(page.cursor);
    cursor = page.cursor;
  }
}

export async function getLatestSgaScheduleSnapshot(): Promise<SgaScheduleSnapshot | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return null;

  try {
    // One deadline covers all listing pages and downloads, rather than restarting per request.
    const signal = AbortSignal.timeout(READ_TIMEOUT_MS);
    const snapshots = (await listSnapshots(signal)).sort(newestFirst).slice(0, MAX_SNAPSHOTS);
    for (const snapshot of snapshots) {
      const response = await fetch(snapshot.url, { cache: "no-store", signal });
      if (!response.ok) continue;
      const parsed = parseSgaScheduleSnapshot(await response.text());
      if (parsed) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function publishSgaScheduleSnapshot(snapshot: SgaScheduleSnapshot): Promise<void> {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  await put(`${SNAPSHOT_PREFIX}${timestamp}-${randomUUID()}.json`, JSON.stringify(snapshot), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    abortSignal: AbortSignal.timeout(WRITE_TIMEOUT_MS),
  });

  // Publication already succeeded. Retention maintenance must not report a failed upload.
  try {
    const abortSignal = AbortSignal.timeout(CLEANUP_TIMEOUT_MS);
    const blobs = await listSnapshots(abortSignal);
    const obsolete = blobs.sort(newestFirst).slice(MAX_SNAPSHOTS);
    if (obsolete.length > 0) await del(obsolete.map((blob) => blob.url), { abortSignal });
  } catch {
    console.warn("SGA snapshot published; cleanup of previous snapshots will be retried on the next publication.");
  }
}
