import React, { useRef, useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getMethodColor } from "@/lib/utils";
import type { RequestTab } from "@/types";

// ─── Unsaved-changes confirm dialog ──────────────────────────────────────────

interface UnsavedDialogProps {
  tab: RequestTab;
  onDiscard: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function UnsavedDialog({ tab, onDiscard, onSave, onCancel }: UnsavedDialogProps) {
  const collections = useAppStore((s) => s.collections);
  const addToCollection = useAppStore((s) => s.addToCollection);
  const [selectedCollectionId, setSelectedCollectionId] = useState(
    collections[0]?.id ?? ""
  );

  // Keyboard: Escape → cancel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  function handleSave() {
    if (selectedCollectionId) {
      addToCollection(selectedCollectionId, tab.request);
    }
    onSave();
  }

  const name = tab.request.name || tab.request.url || "未命名请求";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#252525]">
          <div className="w-7 h-7 bg-yellow-500/15 rounded flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-200">关闭前保存？</h2>
        </div>

        {/* Body */}
        <div className="px-4 py-4 flex flex-col gap-3">
          <p className="text-sm text-gray-400">
            「<span className="text-gray-200 font-medium">{name}</span>」有未保存的修改，关闭后将丢失。
          </p>

          {/* Save to collection picker */}
          {collections.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-gray-500">保存到集合</label>
              <select
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                className="bg-[#1e1e1e] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-500 w-full"
              >
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {collections.length === 0 && (
            <p className="text-xs text-gray-600 bg-[#1e1e1e] rounded px-3 py-2 border border-[#2a2a2a]">
              暂无集合，直接关闭将丢失此请求。可先在集合面板创建集合后再保存。
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-300 bg-[#2a2a2a] hover:bg-red-500/10 border border-[#333] hover:border-red-500/30 rounded transition-colors"
          >
            不保存，直接关闭
          </button>
          {collections.length > 0 && (
            <button
              onClick={handleSave}
              disabled={!selectedCollectionId}
              className="px-3 py-1.5 text-xs text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded transition-colors"
            >
              保存并关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const newTab = useAppStore((s) => s.newTab);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pending close state: tab waiting for unsaved-changes confirmation
  const [pendingClose, setPendingClose] = useState<RequestTab | null>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  function handleCloseClick(tab: RequestTab) {
    if (tab.isDirty) {
      // Has unsaved changes — show confirm dialog
      setPendingClose(tab);
    } else {
      closeTab(tab.id);
    }
  }

  function handleDiscard() {
    if (pendingClose) closeTab(pendingClose.id);
    setPendingClose(null);
  }

  function handleSaveAndClose() {
    // addToCollection is handled inside UnsavedDialog; we just close
    if (pendingClose) closeTab(pendingClose.id);
    setPendingClose(null);
  }

  function handleCancelClose() {
    setPendingClose(null);
  }

  return (
    <>
      <div className="flex items-center bg-[#141414] border-b border-[#222] h-9 flex-shrink-0">
        {/* Tabs scrollable area */}
        <div
          ref={scrollRef}
          className="flex items-end h-full overflow-x-auto flex-1 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const method = tab.request.method;
            const name = tab.request.name || "New Request";
            const url = tab.request.url;

            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group relative flex items-center gap-1.5 h-8 px-3 cursor-pointer
                  text-xs whitespace-nowrap flex-shrink-0 select-none border-r border-[#222]
                  transition-colors duration-100 max-w-[200px]
                  ${
                    isActive
                      ? "bg-[#1e1e1e] text-gray-200 border-t-2 border-t-brand-500"
                      : "bg-transparent text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300 border-t-2 border-t-transparent"
                  }
                `}
              >
                <span className={`font-semibold text-[10px] flex-shrink-0 ${getMethodColor(method)}`}>
                  {method}
                </span>
                <span className="truncate max-w-[110px]">
                  {name !== "New Request" ? name : url || "New Request"}
                </span>

                {/* Dirty indicator dot OR close button */}
                {tab.isDirty ? (
                  // Show orange dot (unsaved), click to close triggers confirm
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseClick(tab);
                    }}
                    className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors hover:bg-white/10"
                    title="有未保存的修改，点击关闭"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 group-hover:hidden" />
                    <svg
                      className="w-3 h-3 text-gray-400 hidden group-hover:block"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={`
                      flex-shrink-0 rounded p-0.5 transition-colors
                      ${isActive
                        ? "text-gray-400 hover:text-gray-200 hover:bg-white/10 opacity-100"
                        : "text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100"
                      }
                    `}
                    title="关闭"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* New tab button */}
        <button
          onClick={() => newTab()}
          className="flex-shrink-0 px-2 h-8 text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          title="新建标签 (Ctrl+T)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Unsaved changes dialog */}
      {pendingClose && (
        <UnsavedDialog
          tab={pendingClose}
          onDiscard={handleDiscard}
          onSave={handleSaveAndClose}
          onCancel={handleCancelClose}
        />
      )}
    </>
  );
}
