import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { Environment } from "@/types";

function EnvEditor({ env }: { env: Environment }) {
  const addEnvVariable = useAppStore((s) => s.addEnvVariable);
  const removeEnvVariable = useAppStore((s) => s.removeEnvVariable);
  const updateEnvVariable = useAppStore((s) => s.updateEnvVariable);

  return (
    <div className="flex flex-col gap-1">
      {env.variables.length === 0 ? (
        <p className="text-xs text-gray-600 py-1">暂无变量</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {env.variables.map((v) => (
            <div key={v.id} className="group flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={v.enabled}
                onChange={(e) =>
                  updateEnvVariable(env.id, v.id, { enabled: e.target.checked })
                }
                className="flex-shrink-0 accent-brand-500 w-3 h-3"
              />
              <input
                value={v.key}
                onChange={(e) =>
                  updateEnvVariable(env.id, v.id, { key: e.target.value })
                }
                placeholder="变量名"
                className="flex-1 bg-[#1e1e1e] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500 min-w-0"
              />
              <input
                value={v.value}
                onChange={(e) =>
                  updateEnvVariable(env.id, v.id, { value: e.target.value })
                }
                placeholder="值"
                className="flex-1 bg-[#1e1e1e] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500 min-w-0"
              />
              <button
                onClick={() => removeEnvVariable(env.id, v.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-0.5 rounded transition-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => addEnvVariable(env.id)}
        className="flex items-center gap-1 text-xs text-gray-600 hover:text-brand-400 py-1 mt-1 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加变量
      </button>
    </div>
  );
}

function EnvRow({ env }: { env: Environment }) {
  const [expanded, setExpanded] = useState(false);
  const activeEnvId = useAppStore((s) => s.activeEnvId);
  const setActiveEnvironment = useAppStore((s) => s.setActiveEnvironment);
  const deleteEnvironment = useAppStore((s) => s.deleteEnvironment);
  const renameEnvironment = useAppStore((s) => s.renameEnvironment);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(env.name);
  const isActive = activeEnvId === env.id;

  return (
    <div className={`rounded border mb-1.5 ${isActive ? "border-brand-500/40 bg-brand-500/5" : "border-[#2a2a2a]"}`}>
      <div
        className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
        onClick={() => !renaming && setExpanded((v) => !v)}
      >
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>

        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
        )}

        {renaming ? (
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => {
              if (newName.trim()) renameEnvironment(env.id, newName.trim());
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (newName.trim()) renameEnvironment(env.id, newName.trim());
                setRenaming(false);
              }
              if (e.key === "Escape") setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-[#2a2a2a] border border-brand-500 rounded px-1.5 py-0.5 text-sm text-gray-200 outline-none"
          />
        ) : (
          <span className="flex-1 text-sm text-gray-300 truncate">{env.name}</span>
        )}

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setActiveEnvironment(isActive ? null : env.id)}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
              isActive
                ? "text-brand-400 border-brand-500/40 bg-brand-500/10"
                : "text-gray-600 border-[#333] hover:text-brand-400 hover:border-brand-500/40"
            }`}
          >
            {isActive ? "激活" : "使用"}
          </button>
          <button
            onClick={() => setRenaming(true)}
            className="text-gray-600 hover:text-gray-300 p-0.5 rounded hover:bg-white/5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => deleteEnvironment(env.id)}
            className="text-gray-600 hover:text-red-400 p-0.5 rounded hover:bg-red-500/5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-[#2a2a2a]">
          <div className="pt-2">
            <EnvEditor env={env} />
          </div>
        </div>
      )}
    </div>
  );
}

export function EnvironmentsSidebar() {
  const environments = useAppStore((s) => s.environments);
  const createEnvironment = useAppStore((s) => s.createEnvironment);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");

  function handleCreate() {
    if (name.trim()) {
      createEnvironment(name.trim());
      setName("");
      setModalOpen(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#222]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">环境变量</span>
        <Button size="xs" variant="ghost" onClick={() => setModalOpen(true)} title="新建环境">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {environments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <p className="text-xs text-gray-600">暂无环境</p>
          </div>
        ) : (
          environments.map((env) => <EnvRow key={env.id} env={env} />)
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新建环境">
        <div className="flex flex-col gap-3">
          <Input
            label="环境名称"
            placeholder="生产环境 / 测试环境"
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
    </div>
  );
}
