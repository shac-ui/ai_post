import React, { useState, useRef, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { importFromJson, FORMAT_LABELS } from "@/lib/importers";
import type { ImportResult } from "@/lib/importers";

// ─── Step types ───────────────────────────────────────────────────────────────

type Step = "drop" | "preview" | "done";

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormatBadge({ format }: { format: string }) {
  const colors: Record<string, string> = {
    postman_v21: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    postman_v2: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    apipost: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    apifox: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    openapi3: "bg-green-500/15 text-green-400 border-green-500/30",
    swagger2: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    unknown: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  };
  return (
    <span className={`text-xs font-semibold border px-2 py-0.5 rounded ${colors[format] ?? colors.unknown}`}>
      {FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format}
    </span>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (content: string, name: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".json")) {
        setError("仅支持 .json 格式文件");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setError("");
        onFile(content, file.name);
      };
      reader.onerror = () => setError("文件读取失败");
      reader.readAsText(file, "utf-8");
    },
    [onFile]
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Supported formats hint */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {["postman_v21", "apipost", "apifox", "openapi3", "swagger2"].map((f) => (
          <FormatBadge key={f} format={f} />
        ))}
      </div>

      {/* Drop area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl
          py-10 px-6 cursor-pointer transition-all
          ${dragging
            ? "border-brand-500 bg-brand-500/5"
            : "border-[#333] hover:border-[#444] hover:bg-white/[0.02]"
          }
        `}
      >
        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${dragging ? "bg-brand-500/20" : "bg-[#2a2a2a]"}`}>
          <svg className={`w-6 h-6 ${dragging ? "text-brand-400" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div className="text-center">
          <p className={`text-sm font-medium ${dragging ? "text-brand-300" : "text-gray-400"}`}>
            {dragging ? "松开鼠标导入" : "拖拽文件到此处"}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            或 <span className="text-brand-400 hover:text-brand-300">点击选择文件</span>
          </p>
        </div>
        <p className="text-[10px] text-gray-700">仅支持 .json 格式</p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json"
        onChange={onInputChange}
        className="hidden"
      />

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Paste JSON option */}
      <PasteArea onContent={onFile} />
    </div>
  );
}

// ─── Paste area ───────────────────────────────────────────────────────────────

