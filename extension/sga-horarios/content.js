(() => {
  "use strict";

  if (globalThis.__sgaScheduleExporterLoaded) return;
  globalThis.__sgaScheduleExporterLoaded = true;
  const parser = globalThis.SgaParser;
  if (!parser) return;

  function waitBeforeAction(callback, delay = 900) {
    window.setTimeout(callback, delay);
  }

  function findElementByText(selector, text) {
    const expected = parser.comparable(text);
    return [...document.querySelectorAll(selector)].find((element) =>
      parser.comparable(element.innerText || element.textContent || element.value).includes(expected),
    );
  }

  function findCourseRow(courseId) {
    for (const table of document.querySelectorAll("table")) {
      for (const row of table.querySelectorAll("tr")) {
        const firstCell = row.querySelector("td");
        const parsed = parser.parseCourseLabel(firstCell?.innerText || firstCell?.textContent);
        if (parsed?.courseId === courseId) return row;
      }
    }
    return null;
  }

  function findEnrollmentControl(row) {
    if (!row) return null;
    const cells = [...row.querySelectorAll("td")];
    const targetCell = cells.at(-1) || row;
    const image = targetCell.querySelector("img");
    return image?.closest("a, button, [onclick]") ||
      targetCell.querySelector("a[href], button, input[type='image'], input[type='submit'], [onclick]");
  }

  function reportPage() {
    chrome.runtime.sendMessage({ type: "PAGE_STATE", payload: parser.classifyPage(document) });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "REQUEST_PAGE_STATE") {
      sendResponse({ ok: true });
      reportPage();
      return;
    }
    if (message.type === "EXPAND_ORIENTATIONS") {
      const control = findElementByText("a, button", "Mostrar los cursos de todas las orientaciones");
      if (!control) {
        sendResponse({ ok: false, error: "No se encontró el enlace para mostrar todas las orientaciones." });
        return;
      }
      sendResponse({ ok: true });
      control.click();
      return;
    }
    if (message.type === "OPEN_COURSE") {
      const control = findEnrollmentControl(findCourseRow(message.courseId));
      if (!control) {
        sendResponse({ ok: false, error: `No se encontró el botón + de ${message.courseId}.` });
        return;
      }
      sendResponse({ ok: true });
      waitBeforeAction(() => control.click());
      return;
    }
    if (message.type === "RETURN_TO_LIST") {
      const cancel = findElementByText("button, input[type='submit'], input[type='button'], a", "Cancelar");
      if (!cancel) {
        sendResponse({ ok: false, error: "No se encontró el botón Cancelar. El recorrido se pausó por seguridad." });
        return;
      }
      sendResponse({ ok: true });
      waitBeforeAction(() => cancel.click());
      return;
    }
    if (message.type === "SAFE_RETURN") {
      const cancel = findElementByText("button, input[type='submit'], input[type='button'], a", "Cancelar");
      if (cancel) waitBeforeAction(() => cancel.click(), 200);
      sendResponse({ ok: true });
    }
  });

  reportPage();
})();
