import React from "react";
import { createKeyValuePair } from "@/lib/utils";
import type { KeyValuePair } from "@/types";

interface KeyValueEditorProps {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  descriptionColumn?: boolean;
  readOnly?: boolean;
}

export function KeyValueEditor({
  pairs,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  descriptionColumn = false,
  readOnly = false,
}: KeyValueEditorProps) {
  function update(id: string, field: keyof KeyValuePair, value: string | boolean) {
    onChange(
      pairs.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  }

  function add() {
    onChange([...pairs, createKeyValuePair()]);
  }

  function remove(id: string) {
    onChange(pairs.filter((p) => p.id !== id));
  }

  // Add a blank row if last row is not empty
  const displayPairs = [...pairs];
  const lastPair = displayPairs[displayPairs.length - 1];
  const showAddRow = !lastPair || lastPair.key.trim() !== "" || lastPair.value.trim() !== "";

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className={`grid text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-3 py-1.5 border-b border-[#222] ${descriptionColumn ? "grid-cols-[20px_1fr_1fr_1fr_28px]" : "grid-cols-[20px_1fr_1fr_28px]"} gap-2`}>
        <span />
        <span>{keyPlaceholder}</span>
        <span>{valuePlaceholder}</span>
        {descriptionColumn && <span>描述</span>}
        <span />
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {displayPairs.map((pair) => (
          <div
            key={pair.id}
            className={`group grid items-center gap-2 px-3 py-1 border-b border-[#1e1e1e] hover:bg-white/[0.02] ${
              descriptionColumn ? "grid-cols-[20px_1fr_1fr_1fr_28px]" : "grid-cols-[20px_1fr_1fr_28px]"
            } ${!pair.enabled ? "opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              checked={pair.enabled}
              onChange={(e) => update(pair.id, "enabled", e.target.checked)}
              disabled={readOnly}
              className="accent-brand-500 w-3.5 h-3.5"
            />
            <input
              value={pair.key}
              onChange={(e) => update(pair.id, "key", e.target.value)}
              placeholder={keyPlaceholder}
              readOnly={readOnly}
              className="bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:text-gray-100 py-0.5 border-b border-transparent focus:border-brand-500/50 transition-colors w-full"
            />
            <input
              value={pair.value}
              onChange={(e) => update(pair.id, "value", e.target.value)}
              placeholder={valuePlaceholder}
              readOnly={readOnly}
              className="bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:text-gray-100 py-0.5 border-b border-transparent focus:border-brand-500/50 transition-colors w-full font-mono text-xs"
            />
            {descriptionColumn && (
              <input
                value={pair.description ?? ""}
                onChange={(e) => update(pair.id, "description", e.target.value)}
                placeholder="描述 (可选)"
                readOnly={readOnly}
                className="bg-transparent text-xs text-gray-500 placeholder-gray-700 focus:outline-none focus:text-gray-400 py-0.5 border-b border-transparent focus:border-brand-500/50 transition-colors w-full"
              />
            )}
            {!readOnly && (
              <button
                onClick={() => remove(pair.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 transition-all p-1 rounded"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* Add row */}
        {!readOnly && showAddRow && (
          <button
            onClick={add}
            className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:text-brand-400 hover:bg-white/[0.02] transition-colors text-left"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加参数
          </button>
        )}
      </div>
    </div>
  );
}
