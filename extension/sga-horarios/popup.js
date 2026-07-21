"use strict";

const elements = {
  start: document.querySelector("#start"),
  stop: document.querySelector("#stop"),
  download: document.querySelector("#download"),
  syncApp: document.querySelector("#sync-app"),
  importKey: document.querySelector("#import-key"),
  saveKey: document.querySelector("#save-key"),
  keyStatus: document.querySelector("#key-status"),
  projectStatus: document.querySelector("#project-status"),
  statusDot: document.querySelector("#status-dot"),
  statusLabel: document.querySelector("#status-label"),
  statusDetail: document.querySelector("#status-detail"),
  progressBar: document.querySelector("#progress-bar"),
  progressLabel: document.querySelector("#progress-label"),
  error: document.querySelector("#error"),
};

function completedCount(scan) {
  return Object.keys(scan?.results || {}).length + Object.keys(scan?.failures || {}).length;
}

function render(scan) {
  const status = scan?.status || "idle";
  const total = Object.keys(scan?.catalog || {}).length;
  const completed = completedCount(scan);
  elements.statusDot.className = `status-dot ${status}`;
  elements.progressBar.style.width = `${total > 0 ? Math.round((completed / total) * 100) : 0}%`;
  elements.progressLabel.textContent = `${completed} de ${total} materias`;
  elements.start.hidden = status === "scanning";
  elements.stop.hidden = status !== "scanning";
  elements.download.disabled = status !== "complete";
  elements.syncApp.disabled = status !== "complete";
  elements.error.hidden = !scan?.error;
  elements.error.textContent = scan?.error || "";

  if (status === "scanning") {
    elements.statusLabel.textContent = "Actualizando horarios";
    elements.statusDetail.textContent = scan.currentCourseId ? `Leyendo ${scan.currentCourseId}. No cierres la pestaña del SGA.` : "Preparando el listado de materias disponibles…";
  } else if (status === "complete") {
    elements.statusLabel.textContent = scan.appSync?.status === "published" ? "Web actualizada" : "Snapshot listo";
    elements.statusDetail.textContent = scan.appSync?.status === "published"
      ? `${total} materias procesadas y publicadas para todos.`
      : `${total} materias procesadas. Podés volver a publicarlas en la web.`;
  } else if (status === "paused") {
    elements.statusLabel.textContent = "Recorrido pausado";
    elements.statusDetail.textContent = "Volvé al listado de matriculación y comenzá nuevamente.";
  } else if (status === "stopped") {
    elements.statusLabel.textContent = "Actualización detenida";
    elements.statusDetail.textContent = "No se realizaron acciones de matriculación.";
  } else {
    elements.statusLabel.textContent = "Lista para comenzar";
    elements.statusDetail.textContent = "Abrí la pantalla de matriculación del SGA.";
  }
}

function renderAppSync(scan) {
  const state = scan?.appSync;
  elements.projectStatus.className = `project-status ${state?.status || ""}`;
  if (state?.status === "published") {
    elements.projectStatus.textContent = `${state.courses} materias guardadas persistentemente en la web.`;
    elements.syncApp.textContent = "Volver a publicar en la web";
  } else if (state?.status === "error") {
    elements.projectStatus.textContent = state.error || "No se pudo abrir la app. Probá nuevamente.";
    elements.syncApp.textContent = "Reintentar publicación";
  } else {
    elements.projectStatus.textContent = "Al terminar se guardarán los horarios en la web para todos.";
    elements.syncApp.textContent = "Publicar en la web";
  }
}

async function renderKeyStatus() {
  const stored = await chrome.storage.local.get("sgaImportKey");
  const configured = Boolean(stored.sgaImportKey);
  elements.keyStatus.textContent = configured ? "Clave guardada en esta extensión." : "Todavía no configurada.";
  elements.importKey.placeholder = configured ? "Clave guardada" : "Pegala una sola vez";
}

async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SCAN" });
  const scan = response?.scan || null;
  render(scan);
  renderAppSync(scan);
  await renderKeyStatus();
}

elements.start.addEventListener("click", async () => {
  elements.error.hidden = true;
  const response = await chrome.runtime.sendMessage({ type: "START_SCAN" });
  if (!response?.ok) {
    elements.error.textContent = response?.error || "No se pudo iniciar la actualización.";
    elements.error.hidden = false;
  }
  await refresh();
});

elements.stop.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "STOP_SCAN" });
  await refresh();
});

elements.saveKey.addEventListener("click", async () => {
  const value = elements.importKey.value.trim();
  if (!value) {
    elements.keyStatus.textContent = "Pegá una clave antes de guardar.";
    return;
  }
  await chrome.storage.local.set({ sgaImportKey: value });
  elements.importKey.value = "";
  await renderKeyStatus();
});

elements.syncApp.addEventListener("click", async () => {
  elements.syncApp.disabled = true;
  elements.syncApp.textContent = "Publicando…";
  const response = await chrome.runtime.sendMessage({ type: "SYNC_TO_APP" });
  if (!response?.ok) {
    elements.error.textContent = response?.error || "No se pudo publicar el snapshot en la web.";
    elements.error.hidden = false;
  }
  await refresh();
});

elements.download.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "GET_SNAPSHOT" });
  if (!response?.snapshot) return;
  const snapshot = response.snapshot;
  const period = snapshot.academicPeriod ? `${snapshot.academicPeriod.year}-${snapshot.academicPeriod.period}` : "actual";
  const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `horarios-sga-${period}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.sgaScheduleScan) render(changes.sgaScheduleScan.newValue);
});

void refresh();
