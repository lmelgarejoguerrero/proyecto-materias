import assert from "node:assert/strict";
import test from "node:test";
import { createServerLoader } from "./load-server-typescript.mjs";

const SNAPSHOT = {
  schemaVersion: 1,
  source: "sga-itba",
  academicPeriod: { year: 2026, period: 2, label: "2026 · 2°" },
  capturedAt: "2026-09-03T12:00:00.000Z",
  courses: [{
    courseId: "71.20", courseName: "Informática", credits: 3, availability: "available",
    commissions: [{ name: "A", applicants: 10, availableSeats: 20, meetings: [{
      day: "MONDAY", time_from: "09:00", time_to: "11:00", classroom: "101", building: "Distrito",
    }] }],
  }],
};
const unavailable = async () => { throw new Error("Unexpected external service call"); };
const blob = (id, date) => ({ url: `https://example.test/${id}.json`, pathname: `sga/horarios-${id}.json`, uploadedAt: new Date(date) });

function loadStore({ list = unavailable, put = unavailable, del = unavailable, fetch = unavailable, ...globals } = {}) {
  return createServerLoader({ "@vercel/blob": { list, put, del } }, {
    process: { env: { BLOB_READ_WRITE_TOKEN: "test-only-token" } },
    console: { warn() {} },
    fetch,
    ...globals,
  })("src/lib/sgaScheduleStore.ts");
}

test("the newest snapshot is selected across every Blob listing page", async () => {
  const oldest = blob("old", "2026-01-01");
  const latest = blob("latest", "2026-09-03");
  const calls = [];
  const store = loadStore({
    list: async (options) => {
      calls.push(options);
      return options.cursor ? { blobs: [latest], hasMore: false } : { blobs: [oldest], hasMore: true, cursor: "page-2" };
    },
    fetch: async (url, options) => {
      assert.equal(url, latest.url);
      assert.equal(options.signal, calls[0].abortSignal);
      assert.equal(options.cache, "no-store");
      return new Response(JSON.stringify(SNAPSHOT));
    },
  });
  assert.deepEqual(await store.getLatestSgaScheduleSnapshot(), SNAPSHOT);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].cursor, "page-2");
  assert.equal(calls[1].abortSignal, calls[0].abortSignal);
});

test("an unreadable newest snapshot falls back to a retained valid publication", async () => {
  const urls = [];
  const store = loadStore({
    list: async () => ({ blobs: [blob("old", "2026-01-01"), blob("latest", "2026-09-03")], hasMore: false }),
    fetch: async (url) => {
      urls.push(url);
      return new Response(url.includes("latest") ? "null" : JSON.stringify(SNAPSHOT));
    },
  });
  assert.deepEqual(await store.getLatestSgaScheduleSnapshot(), SNAPSHOT);
  assert.deepEqual(urls, ["https://example.test/latest.json", "https://example.test/old.json"]);
});

test("the Blob read deadline aborts a stalled download and allows the route fallback", async () => {
  const controller = new AbortController();
  const deadlines = [];
  const store = loadStore({
    AbortSignal: { timeout: (duration) => { deadlines.push(duration); return controller.signal; } },
    list: async () => ({ blobs: [blob("latest", "2026-09-03")], hasMore: false }),
    fetch: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      queueMicrotask(() => controller.abort(new Error("deadline exceeded")));
    }),
  });
  assert.equal(await store.getLatestSgaScheduleSnapshot(), null);
  assert.deepEqual(deadlines, [5_000]);
});

test("malformed pagination stops instead of looping forever", async () => {
  let calls = 0;
  const store = loadStore({ list: async () => {
    calls += 1;
    return { blobs: [], hasMore: true, cursor: "same-cursor" };
  } });
  assert.equal(await store.getLatestSgaScheduleSnapshot(), null);
  assert.equal(calls, 2);
});

test("successful publication stays successful when retention listing or deletion fails", async () => {
  for (const failingStep of ["list", "del"]) {
    let uploads = 0;
    const store = loadStore({
      put: async (_path, _body, options) => { uploads += 1; assert.ok(options.abortSignal); },
      list: async () => {
        if (failingStep === "list") throw new Error("Blob listing unavailable");
        return { blobs: Array.from({ length: 9 }, (_, index) => blob(String(index), `2026-09-${String(index + 1).padStart(2, "0")}`)), hasMore: false };
      },
      del: async () => { throw new Error("Blob deletion unavailable"); },
    });
    await assert.doesNotReject(() => store.publishSgaScheduleSnapshot(SNAPSHOT));
    assert.equal(uploads, 1);
  }
});

