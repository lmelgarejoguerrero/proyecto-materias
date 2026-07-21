(() => {
  "use strict";

  const DATABASE_NAME = "sga-schedule-exporter";
  const STORE_NAME = "project-files";
  const HANDLE_KEY = "schedule-snapshot";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(mode, action) {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = action(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }

  function saveHandle(handle) {
    return withStore("readwrite", (store) => store.put(handle, HANDLE_KEY));
  }

  function getHandle() {
    return withStore("readonly", (store) => store.get(HANDLE_KEY));
  }

  async function getLinkStatus() {
    const handle = await getHandle();
    if (!handle) return { status: "unlinked", name: null };
    const permission = await handle.queryPermission({ mode: "readwrite" });
    return { status: permission === "granted" ? "ready" : "permission-needed", name: handle.name };
  }

  async function writeSnapshot(snapshot) {
    const handle = await getHandle();
    if (!handle) return { status: "unlinked", name: null };
    const permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") return { status: "permission-needed", name: handle.name };

    const writable = await handle.createWritable();
    try {
      await writable.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    } finally {
      await writable.close();
    }
    return { status: "saved", name: handle.name, savedAt: new Date().toISOString() };
  }

  globalThis.SgaFileLink = { getHandle, getLinkStatus, saveHandle, writeSnapshot };
})();
