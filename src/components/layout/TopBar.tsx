import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Tooltip } from "@/components/ui/Tooltip";
import { ImportDialog } from "@/components/import/ImportDialog";
import { Modal } from "@/components/ui/Modal";
import { SsoSettings } from "@/components/settings/SsoSettings";

export function TopBar() {
  const environments = useAppStore((s) => s.environments);
  const activeEnvId = useAppStore((s) => s.activeEnvId);
  const setActiveEnvironment = useAppStore((s) => s.setActiveEnvironment);
  const setSidebarView = useAppStore((s) => s.setSidebarView);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const newTab = useAppStore((s) => s.newTab);
  const [importOpen, setImportOpen] = useState(false);
  const [ssoOpen, setSsoOpen] = useState(false);
  const ssoConfig = useAppStore((s) => s.ssoConfig);

  const activeEnv = environments.find((e) => e.id === activeEnvId);

  return (
    <div
      className="flex items-center justify-between px-3 h-10 bg-[#0e0e0e] border-b border-[#222] flex-shrink-0"
      data-tauri-drag-region
    >
      {/* Left: logo + toggle */}
      <div className="flex items-center gap-2">
        <Tooltip content={sidebarOpen ? "收起侧边栏" : "展开侧边栏"} placement="bottom">
          <button
            onClick={toggleSidebar}
            className="text-gray-600 hover:text-gray-300 p-1 rounded hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </Tooltip>
        <span className="text-sm font-bold text-gray-300 select-none">
          Req<span className="text-brand-400">Hub</span>
        </span>
      </div>

      {/* Right: env selector + new request */}
      <div className="flex items-center gap-2">
        {/* Environment Selector */}
        <div className="flex items-center gap-1.5">
          {activeEnv && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
          )}
          <select
            value={activeEnvId ?? ""}
            onChange={(e) => setActiveEnvironment(e.target.value || null)}
            className="bg-[#1a1a1a] border border-[#2e2e2e] rounded px-2 py-1 text-xs text-gray-400 focus:outline-none focus:border-brand-500 cursor-pointer max-w-[160px] transition-colors hover:border-[#3a3a3a]"
          >
            <option value="">无环境</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
          <Tooltip content="管理环境变量" placement="bottom">
            <button
              onClick={() => {
                setSidebarView("environments");
                if (!sidebarOpen) toggleSidebar();
              }}
              className="text-gray-600 hover:text-gray-300 p-1 rounded hover:bg-white/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Import */}
        <Tooltip content="导入 Postman / APIPost / Apifox / OpenAPI" placement="bottom">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#2e2e2e] hover:border-[#3a3a3a] text-gray-400 hover:text-gray-200 text-xs rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            导入
          </button>
        </Tooltip>

        {/* New Request */}
        <Tooltip content="新建请求 (Ctrl+T)" placement="bottom">
          <button
            onClick={() => newTab()}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建
          </button>
        </Tooltip>
      </div>

      {/* SSO Settings button */}
        <Tooltip content="SSO 单点登录设置" placement="bottom">
          <button
            onClick={() => setSsoOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors border ${
              ssoConfig.enabled
                ? "bg-brand-600/15 border-brand-500/40 text-brand-400 hover:bg-brand-600/25"
                : "bg-[#1a1a1a] border-[#2e2e2e] text-gray-500 hover:text-gray-200 hover:bg-[#222] hover:border-[#3a3a3a]"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            SSO
            {ssoConfig.enabled && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
          </button>
        </Tooltip>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <Modal
        open={ssoOpen}
        onClose={() => setSsoOpen(false)}
        title="SSO / CAS 单点登录设置"
        width="max-w-lg"
      >
        <SsoSettings onClose={() => setSsoOpen(false)} />
      </Modal>
    </div>
  );
}
