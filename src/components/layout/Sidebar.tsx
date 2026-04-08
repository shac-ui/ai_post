import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { CollectionsSidebar } from "@/components/sidebar/CollectionsSidebar";
import { HistorySidebar } from "@/components/sidebar/HistorySidebar";
import { EnvironmentsSidebar } from "@/components/sidebar/EnvironmentsSidebar";
import { TeamSidebar } from "@/components/team/TeamSidebar";

export function Sidebar() {
  const sidebarView = useAppStore((s) => s.sidebarView);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  if (!sidebarOpen) return null;

  return (
    <div className="w-60 flex-shrink-0 bg-[#161616] border-r border-[#222] flex flex-col overflow-hidden">
      {sidebarView === "collections" && <CollectionsSidebar />}
      {sidebarView === "history" && <HistorySidebar />}
      {sidebarView === "environments" && <EnvironmentsSidebar />}
      {sidebarView === "team" && <TeamSidebar />}
    </div>
  );
}
