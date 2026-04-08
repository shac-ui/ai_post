/**
 * HTTP Service — abstracts Tauri IPC vs. browser fetch
 *
 * In Tauri (desktop), requests are proxied through Rust/reqwest,
 * which gives us:
 *   • No CORS restrictions
 *   • Full access to all headers
 *   • Accurate timing
 *
 * In the browser, requests fall back to window.fetch (CORS applies).
 */

import type {
  RequestConfig,
  ResponseData,
  KeyValuePair,
  Environment,
} from "@/types";
import {
  buildUrl,
  replaceEnvVars,
  getAutoContentType,
  serializeUrlencoded,
} from "./utils";

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface RustRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  body_type?: string;
  timeout_ms?: number;
  follow_redirects?: boolean;
}

interface RustResponse {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  duration_ms: number;
  size_bytes: number;
  is_binary: boolean;
}

async function sendViaTauri(req: RustRequest): Promise<RustResponse> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<RustResponse>("send_request", { request: req });
}

async function sendViaBrowser(
  req: RustRequest
): Promise<RustResponse> {
  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    req.timeout_ms ?? 30000
  );

  try {
    const fetchInit: RequestInit = {
      method: req.method,
      headers: req.headers,
      signal: controller.signal,
    };

    if (req.body && req.method !== "GET" && req.method !== "HEAD") {
      fetchInit.body = req.body;
    }

    const res = await fetch(req.url, fetchInit);
    const duration_ms = Math.round(performance.now() - start);

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const bodyText = await res.text();
    const size_bytes = new TextEncoder().encode(bodyText).length;

    return {
      status: res.status,
      status_text: res.statusText,
      headers,
      body: bodyText,
      duration_ms,
      size_bytes,
      is_binary: false,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildHeaders(
  configHeaders: KeyValuePair[],
  bodyType: string,
  rawContentType: string,
  auth: RequestConfig["auth"],
  env: Environment | null
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Auth headers first
  if (auth.type === "bearer" && auth.bearerToken) {
    headers["Authorization"] = `Bearer ${replaceEnvVars(auth.bearerToken, env)}`;
  } else if (auth.type === "basic" && auth.basicUsername) {
    const creds = btoa(`${auth.basicUsername}:${auth.basicPassword ?? ""}`);
    headers["Authorization"] = `Basic ${creds}`;
  } else if (
    auth.type === "api-key" &&
    auth.apiKeyName &&
    auth.apiKeyIn === "header"
  ) {
    headers[auth.apiKeyName] = replaceEnvVars(auth.apiKeyValue ?? "", env);
  }

  // Content-Type based on body type
  if (bodyType !== "none" && bodyType !== "form-data") {
    const ct = getAutoContentType(bodyType, rawContentType);
    if (ct) headers["Content-Type"] = ct;
  }

  // User-defined headers (overrides above)
  for (const h of configHeaders) {
    if (h.enabled && h.key.trim()) {
      headers[replaceEnvVars(h.key, env)] = replaceEnvVars(h.value, env);
    }
  }

  return headers;
}

function buildBody(
  config: RequestConfig,
  env: Environment | null
): string | undefined {
  const { body } = config;
  switch (body.type) {
    case "none":
      return undefined;
    case "json":
      return replaceEnvVars(body.rawContent, env);
    case "raw":
      return replaceEnvVars(body.rawContent, env);
    case "form-urlencoded":
      return serializeUrlencoded(
        body.urlencoded.map((p) => ({
          ...p,
          key: replaceEnvVars(p.key, env),
          value: replaceEnvVars(p.value, env),
        }))
      );
    default:
      return body.rawContent || undefined;
  }
}

function addApiKeyQueryParam(
  url: string,
  auth: RequestConfig["auth"],
  env: Environment | null
): string {
  if (
    auth.type === "api-key" &&
    auth.apiKeyName &&
    auth.apiKeyIn === "query"
  ) {
    try {
      const u = new URL(url);
      u.searchParams.set(
        auth.apiKeyName,
        replaceEnvVars(auth.apiKeyValue ?? "", env)
      );
      return u.toString();
    } catch {
      return url;
    }
  }
  return url;
}

export async function executeRequest(
  config: RequestConfig,
  env: Environment | null
): Promise<ResponseData> {
  let url = buildUrl(config.url, config.params, env);
  url = addApiKeyQueryParam(url, config.auth, env);

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  const headers = buildHeaders(
    config.headers,
    config.body.type,
    config.body.rawContentType,
    config.auth,
    env
  );

  const bodyStr = buildBody(config, env);

  const rustReq: RustRequest = {
    method: config.method,
    url,
    headers,
    body: bodyStr,
    body_type: config.body.type,
    timeout_ms: 30000,
    follow_redirects: true,
  };

  const raw = isTauri()
    ? await sendViaTauri(rustReq)
    : await sendViaBrowser(rustReq);

  return {
    status: raw.status,
    statusText: raw.status_text,
    headers: raw.headers,
    body: raw.body,
    durationMs: raw.duration_ms,
    sizeBytes: raw.size_bytes,
    isBinary: raw.is_binary,
    timestamp: Date.now(),
  };
}
