import { normalizarProgreso, parsearProgreso } from "@/lib/planUtils";
import type { EstadoMateria, ProgresoMaterias } from "@/types/plan";

export const PROGRESS_STORAGE_KEY = "malla-curricular:progreso:v1";

export interface ProgresoSnapshot {
  progreso: ProgresoMaterias;
  storageSincronizado: boolean;
  storageError: string | null;
}

const INITIAL_SNAPSHOT: ProgresoSnapshot = {
  progreso: {},
  storageSincronizado: false,
  storageError: null,
};

interface ProgresoStoreEnvironment {
  getStorage: () => Pick<Storage, "getItem" | "setItem">;
  subscribeToStorage: (listener: () => void) => () => void;
}

/** One shared store keeps mounted views and other tabs in sync without write-back loops. */
export function crearProgresoStore(environment: ProgresoStoreEnvironment) {
  let snapshot = INITIAL_SNAPSHOT;
  let lastStoredRaw: string | null | undefined;
  const unsavedChanges = new Map<string, EstadoMateria | undefined>();
  const listeners = new Set<() => void>();
  let unsubscribeStorage: (() => void) | undefined;

  const emit = () => listeners.forEach((listener) => listener());

  const refresh = () => {
    try {
      const raw = environment.getStorage().getItem(PROGRESS_STORAGE_KEY);
      if (raw !== lastStoredRaw || !snapshot.storageSincronizado) {
        lastStoredRaw = raw;
        const progreso = parsearProgreso(raw);
        // Keep edits made while storage was blocked, including removals, when access returns.
        for (const [id, estado] of unsavedChanges) {
          if (estado === undefined) delete progreso[id];
          else progreso[id] = estado;
        }
        snapshot = {
          progreso,
          storageSincronizado: true,
          storageError: unsavedChanges.size > 0 ? snapshot.storageError : null,
        };
        emit();
      }
    } catch {
      if (!snapshot.storageSincronizado || !snapshot.storageError) {
        snapshot = {
          ...snapshot,
          storageSincronizado: true,
          storageError: "No se pudo acceder al guardado local. Podés seguir trabajando y exportar un backup.",
        };
        emit();
      }
    }
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => INITIAL_SNAPSHOT,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) unsubscribeStorage = environment.subscribeToStorage(refresh);
      refresh();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribeStorage?.();
          unsubscribeStorage = undefined;
        }
      };
    },
    update(updater: (actual: ProgresoMaterias) => ProgresoMaterias) {
      // Read just before applying an edit so a newer change from another tab survives.
      refresh();
      const progreso = normalizarProgreso(updater(snapshot.progreso));
      for (const id of new Set([...Object.keys(snapshot.progreso), ...Object.keys(progreso)])) {
        if (snapshot.progreso[id] !== progreso[id]) unsavedChanges.set(id, progreso[id]);
      }
      const raw = JSON.stringify(progreso);
      let storageError: string | null = null;
      try {
        if (raw !== lastStoredRaw) environment.getStorage().setItem(PROGRESS_STORAGE_KEY, raw);
        lastStoredRaw = raw;
        unsavedChanges.clear();
      } catch {
        storageError = "El navegador no pudo guardar los cambios. Exportá un backup antes de cerrar esta página.";
      }
      snapshot = { progreso, storageSincronizado: true, storageError };
      emit();
    },
  };
}

export const progresoStore = crearProgresoStore({
  getStorage: () => window.localStorage,
  subscribeToStorage: (listener) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROGRESS_STORAGE_KEY || event.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
});
