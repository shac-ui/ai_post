import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { Tooltip } from "@/components/ui/Tooltip";
import type { SidebarView } from "@/types";

interface NavItem {
  id: SidebarView;
  label: string;
  icon: React.ReactNode;
}

const CollectionIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);

const HistoryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EnvIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
  </svg>
);

const TeamIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const navItems: NavItem[] = [
  { id: "collections", label: "集合", icon: <CollectionIcon /> },
  { id: "history", label: "历史", icon: <HistoryIcon /> },
  { id: "environments", label: "环境变量", icon: <EnvIcon /> },
  { id: "team", label: "团队共享", icon: <TeamIcon /> },
];

export function ActivityBar() {
  const sidebarView = useAppStore((s) => s.sidebarView);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarView = useAppStore((s) => s.setSidebarView);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  function handleClick(id: SidebarView) {
    if (sidebarView === id && sidebarOpen) {
      toggleSidebar();
    } else {
      setSidebarView(id);
      if (!sidebarOpen) toggleSidebar();
    }
  }

  return (
    <div className="flex flex-col items-center w-12 bg-[#111] border-r border-[#222] flex-shrink-0 py-2 gap-1">
      {navItems.map((item) => {
        const isActive = sidebarView === item.id && sidebarOpen;
        return (
          <Tooltip key={item.id} content={item.label} placement="right">
            <button
              onClick={() => handleClick(item.id)}
              className={`
                w-9 h-9 rounded flex items-center justify-center transition-colors
                ${isActive
                  ? "bg-brand-600/20 text-brand-400"
                  : "text-gray-600 hover:text-gray-300 hover:bg-white/5"
                }
              `}
            >
              {item.icon}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
