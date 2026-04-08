import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { installSso, ssoLogout, getToken } from "@/lib/sso";
import type { SsoConfig } from "@/types";

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-600">{hint}</p>}
    </div>
  );
}

interface SsoSettingsProps {
  onClose: () => void;
}

export function SsoSettings({ onClose }: SsoSettingsProps) {
  const ssoConfig = useAppStore((s) => s.ssoConfig);
  const updateSsoConfig = useAppStore((s) => s.updateSsoConfig);

  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  function set<K extends keyof SsoConfig>(key: K, value: SsoConfig[K]) {
    updateSsoConfig({ [key]: value } as Partial<SsoConfig>);
  }

  const inputCls =
    "w-full bg-[#1e1e1e] border border-[#333] rounded px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500 font-mono";

  const selectCls =
    "w-full bg-[#1e1e1e] border border-[#333] rounded px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500 cursor-pointer";

  async function handleTestSso() {
    setTesting(true);
    setTestMsg("");
    try {
      await installSso(ssoConfig, (evt) => {
        setTestMsg(`[${evt.type}] ${evt.detail ?? ""}`);
      });
      setTestMsg("✓ SSO 流程启动成功（如果已有 token，会保持当前状态）");
    } catch (err) {
      setTestMsg(`✗ 错误：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  }

  function handleLogout() {
    ssoLogout(ssoConfig);
  }

  const currentToken = getToken(ssoConfig);

  return (
    <div className="flex flex-col gap-5 p-5 overflow-y-auto max-h-[80vh]">
      {/* Enable toggle */}
      <div className="flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-300">启用 SSO / CAS 单点登录</p>
          <p className="text-xs text-gray-600 mt-0.5">启用后，应用加载时自动执行 CAS 认证流程</p>
        </div>
        <button
          onClick={() => set("enabled", !ssoConfig.enabled)}
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
            ssoConfig.enabled ? "bg-brand-600" : "bg-[#333]"
          }`}
        >
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            ssoConfig.enabled ? "translate-x-5" : "translate-x-1"
          }`} />
        </button>
      </div>

      {ssoConfig.enabled && (
        <>
          {/* CAS Server */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CAS 服务器</p>

            <Field label="CAS 登录地址" hint="例如：https://sso.example.com/cas/login">
              <input
                value={ssoConfig.casLoginUrl}
                onChange={(e) => set("casLoginUrl", e.target.value)}
                placeholder="https://sso.example.com/cas/login"
                className={inputCls}
              />
            </Field>

            <Field label="CAS 登出地址" hint="例如：https://sso.example.com/cas/logout">
              <input
                value={ssoConfig.casLogoutUrl}
                onChange={(e) => set("casLogoutUrl", e.target.value)}
                placeholder="https://sso.example.com/cas/logout"
                className={inputCls}
              />
            </Field>

            <Field
              label="应用首页地址（service 参数）"
              hint="CAS 认证成功后回调的地址，留空则自动使用当前页面 URL"
            >
              <input
                value={ssoConfig.appIndexUrl}
                onChange={(e) => set("appIndexUrl", e.target.value)}
                placeholder="https://myapp.example.com/"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Token API */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Token 换取接口</p>

            <Field
              label="接口 Base URL"
              hint="ticket 换 token 接口的域名部分，例如 https://api.example.com"
            >
              <input
                value={ssoConfig.tokenApiBaseUrl}
                onChange={(e) => set("tokenApiBaseUrl", e.target.value)}
                placeholder="https://api.example.com"
                className={inputCls}
              />
            </Field>

            <Field
              label="接口路径"
              hint="POST 接口路径，例如 /cas/casLogin，接收 { ticket, clientUrl } 参数"
            >
              <input
                value={ssoConfig.tokenApiUrl}
                onChange={(e) => set("tokenApiUrl", e.target.value)}
                placeholder="/cas/casLogin"
                className={inputCls}
              />
            </Field>

            <Field
              label="Token 字段路径"
              hint='响应 JSON 中 token 的字段路径，例如 "data" 或 "data.token"'
            >
              <input
                value={ssoConfig.tokenField}
                onChange={(e) => set("tokenField", e.target.value)}
                placeholder="data"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Token Storage */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Token 存储</p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="存储方式">
                <select
                  value={ssoConfig.tokenStorage}
                  onChange={(e) => set("tokenStorage", e.target.value as SsoConfig["tokenStorage"])}
                  className={selectCls}
                >
                  <option value="localStorage">localStorage</option>
                  <option value="sessionStorage">sessionStorage</option>
                  <option value="cookie">Cookie</option>
                </select>
              </Field>

              <Field label="存储 Key 名称" hint='例如 "Authorization" 或 "access_token"'>
                <input
                  value={ssoConfig.tokenStorageKey}
                  onChange={(e) => set("tokenStorageKey", e.target.value)}
                  placeholder="access_token"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          {/* Current token status */}
          <div className="flex flex-col gap-2 p-3 bg-[#141414] border border-[#2a2a2a] rounded-lg">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">当前状态</p>
            {currentToken ? (
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-green-400">已有 Token</p>
                  <p className="text-[11px] text-gray-600 mt-0.5 font-mono break-all">
                    {currentToken.length > 60 ? currentToken.slice(0, 60) + "…" : currentToken}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors flex-shrink-0"
                >
                  登出
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
                <p className="text-xs text-gray-500">未登录（无 Token）</p>
              </div>
            )}
          </div>

          {/* Test button */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleTestSso}
              disabled={testing || !ssoConfig.casLoginUrl}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
            >
              {testing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  检测中…
                </>
              ) : "测试 SSO 流程"}
            </button>

            {testMsg && (
              <p className={`text-xs px-3 py-2 rounded border ${
                testMsg.startsWith("✓")
                  ? "text-green-400 bg-green-500/10 border-green-500/20"
                  : "text-red-400 bg-red-500/10 border-red-500/20"
              }`}>
                {testMsg}
              </p>
            )}
          </div>

          {/* Integration note */}
          <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
            <p className="text-xs font-semibold text-yellow-500/80 mb-1.5">集成说明</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              启用后，应用初始化时会自动检查 URL 中的 <code className="text-gray-400">ticket</code> 参数。
              换取到 token 后，将以配置的存储方式保存，并在每次请求中通过环境变量
              <code className="text-gray-400 mx-1">{"{{" + ssoConfig.tokenStorageKey + "}}"}</code>
              引用。
            </p>
          </div>
        </>
      )}
    </div>
  );
}
