import React, { useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { executeRequest } from "@/lib/httpService";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { KeyValueEditor } from "./KeyValueEditor";
import { BodyEditor } from "./BodyEditor";
import { AuthEditor } from "./AuthEditor";
import { getMethodBadgeColor, createId } from "@/lib/utils";
import type { HttpMethod, RequestViewTab, KeyValuePair, RequestConfig } from "@/types";

const HTTP_METHODS: HttpMethod[] = [
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
];

interface RequestPanelProps {
  tabId: string;
}

function MethodSelector({
  method,
  onChange,
}: {
  method: HttpMethod;
  onChange: (m: HttpMethod) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`
          flex items-center gap-1.5 h-9 px-3 rounded-l border border-[#333] border-r-0
          text-sm font-bold bg-[#1a1a1a] hover:bg-[#222] transition-colors select-none
          ${getMethodBadgeColor(method)}
        `}
      >
        {method}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-32 bg-[#1e1e1e] border border-[#333] rounded shadow-xl overflow-hidden">
            {HTTP_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => { onChange(m); setOpen(false); }}
                className={`
                  w-full text-left px-3 py-2 text-xs font-bold hover:bg-white/5 transition-colors
                  ${m === method ? "bg-white/5" : ""}
                  ${getMethodBadgeColor(m).split(" ")[1]}
                `}
              >
                {m}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function URLBar({
  url,
  method,
  onUrlChange,
  onMethodChange,
  onSend,
  isSending,
}: {
  url: string;
  method: HttpMethod;
  onUrlChange: (url: string) => void;
  onMethodChange: (m: HttpMethod) => void;
  onSend: () => void;
  isSending: boolean;
}) {
  return (
    <div className="flex items-center gap-0 px-4 py-2.5 border-b border-[#222] flex-shrink-0">
      <MethodSelector method={method} onChange={onMethodChange} />
      <input
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !isSending && onSend()}
        placeholder="输入请求 URL（支持 {{变量}} 语法）..."
        className="
          flex-1 h-9 px-3 bg-[#1a1a1a] border border-[#333] text-sm text-gray-200
          placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1
          focus:ring-brand-500/20 transition-colors font-mono
        "
      />
      <button
        onClick={onSend}
        disabled={isSending || !url.trim()}
        className="
          h-9 px-5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-600/40
          disabled:cursor-not-allowed text-white text-sm font-semibold rounded-r
          transition-colors flex items-center gap-2 flex-shrink-0
        "
      >
        {isSending ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            发送中
          </>
        ) : (
          "发 送"
        )}
      </button>
    </div>
  );
}

const REQUEST_TABS = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
  { id: "description", label: "描述" },
] as const;

export function RequestPanel({ tabId }: RequestPanelProps) {
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const updateTabRequest = useAppStore((s) => s.updateTabRequest);
  const setTabResponse = useAppStore((s) => s.setTabResponse);
  const setTabStatus = useAppStore((s) => s.setTabStatus);
  const addToHistory = useAppStore((s) => s.addToHistory);
  const getActiveEnvironment = useAppStore((s) => s.getActiveEnvironment);
  const collections = useAppStore((s) => s.collections);
  const addToCollection = useAppStore((s) => s.addToCollection);

  const [activeTab, setActiveTab] = useState<RequestViewTab>("params");
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);

  const request = tab?.request;

  const update = useCallback(
    (partial: Partial<RequestConfig>) => {
      updateTabRequest(tabId, partial);
    },
    [tabId, updateTabRequest]
  );

  async function handleSend() {
    if (!request || !request.url.trim()) return;
    setTabStatus(tabId, "loading");
    const env = getActiveEnvironment();
    try {
      const response = await executeRequest(request, env);
      setTabResponse(tabId, response);
      setTabStatus(tabId, response.status >= 400 ? "error" : "success");
      addToHistory({
        id: createId(),
        request: { ...request },
        response,
        timestamp: Date.now(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setTabResponse(tabId, {
        status: 0,
        statusText: "Request Failed",
        headers: {},
        body: message,
        durationMs: 0,
        sizeBytes: 0,
        isBinary: false,
        timestamp: Date.now(),
      });
      setTabStatus(tabId, "error");
    }
  }

  function handleSaveToCollection(collectionId: string) {
    if (!request) return;
    addToCollection(collectionId, request);
    setSaveMenuOpen(false);
  }

  if (!request) return null;

  const paramsCount = request.params.filter((p) => p.enabled && p.key).length;
  const headersCount = request.headers.filter((h) => h.enabled && h.key).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Request name + actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1e1e1e] flex-shrink-0">
        <input
          value={request.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="请求名称"
          className="bg-transparent text-sm font-semibold text-gray-300 placeholder-gray-600 focus:outline-none flex-1 min-w-0"
        />
        {/* Save to collection */}
        <div className="relative">
          <Button size="xs" variant="ghost" onClick={() => setSaveMenuOpen((v) => !v)}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            保存
          </Button>
          {saveMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSaveMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-48 bg-[#1e1e1e] border border-[#333] rounded shadow-xl">
                {collections.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-gray-500 text-center">暂无集合，请先创建</p>
                ) : (
                  collections.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => handleSaveToCollection(col.id)}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                    >
                      {col.name}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* URL Bar */}
      <URLBar
        url={request.url}
        method={request.method}
        onUrlChange={(url) => update({ url })}
        onMethodChange={(method) => update({ method })}
        onSend={handleSend}
        isSending={tab?.status === "loading"}
      />

      {/* Request tabs */}
      <div className="flex items-center border-b border-[#222] flex-shrink-0">
        {REQUEST_TABS.map((t) => {
          const badge =
            t.id === "params" && paramsCount > 0 ? paramsCount
            : t.id === "headers" && headersCount > 0 ? headersCount
            : null;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px
                ${activeTab === t.id
                  ? "border-brand-500 text-gray-100"
                  : "border-transparent text-gray-500 hover:text-gray-300"
                }
              `}
            >
              {t.label}
              {badge !== null && (
                <span className="px-1 py-0.5 text-[9px] bg-brand-600/30 text-brand-300 rounded">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "params" && (
          <KeyValueEditor
            pairs={request.params}
            onChange={(params) => update({ params })}
            keyPlaceholder="参数名"
            valuePlaceholder="参数值"
            descriptionColumn
          />
        )}
        {activeTab === "headers" && (
          <KeyValueEditor
            pairs={request.headers}
            onChange={(headers) => update({ headers })}
            keyPlaceholder="Header 名"
            valuePlaceholder="Header 值"
            descriptionColumn
          />
        )}
        {activeTab === "body" && (
          <BodyEditor
            body={request.body}
            onChange={(body) => update({ body })}
          />
        )}
        {activeTab === "auth" && (
          <AuthEditor
            auth={request.auth}
            onChange={(auth) => update({ auth })}
          />
        )}
        {activeTab === "description" && (
          <div className="p-4">
            <textarea
              value={request.description ?? ""}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="请求描述（支持 Markdown）..."
              className="w-full h-40 bg-[#1e1e1e] border border-[#333] rounded p-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-y font-mono"
            />
          </div>
        )}
      </div>
    </div>
  );
}