test("retention keeps the eight newest snapshots after collecting all pages", async () => {
  const old = Array.from({ length: 4 }, (_, index) => blob(`old-${index}`, `2026-01-0${index + 1}`));
  const recent = Array.from({ length: 8 }, (_, index) => blob(`recent-${index}`, `2026-09-0${index + 1}`));
  let deleted = [];
  let cleanupSignal;
  const store = loadStore({
    put: async () => {},
    list: async (options) => {
      cleanupSignal = options.abortSignal;
      return options.cursor ? { blobs: recent, hasMore: false } : { blobs: old, hasMore: true, cursor: "next" };
    },
    del: async (urls, options) => { deleted = urls; assert.equal(options.abortSignal, cleanupSignal); },
  });
  await store.publishSgaScheduleSnapshot(SNAPSHOT);
  assert.deepEqual(new Set(deleted), new Set(old.map((item) => item.url)));
});

test("publications in the same millisecond get distinct Blob paths", async () => {
  class FixedDate extends Date { constructor() { super("2026-09-03T12:00:00.000Z"); } }
  const paths = [];
  const store = loadStore({
    Date: FixedDate,
    put: async (path) => { paths.push(path); },
    list: async () => ({ blobs: [], hasMore: false }),
  });
  await store.publishSgaScheduleSnapshot(SNAPSHOT);
  await store.publishSgaScheduleSnapshot(SNAPSHOT);
  assert.equal(paths.length, 2);
  assert.notEqual(paths[0], paths[1]);
  assert.ok(paths.every((path) => path.startsWith("sga/horarios-2026-09-03T12-00-00-000Z-") && path.endsWith(".json")));
});

test("failed uploads propagate without running retention cleanup", async () => {
  let listed = false;
  const store = loadStore({
    put: async () => { throw new Error("Upload failed"); },
    list: async () => { listed = true; return { blobs: [], hasMore: false }; },
  });
  await assert.rejects(() => store.publishSgaScheduleSnapshot(SNAPSHOT), /Upload failed/);
  assert.equal(listed, false);
});

function loadGet(fetch, snapshot = SNAPSHOT, published = null) {
  return createServerLoader({
    "@/data/sgaHorarios.json": snapshot,
    "@/lib/sgaScheduleStore": { getLatestSgaScheduleSnapshot: async () => published },
  }, { fetch })("src/app/api/horarios/route.ts").GET;
}

test("every upstream failure still serves the bundled SGA schedule", async () => {
  const failures = [
    async () => new Response("[]"),
    async () => new Response("null"),
    async () => new Response("not json"),
    async () => new Response("{}", { status: 503 }),
    async () => { throw new Error("Network unavailable"); },
  ];
  for (const fetch of failures) {
    const response = await loadGet(fetch)();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const data = await response.json();
    assert.equal(data["SGA importado"]["2026"]["2"][0].subject_id, "71.20");
  }
});

test("upstream failures use a published snapshot even without bundled courses", async () => {
  const response = await loadGet(async () => new Response("[]"), { ...SNAPSHOT, courses: [] }, SNAPSHOT)();
  assert.equal(response.status, 200);
  assert.equal((await response.json())["SGA importado"]["2026"]["2"][0].subject_id, "71.20");
});

test("when all schedule sources are absent the route returns a controlled 502", async () => {
  const response = await loadGet(async () => new Response("null"), { ...SNAPSHOT, courses: [] })();
  assert.equal(response.status, 502);
  assert.equal(typeof (await response.json()).error, "string");
});

function loadPost(publish = unavailable) {
  return createServerLoader({
    "@/lib/sgaScheduleStore": { publishSgaScheduleSnapshot: publish },
  }, { process: { env: { SGA_IMPORT_TOKEN: "test-import-token" } } })("src/app/api/horarios/sga/route.ts").POST;
}

function requestWithBody(body, headers = {}) {
  return new Request("https://example.test/api/horarios/sga", {
    method: "POST", body, duplex: "half",
    headers: { Authorization: "Bearer test-import-token", ...headers },
  });
}

test("the import rejects oversized chunked bodies before reading the whole stream", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600_000));
      controller.enqueue(new Uint8Array(600_000));
    },
    cancel() { cancelled = true; },
  });
  const response = await loadPost()(requestWithBody(body));
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("a body read failure returns JSON with CORS instead of an unhandled exception", async () => {
  const body = new ReadableStream({ start(controller) { controller.error(new Error("Disconnected client")); } });
  const response = await loadPost()(requestWithBody(body));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(typeof (await response.json()).error, "string");
});

test("streamed imports preserve accented names split inside UTF-8 characters", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(SNAPSHOT));
  const split = bytes.findIndex((byte) => byte >= 0xc0) + 1;
  let captured;
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(bytes.subarray(0, split));
    controller.enqueue(bytes.subarray(split));
    controller.close();
  } });
  const response = await loadPost(async (snapshot) => { captured = snapshot; })(requestWithBody(body));
  assert.equal(response.status, 200);
  assert.deepEqual(captured, SNAPSHOT);
});

test("unauthorized imports never read their request body or publish", async () => {
  const request = requestWithBody(JSON.stringify(SNAPSHOT), { Authorization: "Bearer wrong-token" });
  const response = await loadPost()(request);
  assert.equal(response.status, 401);
  assert.equal(request.bodyUsed, false);
});
