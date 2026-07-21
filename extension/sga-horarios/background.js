"use strict";

const SCAN_KEY = "sgaScheduleScan";
const IMPORT_KEY_STORAGE_KEY = "sgaImportKey";
const APP_URL = "https://proyecto-materias.vercel.app/#planificar";
const IMPORT_URL = "https://proyecto-materias.vercel.app/api/horarios/sga";

async function getScan() {
  const stored = await chrome.storage.local.get(SCAN_KEY);
  return stored[SCAN_KEY] || null;
}

async function saveScan(scan) {
  await chrome.storage.local.set({ [SCAN_KEY]: scan });
  return scan;
}

async function pauseScan(scan, error) {
  await saveScan({ ...scan, status: "paused", error, updatedAt: new Date().toISOString() });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function injectContentScripts(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["parser.js", "content.js"] });
}

async function sendToScanTab(scan, message) {
  try {
    const response = await chrome.tabs.sendMessage(scan.tabId, message);
    if (response?.ok === false) throw new Error(response.error || "El SGA no respondió la acción.");
    return response;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    const missingReceiver = messageText.includes("Receiving end does not exist") ||
      messageText.includes("Could not establish connection");
    if (missingReceiver) {
      try {
        await injectContentScripts(scan.tabId);
        const response = await chrome.tabs.sendMessage(scan.tabId, message);
        if (response?.ok === false) throw new Error(response.error || "El SGA no respondió la acción.");
        return response;
      } catch (injectionError) {
        await pauseScan(scan, injectionError instanceof Error ? injectionError.message : String(injectionError));
        return null;
      }
    }
    await pauseScan(scan, messageText);
    return null;
  }
}

function mergeCatalog(current, courses) {
  const merged = { ...(current || {}) };
  for (const course of courses || []) merged[course.courseId] = { ...merged[course.courseId], ...course, availability: "available" };
  return merged;
}

function mergeRequested(current, courses) {
  const merged = { ...(current || {}) };
  for (const course of courses || []) merged[course.courseId] = course;
  return merged;
}

function snapshotFromScan(scan) {
  const available = Object.values(scan.catalog || {}).map((course) => ({
    ...course,
    commissions: scan.results?.[course.courseId]?.commissions || [],
    error: scan.failures?.[course.courseId] || null,
  }));
  const requested = Object.values(scan.requestedCourses || {}).filter(
    (course) => !available.some((availableCourse) => availableCourse.courseId === course.courseId),
  );
  return {
    schemaVersion: 1,
    source: "sga-itba",
    academicPeriod: scan.academicPeriod || null,
    capturedAt: scan.completedAt || new Date().toISOString(),
    courses: [...available, ...requested].sort((left, right) => left.courseId.localeCompare(right.courseId, "es", { numeric: true })),
  };
}

async function publishSnapshotToApp(snapshot) {
  const stored = await chrome.storage.local.get(IMPORT_KEY_STORAGE_KEY);
  const importKey = stored[IMPORT_KEY_STORAGE_KEY];
  if (!importKey) throw new Error("Configurá una vez la clave privada de publicación.");

  const response = await fetch(IMPORT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${importKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snapshot),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "La web no pudo guardar los horarios.");

  await chrome.tabs.create({ url: APP_URL, active: true });
  return {
    status: "published",
    publishedAt: new Date().toISOString(),
    courses: snapshot.courses.length,
  };
}

