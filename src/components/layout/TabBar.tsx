import React, { useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getMethodColor } from "@/lib/utils";

export function TabBar() {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const newTab = useAppStore((s) => s.newTab);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  return (
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
                transition-colors duration-100 max-w-[180px]
                ${
                  isActive
                    ? "bg-[#1e1e1e] text-gray-200 border-t-2 border-t-brand-500"
                    : "bg-transparent text-gray-500 hover:bg-[#1a1a1a] hover:text-gray-300 border-t-2 border-t-transparent"
                }
              `}
            >
              <span
                className={`font-semibold text-[10px] flex-shrink-0 ${getMethodColor(method)}`}
              >
                {method}
              </span>
              <span className="truncate max-w-[100px]">
                {name !== "New Request" ? name : url || "New Request"}
              </span>
              {tab.isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
              )}
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
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* New tab button */}
      <button
        onClick={() => newTab()}
        className="flex-shrink-0 px-2 h-8 text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
        title="New Tab (Ctrl+T)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
