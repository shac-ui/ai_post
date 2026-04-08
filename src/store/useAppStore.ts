import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { save, load } from "@/lib/storage";
import {
  createNewRequest,
  createId,
  createKeyValuePair,
} from "@/lib/utils";
import type {
  RequestTab,
  RequestConfig,
  ResponseData,
  Collection,
  CollectionItem,
  Environment,
  HistoryEntry,
  SidebarView,
  HttpMethod,
} from "@/types";

// ─── Persisted slices ─────────────────────────────────────────────────────────

interface PersistedState {
  collections: Collection[];
  environments: Environment[];
  history: HistoryEntry[];
  activeEnvId: string | null;
}

function loadPersisted(): PersistedState {
  return {
    collections: load<Collection[]>("collections", []),
    environments: load<Environment[]>("environments", [
      {
        id: "default",
        name: "Default",
        variables: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]),
    history: load<HistoryEntry[]>("history", []),
    activeEnvId: load<string | null>("activeEnvId", null),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface AppStore extends PersistedState {
  // Tabs
  tabs: RequestTab[];
  activeTabId: string | null;
  sidebarView: SidebarView;
  sidebarOpen: boolean;

  // Tab actions
  newTab: (request?: Partial<RequestConfig>) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  duplicateTab: (tabId: string) => void;
  updateTabRequest: (tabId: string, update: Partial<RequestConfig>) => void;
  setTabResponse: (tabId: string, response: ResponseData | null) => void;
  setTabStatus: (tabId: string, status: RequestTab["status"]) => void;

  // Sidebar
  setSidebarView: (view: SidebarView) => void;
  toggleSidebar: () => void;

  // Collections
  createCollection: (name: string) => void;
  deleteCollection: (collectionId: string) => void;
  renameCollection: (collectionId: string, name: string) => void;
  renameCollectionItem: (collectionId: string, itemId: string, name: string) => void;
  addToCollection: (collectionId: string, request: RequestConfig) => void;
  removeFromCollection: (collectionId: string, itemId: string) => void;
  toggleCollectionItem: (collectionId: string, itemId: string) => void;
  openCollectionRequest: (request: RequestConfig) => void;
  importCollections: (collections: Collection[]) => void;
  importEnvironments: (environments: Environment[]) => void;

  // History
  addToHistory: (entry: HistoryEntry) => void;
  clearHistory: () => void;
  deleteHistoryEntry: (entryId: string) => void;
  openHistoryEntry: (entry: HistoryEntry) => void;

  // Environments
  createEnvironment: (name: string) => void;
  deleteEnvironment: (envId: string) => void;
  renameEnvironment: (envId: string, name: string) => void;
  setActiveEnvironment: (envId: string | null) => void;
  updateEnvVariable: (envId: string, varId: string, update: Partial<Environment["variables"][0]>) => void;
  addEnvVariable: (envId: string) => void;
  removeEnvVariable: (envId: string, varId: string) => void;

  // Derived
  getActiveTab: () => RequestTab | null;
  getActiveEnvironment: () => Environment | null;
}

export const useAppStore = create<AppStore>()(
  immer((set, get) => {
    const persisted = loadPersisted();

    // ─── Persistence helper ────────────────────────────────────────────
    function persist() {
      const s = get();
      save("collections", s.collections);
      save("environments", s.environments);
      save("history", s.history.slice(0, 200));
      save("activeEnvId", s.activeEnvId);
    }

    const initialTab = (): RequestTab => {
      const req = createNewRequest({ name: "New Request" });
      return {
        id: createId(),
        request: req,
        response: null,
        status: "idle",
        isDirty: false,
      };
    };

    const firstTab = initialTab();

    return {
      // ─── Initial State ───────────────────────────────────────────────
      ...persisted,
      tabs: [firstTab],
      activeTabId: firstTab.id,
      sidebarView: "collections",
      sidebarOpen: true,

      // ─── Tab Actions ─────────────────────────────────────────────────
      newTab: (partial) =>
        set((s) => {
          const req = createNewRequest(partial);
          const tab: RequestTab = {
            id: createId(),
            request: req,
            response: null,
            status: "idle",
            isDirty: false,
          };
          s.tabs.push(tab);
          s.activeTabId = tab.id;
        }),

      closeTab: (tabId) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === tabId);
          if (idx === -1) return;
          s.tabs.splice(idx, 1);
          if (s.tabs.length === 0) {
            const newTab = {
              id: createId(),
              request: createNewRequest(),
              response: null,
              status: "idle" as const,
              isDirty: false,
            };
            s.tabs.push(newTab);
            s.activeTabId = newTab.id;
          } else if (s.activeTabId === tabId) {
            s.activeTabId = s.tabs[Math.min(idx, s.tabs.length - 1)].id;
          }
        }),

      setActiveTab: (tabId) =>
        set((s) => {
          s.activeTabId = tabId;
        }),

      duplicateTab: (tabId) =>
        set((s) => {
          const src = s.tabs.find((t) => t.id === tabId);
          if (!src) return;
          const tab: RequestTab = {
            id: createId(),
            request: { ...src.request, id: createId(), name: `${src.request.name} (copy)` },
            response: null,
            status: "idle",
            isDirty: false,
          };
          const idx = s.tabs.findIndex((t) => t.id === tabId);
          s.tabs.splice(idx + 1, 0, tab);
          s.activeTabId = tab.id;
        }),

      updateTabRequest: (tabId, update) =>
        set((s) => {
          const tab = s.tabs.find((t) => t.id === tabId);
          if (!tab) return;
          Object.assign(tab.request, update);
          tab.request.updatedAt = Date.now();
          tab.isDirty = true;
        }),

      setTabResponse: (tabId, response) =>
        set((s) => {
          const tab = s.tabs.find((t) => t.id === tabId);
          if (!tab) return;
          tab.response = response;
        }),

      setTabStatus: (tabId, status) =>
        set((s) => {
          const tab = s.tabs.find((t) => t.id === tabId);
          if (!tab) return;
          tab.status = status;
        }),

      // ─── Sidebar ─────────────────────────────────────────────────────
      setSidebarView: (view) =>
        set((s) => {
          s.sidebarView = view;
        }),

      toggleSidebar: () =>
        set((s) => {
          s.sidebarOpen = !s.sidebarOpen;
        }),

      // ─── Collections ─────────────────────────────────────────────────
      createCollection: (name) =>
        set((s) => {
          s.collections.push({
            id: createId(),
            name,
            items: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          persist();
        }),

      deleteCollection: (collectionId) =>
        set((s) => {
          const idx = s.collections.findIndex((c) => c.id === collectionId);
          if (idx !== -1) s.collections.splice(idx, 1);
          persist();
        }),

      renameCollection: (collectionId, name) =>
        set((s) => {
          const col = s.collections.find((c) => c.id === collectionId);
          if (col) {
            col.name = name;
            col.updatedAt = Date.now();
          }
          persist();
        }),

      addToCollection: (collectionId, request) =>
        set((s) => {
          const col = s.collections.find((c) => c.id === collectionId);
          if (!col) return;
          col.items.push({
            id: createId(),
            name: request.name,
            type: "request",
            request: { ...request, collectionId },
            order: col.items.length,
          });
          col.updatedAt = Date.now();
          persist();
        }),

      removeFromCollection: (collectionId, itemId) =>
        set((s) => {
          const col = s.collections.find((c) => c.id === collectionId);
          if (!col) return;
          // Recursive remove — works for both flat and nested structures
          function removeDeep(items: CollectionItem[]): boolean {
            const idx = items.findIndex((i) => i.id === itemId);
            if (idx !== -1) { items.splice(idx, 1); return true; }
            for (const item of items) {
              if (item.children && removeDeep(item.children)) return true;
            }
            return false;
          }
          removeDeep(col.items);
          persist();
        }),

      renameCollectionItem: (collectionId, itemId, name) =>
        set((s) => {
          const col = s.collections.find((c) => c.id === collectionId);
          if (!col) return;
          function renameDeep(items: CollectionItem[]): boolean {
            for (const item of items) {
              if (item.id === itemId) {
                item.name = name;
                if (item.request) item.request.name = name;
                return true;
              }
              if (item.children && renameDeep(item.children)) return true;
            }
            return false;
          }
          renameDeep(col.items);
          persist();
        }),

      toggleCollectionItem: (collectionId, itemId) =>
        set((s) => {
          const col = s.collections.find((c) => c.id === collectionId);
          if (!col) return;
          function toggleDeep(items: CollectionItem[]): boolean {
            for (const item of items) {
              if (item.id === itemId) { item.expanded = !item.expanded; return true; }
              if (item.children && toggleDeep(item.children)) return true;
            }
            return false;
          }
          toggleDeep(col.items);
        }),

      openCollectionRequest: (request) => {
        const { tabs, newTab, setActiveTab } = get();
        const existing = tabs.find((t) => t.request.id === request.id);
        if (existing) {
          setActiveTab(existing.id);
        } else {
          newTab(request);
        }
      },

      importCollections: (collections) =>
        set((s) => {
          s.collections.push(...collections);
          persist();
        }),

      importEnvironments: (environments) =>
        set((s) => {
          s.environments.push(...environments);
          persist();
        }),

      // ─── History ─────────────────────────────────────────────────────
      addToHistory: (entry) =>
        set((s) => {
          s.history.unshift(entry);
          if (s.history.length > 200) s.history.pop();
          persist();
        }),

      clearHistory: () =>
        set((s) => {
          s.history = [];
          persist();
        }),

      deleteHistoryEntry: (entryId) =>
        set((s) => {
          const idx = s.history.findIndex((h) => h.id === entryId);
          if (idx !== -1) s.history.splice(idx, 1);
          persist();
        }),

      openHistoryEntry: (entry) => {
        const { newTab } = get();
        newTab(entry.request);
      },

      // ─── Environments ─────────────────────────────────────────────────
      createEnvironment: (name) =>
        set((s) => {
          s.environments.push({
            id: createId(),
            name,
            variables: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          persist();
        }),

      deleteEnvironment: (envId) =>
        set((s) => {
          const idx = s.environments.findIndex((e) => e.id === envId);
          if (idx !== -1) s.environments.splice(idx, 1);
          if (s.activeEnvId === envId) s.activeEnvId = null;
          persist();
        }),

      renameEnvironment: (envId, name) =>
        set((s) => {
          const env = s.environments.find((e) => e.id === envId);
          if (env) {
            env.name = name;
            env.updatedAt = Date.now();
          }
          persist();
        }),

      setActiveEnvironment: (envId) =>
        set((s) => {
          s.activeEnvId = envId;
          persist();
        }),

      addEnvVariable: (envId) =>
        set((s) => {
          const env = s.environments.find((e) => e.id === envId);
          if (!env) return;
          env.variables.push({
            id: nanoid(8),
            key: "",
            value: "",
            enabled: true,
          });
          persist();
        }),

      removeEnvVariable: (envId, varId) =>
        set((s) => {
          const env = s.environments.find((e) => e.id === envId);
          if (!env) return;
          const idx = env.variables.findIndex((v) => v.id === varId);
          if (idx !== -1) env.variables.splice(idx, 1);
          persist();
        }),

      updateEnvVariable: (envId, varId, update) =>
        set((s) => {
          const env = s.environments.find((e) => e.id === envId);
          if (!env) return;
          const v = env.variables.find((v) => v.id === varId);
          if (v) Object.assign(v, update);
          persist();
        }),

      // ─── Derived ─────────────────────────────────────────────────────
      getActiveTab: () => {
        const { tabs, activeTabId } = get();
        return tabs.find((t) => t.id === activeTabId) ?? null;
      },

      getActiveEnvironment: () => {
        const { environments, activeEnvId } = get();
        if (!activeEnvId) return null;
        return environments.find((e) => e.id === activeEnvId) ?? null;
      },
    };
  })
);
