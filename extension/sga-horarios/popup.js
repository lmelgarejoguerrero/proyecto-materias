"use strict";

const elements = {
  start: document.querySelector("#start"),
  stop: document.querySelector("#stop"),
  download: document.querySelector("#download"),
  linkProject: document.querySelector("#link-project"),
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
  elements.error.hidden = !scan?.error;
  elements.error.textContent = scan?.error || "";

  if (status === "scanning") {
    elements.statusLabel.textContent = "Actualizando horarios";
    elements.statusDetail.textContent = scan.currentCourseId ? `Leyendo ${scan.currentCourseId}. No cierres la pestaña del SGA.` : "Preparando el listado de materias disponibles…";
  } else if (status === "complete") {
    elements.statusLabel.textContent = "Snapshot listo";
    elements.statusDetail.textContent = scan.projectFile?.status === "saved"
      ? `${total} materias procesadas y guardadas en la app.`
      : `${total} materias procesadas. Ya podés guardar o descargar una copia.`;
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

async function renderProjectLink(scan) {
  try {
    const link = await SgaFileLink.getLinkStatus();
    const write = scan?.projectFile;
    const state = write?.status === "saved" ? write : link;
    elements.projectStatus.className = `project-status ${state.status}`;
    if (state.status === "saved") {
      elements.projectStatus.textContent = `Guardado automáticamente en ${state.name}.`;
      elements.linkProject.textContent = "Cambiar archivo vinculado";
    } else if (state.status === "ready") {
      elements.projectStatus.textContent = `${state.name} vinculado. El próximo recorrido se guardará solo.`;
      elements.linkProject.textContent = "Cambiar archivo vinculado";
    } else if (state.status === "permission-needed") {
      elements.projectStatus.textContent = "Brave necesita que vuelvas a vincular el archivo.";
      elements.linkProject.textContent = "Volver a vincular";
    } else if (state.status === "error") {
      elements.projectStatus.textContent = "No se pudo escribir el archivo vinculado. Volvé a elegirlo.";
    } else {
      elements.projectStatus.textContent = "Vinculalo una sola vez para guardar automáticamente.";
    }
  } catch {
    elements.projectStatus.className = "project-status error";
    elements.projectStatus.textContent = "No se pudo comprobar el archivo vinculado.";
  }
}

async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SCAN" });
  const scan = response?.scan || null;
  render(scan);
  await renderProjectLink(scan);
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

elements.linkProject.addEventListener("click", async () => {
  try {
    if (!window.showSaveFilePicker) throw new Error("Brave no habilitó el selector de archivos.");
    const handle = await window.showSaveFilePicker({
      suggestedName: "sgaHorarios.json",
      types: [{ description: "Snapshot de horarios SGA", accept: { "application/json": [".json"] } }],
    });
    const permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") throw new Error("No se concedió permiso de escritura.");
    await SgaFileLink.saveHandle(handle);

    const response = await chrome.runtime.sendMessage({ type: "GET_SNAPSHOT" });
    const scanResponse = await chrome.runtime.sendMessage({ type: "GET_SCAN" });
    if (scanResponse?.scan?.status === "complete" && response?.snapshot) {
      await SgaFileLink.writeSnapshot(response.snapshot);
    }
    await refresh();
  } catch (error) {
    if (error?.name === "AbortError") return;
    elements.projectStatus.className = "project-status error";
    elements.projectStatus.textContent = error instanceof Error ? error.message : String(error);
  }
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
