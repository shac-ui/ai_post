import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/Button";
import { getMethodBadgeColor, formatDuration } from "@/lib/utils";
import type { HistoryEntry } from "@/types";

function groupByDate(entries: HistoryEntry[]): Map<string, HistoryEntry[]> {
  const groups = new Map<string, HistoryEntry[]>();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = "今天";
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = "昨天";
    } else {
      label = `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }
  return groups;
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const openHistoryEntry = useAppStore((s) => s.openHistoryEntry);
  const deleteHistoryEntry = useAppStore((s) => s.deleteHistoryEntry);
  const method = entry.request.method;
  const url = entry.request.url;
  const status = entry.response?.status;

  const statusColor =
    !status ? "text-gray-500"
    : status < 300 ? "text-green-400"
    : status < 400 ? "text-yellow-400"
    : status < 500 ? "text-orange-400"
    : "text-red-400";

  return (
    <div
      className="group flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer rounded mx-1"
      onClick={() => openHistoryEntry(entry)}
    >
      <span className={`text-[10px] font-bold border px-1 py-0.5 rounded ${getMethodBadgeColor(method)} flex-shrink-0`}>
        {method}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-300 truncate">{url || "No URL"}</div>
        {entry.response && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] font-semibold ${statusColor}`}>{status}</span>
            <span className="text-[10px] text-gray-600">
              {formatDuration(entry.response.durationMs)}
            </span>
          </div>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(entry.id); }}
        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-0.5 rounded"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function HistorySidebar() {
  const history = useAppStore((s) => s.history);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const groups = groupByDate(history);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#222]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">历史记录</span>
        {history.length > 0 && (
          <Button
            size="xs"
            variant="ghost"
            onClick={clearHistory}
            title="清空历史"
            className="text-red-400 hover:text-red-300"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <svg className="w-8 h-8 text-gray-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-gray-600">暂无历史记录</p>
          </div>
        ) : (
          Array.from(groups.entries()).map(([label, entries]) => (
            <div key={label} className="mb-2">
              <div className="px-3 py-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                {label}
              </div>
              {entries.map((entry) => (
                <HistoryItem key={entry.id} entry={entry} />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
