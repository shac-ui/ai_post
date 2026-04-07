import React, { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { TopBar } from "@/components/layout/TopBar";
import { ActivityBar } from "@/components/layout/ActivityBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { TabBar } from "@/components/layout/TabBar";
import { WorkspacePanel } from "@/components/layout/WorkspacePanel";

function WelcomeScreen() {
  const newTab = useAppStore((s) => s.newTab);

  const EXAMPLES = [
    { method: "GET", name: "JSONPlaceholder - 获取 Posts", url: "https://jsonplaceholder.typicode.com/posts" },
    { method: "GET", name: "GitHub API - 用户信息", url: "https://api.github.com/users/github" },
    { method: "POST", name: "HTTPBin - 测试 POST", url: "https://httpbin.org/post" },
    { method: "GET", name: "IP 地址查询", url: "https://api.ipify.org?format=json" },
  ] as const;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#141414] text-center px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-200 mb-2">
          Req<span className="text-brand-400">Hub</span>
        </h1>
        <p className="text-gray-500 text-sm">强大的 API 调试工具 · 支持 Mac / Windows / 浏览器</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-lg mb-8">
        <button
          onClick={() => newTab()}
          className="flex items-center gap-3 p-4 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] hover:border-brand-500/40 rounded-lg transition-all text-left group"
        >
          <div className="w-8 h-8 bg-brand-600/20 text-brand-400 rounded flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-300 group-hover:text-gray-100">新建请求</div>
            <div className="text-xs text-gray-600">Ctrl+T</div>
          </div>
        </button>

        <button
          onClick={() => newTab({ url: "" })}
          className="flex items-center gap-3 p-4 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg transition-all text-left group"
        >
          <div className="w-8 h-8 bg-[#2a2a2a] text-gray-400 rounded flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-300 group-hover:text-gray-100">导入请求</div>
            <div className="text-xs text-gray-600">支持 Curl / JSON</div>
          </div>
        </button>
      </div>

      {/* Quick examples */}
      <div className="w-full max-w-lg">
        <p className="text-xs text-gray-600 mb-3 text-left">快速示例</p>
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.url}
              onClick={() => newTab({ method: ex.method, url: ex.url, name: ex.name })}
              className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-colors text-left group"
            >
              <span className={`text-[10px] font-bold border px-1 py-0.5 rounded flex-shrink-0 ${
                ex.method === "GET" ? "text-green-400 border-green-500/30 bg-green-500/10"
                : "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
              }`}>
                {ex.method}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-400 group-hover:text-gray-300 truncate">{ex.name}</div>
                <div className="text-[10px] text-gray-700 truncate font-mono">{ex.url}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function App() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const newTab = useAppStore((s) => s.newTab);

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "t") {
        e.preventDefault();
        newTab();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [newTab]);

  const showWelcome = tabs.length === 0 || !activeTabId;

  return (
    <div className="flex flex-col h-screen bg-[#141414] text-gray-200 overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TabBar />
          {showWelcome ? (
            <WelcomeScreen />
          ) : (
            <WorkspacePanel />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
