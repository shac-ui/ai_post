import React, { useState, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { xml } from "@codemirror/lang-xml";
import { oneDark } from "@codemirror/theme-one-dark";
import { useAppStore } from "@/store/useAppStore";
import {
  getStatusColor,
  formatDuration,
  formatBytes,
  tryFormatJson,
  detectContentType,
  copyToClipboard,
} from "@/lib/utils";
import type { ResponseData, ResponseViewTab } from "@/types";

// ─── Status Bar ───────────────────────────────────────────────────────────────

function StatusBar({ response }: { response: ResponseData }) {
  const statusColor = getStatusColor(response.status);

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-[#222] flex-shrink-0 bg-[#141414]">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">状态</span>
        <span className={`text-sm font-bold ${statusColor}`}>
          {response.status || "—"}
        </span>
        <span className={`text-xs ${statusColor} opacity-70`}>
          {response.statusText}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">耗时</span>
        <span className={`text-sm font-semibold ${
          response.durationMs < 500 ? "text-green-400"
          : response.durationMs < 2000 ? "text-yellow-400"
          : "text-red-400"
        }`}>
          {formatDuration(response.durationMs)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">大小</span>
        <span className="text-sm font-semibold text-gray-300">
          {formatBytes(response.sizeBytes)}
        </span>
      </div>
    </div>
  );
}

// ─── Body Viewer ──────────────────────────────────────────────────────────────

function BodyViewer({ response }: { response: ResponseData }) {
  const [pretty, setPretty] = useState(true);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);

  const contentType = response.headers["content-type"] ?? "";
  const detectedType = detectContentType(response.body);

  const extensions = useMemo(() => {
    if (contentType.includes("json") || detectedType === "json") return [json()];
    if (contentType.includes("html") || detectedType === "html") return [html()];
    if (contentType.includes("xml")) return [xml()];
    return [];
  }, [contentType, detectedType]);

  const displayBody = useMemo(() => {
    if (!pretty) return response.body;
    if (contentType.includes("json") || detectedType === "json") {
      return tryFormatJson(response.body);
    }
    return response.body;
  }, [response.body, pretty, contentType, detectedType]);

  function handleCopy() {
    copyToClipboard(displayBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (response.isBinary) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        <div className="text-center">
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Binary 响应（{formatBytes(response.sizeBytes)}）</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e1e1e] flex-shrink-0">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setPretty(true)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              pretty ? "bg-[#2a2a2a] text-gray-200" : "text-gray-600 hover:text-gray-300"
            }`}
          >
            格式化
          </button>
          <button
            onClick={() => setPretty(false)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              !pretty ? "bg-[#2a2a2a] text-gray-200" : "text-gray-600 hover:text-gray-300"
            }`}
          >
            原始
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWordWrap((v) => !v)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              wordWrap ? "text-gray-300 bg-[#2a2a2a]" : "text-gray-600 hover:text-gray-300"
            }`}
          >
            换行
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-white/5"
          >
            {copied ? (
              <>
                <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已复制
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                复制
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={displayBody}
          theme={oneDark}
          extensions={extensions}
          editable={false}
          className="h-full text-xs"
          style={{ height: "100%" }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
          }}
        />
      </div>
    </div>
  );
}

// ─── Headers Viewer ───────────────────────────────────────────────────────────

function HeadersViewer({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  const [search, setSearch] = useState("");
  const filtered = search
    ? entries.filter(
        ([k, v]) =>
          k.toLowerCase().includes(search.toLowerCase()) ||
          v.toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#1e1e1e] flex-shrink-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="过滤 Header..."
          className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500"
        />
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#141414]">
            <tr className="text-gray-600 uppercase tracking-wider">
              <th className="text-left px-4 py-2 font-semibold border-b border-[#222] w-1/3">Key</th>
              <th className="text-left px-4 py-2 font-semibold border-b border-[#222]">Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-600">
                  {search ? "无匹配 Header" : "暂无 Header"}
                </td>
              </tr>
            ) : (
              filtered.map(([key, value]) => (
                <tr key={key} className="border-b border-[#1e1e1e] hover:bg-white/[0.02] group">
                  <td className="px-4 py-1.5 text-gray-400 font-medium break-all">{key}</td>
                  <td className="px-4 py-1.5 text-gray-300 font-mono break-all">{value}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 border-t border-[#1e1e1e] text-[10px] text-gray-600">
        {filtered.length} / {entries.length} Headers
      </div>
    </div>
  );
}

// ─── Empty / Error States ─────────────────────────────────────────────────────

function EmptyState({ status }: { status: "idle" | "loading" }) {
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
        <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm">正在发送请求...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700">
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
          d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-600">点击"发送"发起请求</p>
        <p className="text-xs text-gray-700 mt-1">响应将在这里显示</p>
      </div>
    </div>
  );
}

// ─── Response Panel ───────────────────────────────────────────────────────────

interface ResponsePanelProps {
  tabId: string;
}

export function ResponsePanel({ tabId }: ResponsePanelProps) {
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const [activeTab, setActiveTab] = useState<ResponseViewTab>("body");

  if (!tab) return null;

  if (tab.status === "idle" || tab.status === "loading") {
    return (
      <div className="flex flex-col h-full bg-[#141414]">
        <div className="px-4 py-2 border-b border-[#222] flex-shrink-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">响应</span>
        </div>
        <EmptyState status={tab.status} />
      </div>
    );
  }

  const { response } = tab;
  if (!response) return null;

  return (
    <div className="flex flex-col h-full bg-[#141414] overflow-hidden">
      <StatusBar response={response} />

      {/* Response view tabs */}
      <div className="flex items-center border-b border-[#222] flex-shrink-0">
        {(["body", "headers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`
              px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px
              ${activeTab === t
                ? "border-brand-500 text-gray-100"
                : "border-transparent text-gray-500 hover:text-gray-300"
              }
            `}
          >
            {t === "body" ? "Body" : "Headers"}
            {t === "headers" && (
              <span className="ml-1.5 text-[10px] bg-[#2a2a2a] text-gray-500 px-1 rounded">
                {Object.keys(response.headers).length}
              </span>
            )}
          </button>
        ))}

        {/* Timestamp */}
        <span className="ml-auto px-3 text-[10px] text-gray-700">
          {new Date(response.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "body" && <BodyViewer response={response} />}
        {activeTab === "headers" && <HeadersViewer headers={response.headers} />}
      </div>
    </div>
  );
}
