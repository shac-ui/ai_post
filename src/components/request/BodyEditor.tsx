import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { xml } from "@codemirror/lang-xml";
import { oneDark } from "@codemirror/theme-one-dark";
import { KeyValueEditor } from "./KeyValueEditor";
import { createKeyValuePair } from "@/lib/utils";
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

  return (
    <div className="flex flex-col h-full">
      {/* Type selector */}
      <div className="flex items-center gap-0 border-b border-[#222] px-3 py-1.5">
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

        {(body.type === "raw") && (
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

      {/* Content */}
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
