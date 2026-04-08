import React from "react";
import { Input } from "@/components/ui/Input";
import type { RequestAuth } from "@/types";

interface AuthEditorProps {
  auth: RequestAuth;
  onChange: (auth: RequestAuth) => void;
}

type AuthType = RequestAuth["type"];

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: "none", label: "无认证" },
  { value: "bearer", label: "Bearer Token" },
  { value: "basic", label: "Basic Auth" },
  { value: "api-key", label: "API Key" },
];

export function AuthEditor({ auth, onChange }: AuthEditorProps) {
  function set<K extends keyof RequestAuth>(field: K, value: RequestAuth[K]) {
    onChange({ ...auth, [field]: value });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Type selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400 font-medium">认证类型</label>
        <div className="flex gap-2 flex-wrap">
          {AUTH_TYPES.map((at) => (
            <button
              key={at.value}
              onClick={() => onChange({ ...auth, type: at.value })}
              className={`
                px-3 py-1.5 text-xs rounded border transition-colors
                ${auth.type === at.value
                  ? "bg-brand-600/20 border-brand-500/50 text-brand-300"
                  : "bg-transparent border-[#333] text-gray-500 hover:border-[#444] hover:text-gray-300"
                }
              `}
            >
              {at.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fields */}
      {auth.type === "bearer" && (
        <Input
          label="Token"
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          value={auth.bearerToken ?? ""}
          onChange={(e) => set("bearerToken", e.target.value)}
        />
      )}

      {auth.type === "basic" && (
        <div className="flex flex-col gap-3">
          <Input
            label="用户名"
            placeholder="username"
            value={auth.basicUsername ?? ""}
            onChange={(e) => set("basicUsername", e.target.value)}
          />
          <Input
            label="密码"
            type="password"
            placeholder="password"
            value={auth.basicPassword ?? ""}
            onChange={(e) => set("basicPassword", e.target.value)}
          />
        </div>
      )}

      {auth.type === "api-key" && (
        <div className="flex flex-col gap-3">
          <Input
            label="参数名"
            placeholder="X-API-Key"
            value={auth.apiKeyName ?? ""}
            onChange={(e) => set("apiKeyName", e.target.value)}
          />
          <Input
            label="参数值"
            placeholder="your-api-key"
            value={auth.apiKeyValue ?? ""}
            onChange={(e) => set("apiKeyValue", e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-400 font-medium">传递位置</label>
            <div className="flex gap-2">
              {(["header", "query"] as const).map((loc) => (
                <button
                  key={loc}
                  onClick={() => set("apiKeyIn", loc)}
                  className={`
                    px-3 py-1.5 text-xs rounded border transition-colors
                    ${auth.apiKeyIn === loc
                      ? "bg-brand-600/20 border-brand-500/50 text-brand-300"
                      : "bg-transparent border-[#333] text-gray-500 hover:text-gray-300"
                    }
                  `}
                >
                  {loc === "header" ? "Header" : "Query 参数"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {auth.type === "none" && (
        <p className="text-sm text-gray-600">
          该请求不需要认证信息。
        </p>
      )}
    </div>
  );
}