async function continueFromList(scan, payload) {
  if (scan.phase === "opening-detail" && scan.currentCourseId) return;
  if (scan.phase === "expanding-list") return;

  let updated = {
    ...scan,
    academicPeriod: payload.academicPeriod || scan.academicPeriod,
    catalog: mergeCatalog(scan.catalog, payload.availableCourses),
    requestedCourses: mergeRequested(scan.requestedCourses, payload.requestedCourses),
    currentCourseId: null,
    phase: "reading-list",
    updatedAt: new Date().toISOString(),
  };

  if (!updated.expansionAttempted && payload.canExpandOrientations) {
    updated = await saveScan({ ...updated, expansionAttempted: true, phase: "expanding-list" });
    const expanded = await sendToScanTab(updated, { type: "EXPAND_ORIENTATIONS" });
    if (!expanded) return;
    await delay(2_000);
    const latest = await getScan();
    if (!latest || latest.status !== "scanning") return;
    const ready = await saveScan({ ...latest, phase: "reading-list" });
    await sendToScanTab(ready, { type: "REQUEST_PAGE_STATE" });
    return;
  }

  const nextCourse = Object.keys(updated.catalog).find(
    (courseId) => !updated.results?.[courseId] && !updated.failures?.[courseId],
  );
  if (!nextCourse) {
    const completedAt = new Date().toISOString();
    let completed = { ...updated, status: "complete", completedAt, updatedAt: completedAt };
    await saveScan(completed);
    try {
      const appSync = await publishSnapshotToApp(snapshotFromScan(completed));
      completed = { ...completed, appSync };
    } catch (error) {
      completed = {
        ...completed,
        appSync: {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
    await saveScan(completed);
    return;
  }

  updated = await saveScan({ ...updated, currentCourseId: nextCourse, phase: "opening-detail" });
  await sendToScanTab(updated, { type: "OPEN_COURSE", courseId: nextCourse });
}

async function continueFromDetail(scan, payload) {
  const course = payload.course;
  if (!course?.courseId) {
    await pauseScan(scan, "La pantalla de comisión no contiene un código de materia reconocible.");
    return;
  }
  const updated = await saveScan({
    ...scan,
    academicPeriod: payload.academicPeriod || scan.academicPeriod,
    results: { ...scan.results, [course.courseId]: course },
    currentCourseId: course.courseId,
    phase: "returning-list",
    updatedAt: new Date().toISOString(),
  });
  await sendToScanTab(updated, { type: "RETURN_TO_LIST" });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "START_SCAN") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith("https://sga.itba.edu.ar/app2/")) {
        sendResponse({ ok: false, error: "Abrí primero la pantalla de matriculación del SGA." });
        return;
      }
      const now = new Date().toISOString();
      const scan = await saveScan({
        status: "scanning",
        tabId: tab.id,
        startedAt: now,
        updatedAt: now,
        completedAt: null,
        academicPeriod: null,
        expansionAttempted: false,
        catalog: {},
        requestedCourses: {},
        results: {},
        failures: {},
        currentCourseId: null,
        phase: "reading-list",
        error: null,
      });
      await sendToScanTab(scan, { type: "REQUEST_PAGE_STATE" });
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "STOP_SCAN") {
      const scan = await getScan();
      if (scan) {
        await saveScan({ ...scan, status: "stopped", updatedAt: new Date().toISOString() });
        if (scan.currentCourseId) await sendToScanTab(scan, { type: "SAFE_RETURN" });
      }
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "GET_SCAN") {
      sendResponse({ ok: true, scan: await getScan() });
      return;
    }
    if (message.type === "GET_SNAPSHOT") {
      const scan = await getScan();
      sendResponse({ ok: Boolean(scan), snapshot: scan ? snapshotFromScan(scan) : null });
      return;
    }
    if (message.type === "SYNC_TO_APP") {
      const scan = await getScan();
      if (!scan || scan.status !== "complete") {
        sendResponse({ ok: false, error: "Primero completá la actualización desde el SGA." });
        return;
      }
      try {
        const appSync = await publishSnapshotToApp(snapshotFromScan(scan));
        await saveScan({ ...scan, appSync, updatedAt: new Date().toISOString() });
        sendResponse({ ok: true, appSync });
      } catch (error) {
        const appSync = { status: "error", error: error instanceof Error ? error.message : String(error) };
        await saveScan({ ...scan, appSync, updatedAt: new Date().toISOString() });
        sendResponse({ ok: false, error: appSync.error });
      }
      return;
    }
    if (message.type === "PAGE_STATE") {
      const scan = await getScan();
      if (!scan || scan.status !== "scanning" || sender.tab?.id !== scan.tabId) {
        sendResponse({ ok: true, ignored: true });
        return;
      }
      if (message.payload?.kind === "list") await continueFromList(scan, message.payload);
      else if (message.payload?.kind === "detail") await continueFromDetail(scan, message.payload);
      else await pauseScan(scan, "La extensión llegó a una pantalla del SGA que no reconoce.");
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false, error: "Mensaje desconocido." });
  })().catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
});
