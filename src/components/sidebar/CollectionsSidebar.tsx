import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { ImportDialog } from "@/components/import/ImportDialog";
import { getMethodBadgeColor } from "@/lib/utils";
import type { Collection, CollectionItem } from "@/types";

function RequestItem({
  item,
  collectionId,
}: {
  item: CollectionItem;
  collectionId: string;
}) {
  const openCollectionRequest = useAppStore((s) => s.openCollectionRequest);
  const removeFromCollection = useAppStore((s) => s.removeFromCollection);

  if (!item.request) return null;
  const method = item.request.method;

  return (
    <div
      className="group flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer rounded mx-1 text-sm"
      onClick={() => openCollectionRequest(item.request!)}
    >
      <span
        className={`text-[10px] font-bold border px-1 py-0.5 rounded ${getMethodBadgeColor(method)} flex-shrink-0`}
      >
        {method}
      </span>
      <span className="text-gray-300 truncate flex-1">{item.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeFromCollection(collectionId, item.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5 rounded"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function CollectionRow({ col }: { col: Collection }) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(col.name);
  const deleteCollection = useAppStore((s) => s.deleteCollection);
  const renameCollection = useAppStore((s) => s.renameCollection);
  const newTab = useAppStore((s) => s.newTab);

  return (
    <div className="mb-1">
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
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => {
              if (newName.trim()) renameCollection(col.id, newName.trim());
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (newName.trim()) renameCollection(col.id, newName.trim());
                setRenaming(false);
              }
              if (e.key === "Escape") setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-[#2a2a2a] border border-brand-500 rounded px-1.5 py-0.5 text-sm text-gray-200 outline-none"
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-gray-300 truncate">
            {col.name}
          </span>
        )}

        <span className="text-[10px] text-gray-600 flex-shrink-0">
          {col.items.length}
        </span>

        <div className="relative">
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
              <div className="absolute right-0 top-full z-50 mt-1 w-36 bg-[#1e1e1e] border border-[#333] rounded shadow-xl">
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCollection(col.id);
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
      </div>

      {expanded && (
        <div className="ml-2">
          {col.items.length === 0 ? (
            <p className="text-xs text-gray-600 px-4 py-2">暂无请求</p>
          ) : (
            col.items.map((item) => (
              <RequestItem key={item.id} item={item} collectionId={col.id} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function CollectionsSidebar() {
  const collections = useAppStore((s) => s.collections);
  const createCollection = useAppStore((s) => s.createCollection);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [name, setName] = useState("");

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
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setImportOpen(true)}
            title="导入集合（Postman / APIPost / Apifox / OpenAPI）"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setModalOpen(true)} title="新建集合">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
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
