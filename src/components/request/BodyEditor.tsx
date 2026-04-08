import React, { useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { xml } from "@codemirror/lang-xml";
import { oneDark } from "@codemirror/theme-one-dark";
import { KeyValueEditor } from "./KeyValueEditor";
import { copyToClipboard } from "@/lib/utils";
import type { RequestBody, BodyType, ContentType } from "@/types";

interface BodyEditorProps {
  body: RequestBody;
  onChange: (body: RequestBody) => void;
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: "none", label: "无" },
  { value: "json", label: "JSON" },
  { value: "form-urlencoded", label: "Form URL-Encoded" },
  { value: "form-data", label: "Form Data" },
  { value: "raw", label: "Raw Text" },
];

const RAW_CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "application/json", label: "JSON" },
  { value: "text/plain", label: "Text" },
  { value: "text/html", label: "HTML" },
  { value: "application/xml", label: "XML" },
  { value: "text/xml", label: "XML (text)" },
];

function getExtensions(contentType: ContentType) {
  if (contentType === "application/json") return [json()];
  if (contentType === "text/html") return [html()];
  if (contentType === "application/xml" || contentType === "text/xml") return [xml()];
  return [];
}

// ─── JSON toolbar ─────────────────────────────────────────────────────────────

function tryFormat(text: string): { result: string; ok: boolean } {
  try {
    return { result: JSON.stringify(JSON.parse(text), null, 2), ok: true };
  } catch {
    return { result: text, ok: false };
  }
}

function tryMinify(text: string): { result: string; ok: boolean } {
  try {
    return { result: JSON.stringify(JSON.parse(text)), ok: true };
  } catch {
    return { result: text, ok: false };
  }
}

interface JsonToolbarProps {
  value: string;
  onChange: (v: string) => void;
}

function JsonToolbar({ value, onChange }: JsonToolbarProps) {
  const [formatError, setFormatError] = useState("");
  const [copied, setCopied] = useState(false);

  function handleFormat() {
    const { result, ok } = tryFormat(value);
    if (ok) {
      onChange(result);
      setFormatError("");
    } else {
      setFormatError("JSON 语法错误，无法格式化");
      setTimeout(() => setFormatError(""), 2500);
    }
  }

  function handleMinify() {
    const { result, ok } = tryMinify(value);
    if (ok) {
      onChange(result);
      setFormatError("");
    } else {
      setFormatError("JSON 语法错误，无法压缩");
      setTimeout(() => setFormatError(""), 2500);
    }
  }

  function handleCopy() {
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleClear() {
    onChange("");
    setFormatError("");
  }

  return (
    <div className="flex items-center gap-1 px-3 py-1 border-b border-[#1e1e1e] bg-[#161616] flex-shrink-0">
      {/* Format */}
      <button
        onClick={handleFormat}
        title="格式化 JSON（Ctrl+Shift+F）"
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-200 hover:bg-white/5 rounded transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h10M4 18h6" />
        </svg>
        格式化
      </button>

      {/* Minify */}
      <button
        onClick={handleMinify}
        title="压缩 JSON（去除空白）"
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-200 hover:bg-white/5 rounded transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        </svg>
        压缩
      </button>

      <div className="w-px h-3.5 bg-[#2a2a2a] mx-0.5" />

      {/* Copy */}
      <button
        onClick={handleCopy}
        title="复制内容"
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-200 hover:bg-white/5 rounded transition-colors"
      >
        {copied ? (
          <>
            <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-400">已复制</span>
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

      {/* Clear */}
      {value && (
        <button
          onClick={handleClear}
          title="清空内容"
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          清空
        </button>
      )}

      {/* Error hint */}
      {formatError && (
        <span className="ml-2 text-[11px] text-red-400 flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatError}
        </span>
      )}

      {/* JSON validity indicator */}
      {value && !formatError && (
        <span className="ml-auto text-[10px] text-gray-700">
          {(() => {
            try { JSON.parse(value); return <span className="text-green-600">✓ 有效 JSON</span>; }
            catch { return <span className="text-yellow-600/70">⚠ 非标准 JSON</span>; }
          })()}
        </span>
      )}
    </div>
  );
}

// ─── Main BodyEditor ──────────────────────────────────────────────────────────

export function BodyEditor({ body, onChange }: BodyEditorProps) {
  function setType(type: BodyType) {
    onChange({ ...body, type });
  }

  function setRawContent(rawContent: string) {
    onChange({ ...body, rawContent });
  }

  function setRawContentType(rawContentType: ContentType) {
    onChange({ ...body, rawContentType });
  }

  const isJsonMode = body.type === "json" || (body.type === "raw" && body.rawContentType === "application/json");

  return (
    <div className="flex flex-col h-full">
      {/* Type selector row */}
      <div className="flex items-center gap-0 border-b border-[#222] px-3 py-1.5 flex-shrink-0">
        {BODY_TYPES.map((bt) => (
          <button
            key={bt.value}
            onClick={() => setType(bt.value)}
            className={`
              px-3 py-1 text-xs rounded transition-colors
              ${body.type === bt.value
                ? "bg-[#2a2a2a] text-gray-200"
                : "text-gray-600 hover:text-gray-300 hover:bg-white/5"
              }
            `}
          >
            {bt.label}
          </button>
        ))}

        {body.type === "raw" && (
          <select
            value={body.rawContentType}
            onChange={(e) => setRawContentType(e.target.value as ContentType)}
            className="ml-2 bg-[#1e1e1e] border border-[#333] rounded px-2 py-0.5 text-xs text-gray-400 focus:outline-none focus:border-brand-500"
          >
            {RAW_CONTENT_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* JSON toolbar (only for JSON mode) */}
      {isJsonMode && (
        <JsonToolbar value={body.rawContent} onChange={setRawContent} />
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {body.type === "none" && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-600">该请求没有 Body</p>
          </div>
        )}

        {(body.type === "json" || body.type === "raw") && (
          <CodeMirror
            value={body.rawContent}
            onChange={setRawContent}
            theme={oneDark}
            extensions={getExtensions(
              body.type === "json" ? "application/json" : body.rawContentType
            )}
            className="h-full text-sm"
            style={{ height: "100%" }}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              autocompletion: true,
            }}
          />
        )}

        {body.type === "form-urlencoded" && (
          <KeyValueEditor
            pairs={body.urlencoded}
            onChange={(pairs) => onChange({ ...body, urlencoded: pairs })}
            keyPlaceholder="Key"
            valuePlaceholder="Value"
          />
        )}

        {body.type === "form-data" && (
          <KeyValueEditor
            pairs={body.formData}
            onChange={(pairs) => onChange({ ...body, formData: pairs as RequestBody["formData"] })}
            keyPlaceholder="Key"
            valuePlaceholder="Value"
          />
        )}
      </div>
    </div>
  );
}