function PasteArea({ onContent }: { onContent: (content: string, name: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] transition-colors"
      >
        <span>或粘贴 JSON 内容</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-[#2a2a2a] p-3 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{ "info": { "name": "...", "schema": "..." }, "item": [...] }'
            className="w-full h-28 bg-[#141414] border border-[#333] rounded p-2.5 text-xs text-gray-300 placeholder-gray-700 focus:outline-none focus:border-brand-500 resize-none font-mono"
          />
          <button
            disabled={!text.trim()}
            onClick={() => {
              if (text.trim()) onContent(text.trim(), "pasted.json");
            }}
            className="self-end px-3 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
          >
            解析
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function CollectionTree({ items, depth = 0 }: { items: ImportResult["collections"][0]["items"]; depth?: number }) {
  if (!items?.length) return null;
  return (
    <div className={depth > 0 ? "ml-4" : ""}>
      {items.map((item) => (
        <div key={item.id}>
          <div className="flex items-center gap-1.5 py-0.5">
            {item.type === "folder" ? (
              <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-brand-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            )}
            <span className="text-xs text-gray-400 truncate">{item.name}</span>
            {item.type === "request" && item.request && (
              <span className="text-[10px] font-bold text-gray-600">{item.request.method}</span>
            )}
          </div>
          {item.children && <CollectionTree items={item.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}

function ImportPreview({
  result,
  filename,
  onConfirm,
  onBack,
}: {
  result: ImportResult;
  filename: string;
  onConfirm: (importCollections: boolean, importEnvs: boolean) => void;
  onBack: () => void;
}) {
  const [importCollections, setImportCollections] = useState(true);
  const [importEnvs, setImportEnvs] = useState(result.environments.length > 0);
  const [colExpanded, setColExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* File info */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
        <svg className="w-8 h-8 text-brand-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{filename}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <FormatBadge format={result.format} />
            <span className="text-xs text-gray-600">
              {result.stats.requests} 个请求
              {result.stats.folders > 0 && `，${result.stats.folders} 个文件夹`}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-yellow-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Import options */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">导入内容</p>

        {/* Collections option */}
        <label className="flex items-start gap-3 px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg cursor-pointer hover:border-[#333] transition-colors">
          <input
            type="checkbox"
            checked={importCollections}
            onChange={(e) => setImportCollections(e.target.checked)}
            className="mt-0.5 accent-brand-500"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-300">
                {result.collections.length > 1
                  ? `${result.collections.length} 个集合`
                  : result.collections[0]?.name ?? "集合"}
              </p>
              <span className="text-xs text-gray-600">
                {result.stats.requests} 请求
              </span>
            </div>

            {/* Tree preview */}
            {result.collections[0]?.items?.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={(e) => { e.preventDefault(); setColExpanded((v) => !v); }}
                  className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1"
                >
                  <svg className={`w-2.5 h-2.5 transition-transform ${colExpanded ? "rotate-90" : ""}`}
                    fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  {colExpanded ? "收起" : "展开预览"}
                </button>
                {colExpanded && (
                  <div className="mt-1.5 max-h-40 overflow-y-auto pl-1">
                    <CollectionTree items={result.collections[0].items} />
                  </div>
                )}
              </div>
            )}
          </div>
        </label>

        {/* Environments option */}
        {result.environments.length > 0 && (
          <label className="flex items-center gap-3 px-3 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg cursor-pointer hover:border-[#333] transition-colors">
            <input
              type="checkbox"
              checked={importEnvs}
              onChange={(e) => setImportEnvs(e.target.checked)}
              className="accent-brand-500"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                {result.environments.length === 1
                  ? result.environments[0].name
                  : `${result.environments.length} 个环境变量`}
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {result.environments.reduce((acc, e) => acc + e.variables.length, 0)} 个变量
              </p>
            </div>
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          重新选择
        </button>
        <button
          disabled={!importCollections && !importEnvs}
          onClick={() => onConfirm(importCollections, importEnvs)}
          className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors"
        >
          确认导入
        </button>
      </div>
    </div>
  );
}

// ─── Done ─────────────────────────────────────────────────────────────────────

function DoneStep({
  stats,
  onClose,
}: {
  stats: { collections: number; requests: number; environments: number };
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="w-14 h-14 bg-green-500/15 rounded-full flex items-center justify-center">
        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="text-lg font-bold text-gray-200">导入成功！</p>
        <p className="text-sm text-gray-500 mt-1">
          已导入 <span className="text-gray-300 font-semibold">{stats.requests}</span> 个请求
          {stats.environments > 0 && (
            <>，<span className="text-gray-300 font-semibold">{stats.environments}</span> 个环境变量</>
          )}
        </p>
      </div>
      <div className="flex gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e1e] rounded-full border border-[#2a2a2a]">
          <svg className="w-3 h-3 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          侧边栏 → 集合
        </div>
      </div>
      <button
        onClick={onClose}
        className="w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        完成
      </button>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const importCollectionsAction = useAppStore((s) => s.importCollections);
  const importEnvironmentsAction = useAppStore((s) => s.importEnvironments);
  const setSidebarView = useAppStore((s) => s.setSidebarView);

  const [step, setStep] = useState<Step>("drop");
  const [parseResult, setParseResult] = useState<ImportResult | null>(null);
  const [filename, setFilename] = useState("");
  const [parseError, setParseError] = useState("");
  const [doneStats, setDoneStats] = useState({ collections: 0, requests: 0, environments: 0 });

  function reset() {
    setStep("drop");
    setParseResult(null);
    setFilename("");
    setParseError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFile(content: string, name: string) {
    setParseError("");
    const result = importFromJson(content);
    if ("message" in result) {
      setParseError(`${result.message}${result.hint ? `\n提示：${result.hint}` : ""}`);
      return;
    }
    if (result.stats.requests === 0 && result.environments.length === 0) {
      setParseError("文件已解析但未找到任何有效数据，请确认文件格式正确");
      return;
    }
    setParseResult(result);
    setFilename(name);
    setStep("preview");
  }

  function handleConfirm(doCollections: boolean, doEnvs: boolean) {
    if (!parseResult) return;
    let reqCount = 0;
    let envCount = 0;

    if (doCollections) {
      importCollectionsAction(parseResult.collections);
      reqCount = parseResult.stats.requests;
      setSidebarView("collections");
    }
    if (doEnvs && parseResult.environments.length > 0) {
      importEnvironmentsAction(parseResult.environments);
      envCount = parseResult.environments.length;
    }

    setDoneStats({
      collections: parseResult.collections.length,
      requests: reqCount,
      environments: envCount,
    });
    setStep("done");
  }

  if (!open) return null;

  const stepTitles: Record<Step, string> = {
    drop: "导入数据",
    preview: "确认导入",
    done: "",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-lg bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl shadow-2xl">
        {/* Header */}
        {step !== "done" && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#252525]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-brand-600/20 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-gray-200">{stepTitles[step]}</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-600 hover:text-gray-300 p-1 rounded hover:bg-white/5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-5">
          {step === "drop" && (
            <>
              <DropZone onFile={handleFile} />
              {parseError && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-red-400 whitespace-pre-line">{parseError}</p>
                </div>
              )}
            </>
          )}

          {step === "preview" && parseResult && (
            <ImportPreview
              result={parseResult}
              filename={filename}
              onConfirm={handleConfirm}
              onBack={reset}
            />
          )}

          {step === "done" && (
            <DoneStep stats={doneStats} onClose={handleClose} />
          )}
        </div>
      </div>
    </div>
  );
}
