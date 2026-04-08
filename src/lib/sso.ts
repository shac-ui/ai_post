/**
 * SSO / CAS 单点登录模块
 *
 * 流程：
 *   1. 检查本地是否有 token
 *      - 有 token → 正常使用；若 URL 中还残留 ticket，清除它
 *   2. 无 token，但 URL 中有 ticket
 *      - 调用后端接口用 ticket 换取 token
 *      - 换取成功 → 存储 token，刷新页面
 *      - 换取失败 → 延迟 3s 跳转 SSO 登出再重定向
 *   3. 无 token 无 ticket
 *      - 直接跳转 CAS 登录页（带 service 参数）
 */

import type { SsoConfig } from "@/types";

// ─── Token Storage ────────────────────────────────────────────────────────────

export function getToken(cfg: SsoConfig): string | null {
  const key = cfg.tokenStorageKey;
  try {
    if (cfg.tokenStorage === "localStorage") return localStorage.getItem(key);
    if (cfg.tokenStorage === "sessionStorage") return sessionStorage.getItem(key);
    if (cfg.tokenStorage === "cookie") return getCookieValue(key);
  } catch {
    // SecurityError in sandboxed iframe
  }
  return null;
}

export function setToken(cfg: SsoConfig, token: string): void {
  const key = cfg.tokenStorageKey;
  try {
    if (cfg.tokenStorage === "localStorage") { localStorage.setItem(key, token); return; }
    if (cfg.tokenStorage === "sessionStorage") { sessionStorage.setItem(key, token); return; }
    if (cfg.tokenStorage === "cookie") {
      document.cookie = `${key}=${encodeURIComponent(token)};path=/;SameSite=Lax`;
    }
  } catch {
    // ignore
  }
}

export function removeToken(cfg: SsoConfig): void {
  const key = cfg.tokenStorageKey;
  try {
    if (cfg.tokenStorage === "localStorage") { localStorage.removeItem(key); return; }
    if (cfg.tokenStorage === "sessionStorage") { sessionStorage.removeItem(key); return; }
    if (cfg.tokenStorage === "cookie") {
      document.cookie = `${key}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  } catch { /* ignore */ }
}

function getCookieValue(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function getTicketFromUrl(): string | null {
  const reg = /(^|&|\?)ticket=([^&]*?)(&|$|\/|#)/;
  if (reg.test(location.href)) return RegExp.$2;
  return null;
}

function buildServiceUrl(cfg: SsoConfig): string {
  const base = cfg.appIndexUrl || location.origin + location.pathname;
  return encodeURIComponent(base);
}

// ─── Token exchange ───────────────────────────────────────────────────────────

interface RemoteTokenResponse {
  returnCode?: number | string;
  returnMsg?: string;
  data?: unknown;
  [key: string]: unknown;
}

/** Resolve a dotted field path like "data" or "data.token" from an object */
function resolvePath(obj: Record<string, unknown>, path: string): string | null {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur != null ? String(cur) : null;
}

async function fetchRemoteToken(
  cfg: SsoConfig,
  ticket: string
): Promise<RemoteTokenResponse> {
  const baseURL = cfg.tokenApiBaseUrl.replace(/\/$/, "");
  const url = `${baseURL}${cfg.tokenApiUrl}`;
  const serviceUrl = cfg.appIndexUrl || location.origin + location.pathname;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket, clientUrl: serviceUrl }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<RemoteTokenResponse>;
}

// ─── Logout helper ────────────────────────────────────────────────────────────

function redirectToLogout(cfg: SsoConfig, delayMs = 0): void {
  const origin = buildServiceUrl(cfg);
  const logoutUrl = `${cfg.casLogoutUrl}?service=${origin}`;
  if (delayMs > 0) {
    setTimeout(() => { location.replace(logoutUrl); }, delayMs);
  } else {
    location.replace(logoutUrl);
  }
}

// ─── Main install ─────────────────────────────────────────────────────────────

export type SsoEventType = "sso:login" | "sso:token-ok" | "sso:token-fail" | "sso:error";

export interface SsoEvent {
  type: SsoEventType;
  detail?: string;
}

type SsoCallback = (event: SsoEvent) => void;

export async function installSso(
  cfg: SsoConfig,
  onEvent?: SsoCallback
): Promise<void> {
  if (!cfg.enabled) return;

  const emit = (type: SsoEventType, detail?: string) => onEvent?.({ type, detail });

  const origin = buildServiceUrl(cfg);
  const ticket = getTicketFromUrl();
  const existingToken = getToken(cfg);

  if (existingToken) {
    // Already authenticated — clean residual ticket from URL if present
    if (ticket) {
      try {
        history.replaceState(null, document.title, decodeURIComponent(cfg.appIndexUrl || location.pathname));
      } catch { /* ignore */ }
    }
    return;
  }

  if (ticket) {
    // Exchange ticket for token
    try {
      const res = await fetchRemoteToken(cfg, ticket);
      const code = Number(res.returnCode ?? res.code ?? 0);

      if (code === 200 || res.data != null) {
        const token = resolvePath(res as Record<string, unknown>, cfg.tokenField);
        if (token) {
          setToken(cfg, token);
          emit("sso:token-ok", token.slice(0, 20) + "…");
          location.reload();
        } else {
          emit("sso:token-fail", `Token 字段 "${cfg.tokenField}" 不存在于响应中`);
          console.error("[SSO] token field not found in response:", res);
          redirectToLogout(cfg, 3000);
        }
      } else {
        emit("sso:token-fail", res.returnMsg ?? String(res.returnCode));
        console.error("[SSO] 获取 token 失败：", res.returnMsg);
        redirectToLogout(cfg, 3000);
      }
    } catch (err) {
      emit("sso:error", String(err));
      console.error("[SSO] 获取 token 异常：", err);
      redirectToLogout(cfg, 3000);
    }
  } else {
    // No token, no ticket — redirect to CAS login
    emit("sso:login", cfg.casLoginUrl);
    location.replace(`${cfg.casLoginUrl}?service=${origin}`);
  }
}

/** Manual logout: clear token and redirect to CAS logout */
export function ssoLogout(cfg: SsoConfig): void {
  removeToken(cfg);
  redirectToLogout(cfg);
}
