import React, { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ImportDialog } from "@/components/import/ImportDialog";
import { getMethodBadgeColor } from "@/lib/utils";
import {
  downloadReqHub,
  downloadPostman,
  downloadOpenAPI,
  downloadAllAsReqHub,
  EXPORT_FORMAT_INFO,
  type ExportFormat,
} from "@/lib/exporters";
import type { Collection, CollectionItem } from "@/types";

// ─── Count total requests recursively ────────────────────────────────────────
function countRequests(items: CollectionItem[]): number {
  let n = 0;
  for (const item of items) {
    if (item.type === "request") n++;
    if (item.type === "folder" && item.children) n += countRequests(item.children);
  }
  return n;
}

// ─── Inline rename input ──────────────────────────────────────────────────────
function InlineRenameInput({
  value,
  onConfirm,
  onCancel,
}: {
  value: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function commit() {
    const trimmed = val.trim();
    if (trimmed && trimmed !== value) onConfirm(trimmed);
    else onCancel();
  }

  return (
    <input
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 bg-[#2a2a2a] border border-brand-500 rounded px-1.5 py-0.5 text-xs text-gray-200 outline-none"
    />
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") onConfirm();
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg shadow-2xl">
        <div className="px-4 py-3 border-b border-[#252525]">
          <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
        </div>
        <div className="px-4 pb-4 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] rounded transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 text-xs text-white rounded transition-colors ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recursive item row ───────────────────────────────────────────────────────

interface ItemRowProps {
  item: CollectionItem;
  collectionId: string;
  depth: number;
}

function ItemRow({ item, collectionId, depth }: ItemRowProps) {
  const openCollectionRequest = useAppStore((s) => s.openCollectionRequest);
  const removeFromCollection = useAppStore((s) => s.removeFromCollection);
  const renameCollectionItem = useAppStore((s) => s.renameCollectionItem);

  const [expanded, setExpanded] = useState(item.expanded ?? depth < 2);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const indent = depth * 14;

  if (item.type === "request") {
    const method = item.request?.method ?? "GET";
    return (
      <>
        <div
          className="group flex items-center gap-2 py-1.5 pr-2 hover:bg-white/5 cursor-pointer rounded text-sm"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => !renaming && item.request && openCollectionRequest(item.request)}
        >
          <span
            className={`text-[10px] font-bold border px-1 py-0.5 rounded flex-shrink-0 ${getMethodBadgeColor(method)}`}
          >
            {method}
          </span>

          {renaming ? (
            <InlineRenameInput
              value={item.name}
              onConfirm={(v) => { renameCollectionItem(collectionId, item.id, v); setRenaming(false); }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <span className="text-gray-300 truncate flex-1 min-w-0 text-xs">{item.name}</span>
          )}

          {!renaming && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
              {/* Rename */}
              <button
                onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
                className="text-gray-600 hover:text-gray-300 p-0.5 rounded hover:bg-white/10 transition-colors"
                title="重命名"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              {/* Delete (with confirm) */}
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="text-gray-600 hover:text-red-400 p-0.5 rounded hover:bg-red-500/10 transition-colors"
                title="删除"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <ConfirmDialog
          open={confirmDelete}
          title="删除请求"
          message={`确定要从集合中删除「${item.name}」吗？此操作不可撤销。`}
          confirmLabel="删除"
          danger
          onConfirm={() => { removeFromCollection(collectionId, item.id); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      </>
    );
  }

  // Folder
  const children = item.children ?? [];
  return (
    <>
      <div>
        <div
          className="group flex items-center gap-1.5 py-1.5 pr-2 hover:bg-white/5 cursor-pointer rounded"
          style={{ paddingLeft: `${indent + 4}px` }}
          onClick={() => !renaming && setExpanded((v) => !v)}
        >
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className="w-3.5 h-3.5 text-yellow-600/70 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>

          {renaming ? (
            <InlineRenameInput
              value={item.name}
              onConfirm={(v) => { renameCollectionItem(collectionId, item.id, v); setRenaming(false); }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <span className="flex-1 text-xs font-medium text-gray-400 truncate min-w-0">{item.name}</span>
          )}

          {!renaming && (
            <>
              <span className="text-[10px] text-gray-700 flex-shrink-0">{countRequests(children)}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 ml-0.5">
                {/* Rename folder */}
                <button
                  onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
                  className="text-gray-600 hover:text-gray-300 p-0.5 rounded hover:bg-white/10 transition-colors"
                  title="重命名文件夹"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {/* Delete folder */}
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                  className="text-gray-600 hover:text-red-400 p-0.5 rounded hover:bg-red-500/10 transition-colors"
                  title="删除文件夹"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {expanded && (
          <div>
            {children.length === 0 ? (
              <div style={{ paddingLeft: `${indent + 28}px` }} className="py-1">
                <span className="text-[10px] text-gray-700">空文件夹</span>
              </div>
            ) : (
              children.map((child) => (
                <ItemRow key={child.id} item={child} collectionId={collectionId} depth={depth + 1} />
              ))
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除文件夹"
        message={`确定要删除文件夹「${item.name}」及其包含的 ${countRequests(children)} 个请求吗？此操作不可撤销。`}
        confirmLabel="删除"
        danger
        onConfirm={() => { removeFromCollection(collectionId, item.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

// ─── Collection row ───────────────────────────────────────────────────────────

function CollectionRow({ col }: { col: Collection }) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(col.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteCollection = useAppStore((s) => s.deleteCollection);
  const renameCollection = useAppStore((s) => s.renameCollection);
  const newTab = useAppStore((s) => s.newTab);
  const totalRequests = countRequests(col.items);

  function handleExport(fmt: ExportFormat) {
    if (fmt === "reqhub") downloadReqHub([col]);
    else if (fmt === "postman") downloadPostman(col);
    else if (fmt === "openapi") downloadOpenAPI(col);
    setExportMenuOpen(false);
    setMenuOpen(false);
  }

  return (
    <>
      <div className="mb-0.5">
        {/* Collection header */}
        <div
          className="group flex items-center gap-1 px-2 py-1.5 hover:bg-white/5 rounded cursor-pointer"
          onClick={() => !renaming && setExpanded((v) => !v)}
        >
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {renaming ? (
            <InlineRenameInput
              value={col.name}
              onConfirm={(v) => { renameCollection(col.id, v); setRenaming(false); }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <span className="flex-1 text-sm font-semibold text-gray-300 truncate min-w-0">
              {col.name}
            </span>
          )}

          {!renaming && (
            <>
              <span className="text-[10px] text-gray-600 flex-shrink-0 mr-0.5">
                {totalRequests}
              </span>

              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300 p-0.5 rounded hover:bg-white/5 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 w-44 bg-[#1e1e1e] border border-[#333] rounded shadow-xl">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          newTab({ collectionId: col.id });
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                      >
                        添加请求
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenaming(true);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                      >
                        重命名
                      </button>
                      <div className="border-t border-[#2a2a2a] my-0.5" />
                      {/* Export submenu */}
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setExportMenuOpen((v) => !v); }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            导出
                          </span>
                          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        {exportMenuOpen && (
                          <div className="absolute left-full top-0 ml-1 w-52 bg-[#1e1e1e] border border-[#333] rounded shadow-xl z-50">
                            {(Object.entries(EXPORT_FORMAT_INFO) as [ExportFormat, typeof EXPORT_FORMAT_INFO[ExportFormat]][]).map(([fmt, info]) => (
                              <button
                                key={fmt}
                                onClick={(e) => { e.stopPropagation(); handleExport(fmt); }}
                                className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors"
                              >
                                <p className="text-xs text-gray-300">{info.label}</p>
                                <p className="text-[10px] text-gray-600 mt-0.5">{info.desc}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="border-t border-[#2a2a2a] my-0.5" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(true);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        删除集合
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Items */}
        {expanded && (
          <div className="px-1">
            {col.items.length === 0 ? (
              <p className="text-xs text-gray-700 px-3 py-2">暂无请求</p>
            ) : (
              col.items.map((item) => (
                <ItemRow key={item.id} item={item} collectionId={col.id} depth={0} />
              ))
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除集合"
        message={`确定要删除集合「${col.name}」及其包含的 ${totalRequests} 个请求吗？此操作不可撤销。`}
        confirmLabel="删除"
        danger
        onConfirm={() => { deleteCollection(col.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function CollectionsSidebar() {
  const collections = useAppStore((s) => s.collections);
  const createCollection = useAppStore((s) => s.createCollection);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportAllMenuOpen, setExportAllMenuOpen] = useState(false);
  const [name, setName] = useState("");

  function handleExportAll(fmt: ExportFormat) {
    if (fmt === "reqhub") downloadAllAsReqHub(collections);
    else {
      // Export each collection separately for postman/openapi
      collections.forEach((col) => {
        if (fmt === "postman") downloadPostman(col);
        else downloadOpenAPI(col);
      });
    }
    setExportAllMenuOpen(false);
  }

  function handleCreate() {
    if (name.trim()) {
      createCollection(name.trim());
      setName("");
      setModalOpen(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#222]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">集合</span>
        <div className="flex items-center gap-0.5">
          {/* Import */}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setImportOpen(true)}
            title="导入（Postman / APIPost / Apifox / OpenAPI）"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </Button>
          {/* Export all (only shown when there are collections) */}
          {collections.length > 0 && (
            <div className="relative">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setExportAllMenuOpen((v) => !v)}
                title="导出所有集合"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </Button>
              {exportAllMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportAllMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-56 bg-[#1e1e1e] border border-[#333] rounded shadow-xl">
                    <p className="px-3 py-2 text-[10px] text-gray-600 border-b border-[#2a2a2a]">
                      导出全部 {collections.length} 个集合
                    </p>
                    {(Object.entries(EXPORT_FORMAT_INFO) as [ExportFormat, typeof EXPORT_FORMAT_INFO[ExportFormat]][]).map(([fmt, info]) => (
                      <button
                        key={fmt}
                        onClick={() => handleExportAll(fmt)}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors"
                      >
                        <p className="text-xs text-gray-300">{info.label}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{info.desc}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {/* New collection */}
          <Button size="xs" variant="ghost" onClick={() => setModalOpen(true)} title="新建集合">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4 gap-2">
            <svg className="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <p className="text-xs text-gray-600">暂无集合</p>
            <div className="flex flex-col gap-1.5 w-full">
              <button
                onClick={() => setModalOpen(true)}
                className="text-xs text-brand-400 hover:text-brand-300 py-1"
              >
                + 创建新集合
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 py-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                导入 Postman / Apifox
              </button>
            </div>
          </div>
        ) : (
          collections.map((col) => <CollectionRow key={col.id} col={col} />)
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新建集合">
        <div className="flex flex-col gap-3">
          <Input
            label="集合名称"
            placeholder="我的 API 集合"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>取消</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!name.trim()}>创建</Button>
          </div>
        </div>
      </Modal>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
