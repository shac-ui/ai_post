import React, { useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { RequestPanel } from "@/components/request/RequestPanel";
import { ResponsePanel } from "@/components/response/ResponsePanel";

export function WorkspacePanel() {
  const activeTabId = useAppStore((s) => s.activeTabId);
  const [splitRatio, setSplitRatio] = useState(50); // percentage for request panel
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(80, Math.max(20, ratio)));
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!activeTabId) return null;

  return (
    <div
      className={`flex flex-1 overflow-hidden ${isDragging ? "select-none cursor-col-resize" : ""}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Request Panel */}
      <div
        className="flex flex-col overflow-hidden border-r border-[#222]"
        style={{ width: `${splitRatio}%` }}
      >
        <RequestPanel tabId={activeTabId} />
      </div>

      {/* Resizer */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 flex-shrink-0 bg-[#222] hover:bg-brand-500/50 cursor-col-resize transition-colors active:bg-brand-500"
      />

      {/* Response Panel */}
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: `${100 - splitRatio - 0.1}%` }}
      >
        <ResponsePanel tabId={activeTabId} />
      </div>
    </div>
  );
}
