import { nanoid } from "nanoid";
import type {
  KeyValuePair,
  RequestConfig,
  RequestBody,
  RequestAuth,
  HttpMethod,
  Environment,
} from "@/types";

export function createId(): string {
  return nanoid(12);
}

export function createKeyValuePair(partial?: Partial<KeyValuePair>): KeyValuePair {
  return {
    id: createId(),
    key: "",
    value: "",
    description: "",
    enabled: true,
    ...partial,
  };
}

export function createDefaultBody(): RequestBody {
  return {
    type: "none",
    rawContent: "",
    rawContentType: "application/json",
    formData: [],
    urlencoded: [],
  };
}

export function createDefaultAuth(): RequestAuth {
  return { type: "none" };
}

export function createNewRequest(partial?: Partial<RequestConfig>): RequestConfig {
  const now = Date.now();
  return {
    id: createId(),
    name: "New Request",
    method: "GET",
    url: "",
    params: [],
    headers: [],
    body: createDefaultBody(),
    auth: createDefaultAuth(),
    description: "",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/** Build the final URL by merging enabled params and replacing env vars */
export function buildUrl(
  url: string,
  params: KeyValuePair[],
  env: Environment | null
): string {
  let resolved = replaceEnvVars(url, env);
  const enabled = params.filter((p) => p.enabled && p.key.trim());
  if (!enabled.length) return resolved;

  try {
    const [base, existing] = resolved.split("?");
    const searchParams = new URLSearchParams(existing);
    for (const p of enabled) {
      searchParams.set(
        replaceEnvVars(p.key, env),
        replaceEnvVars(p.value, env)
      );
    }
    return `${base}?${searchParams.toString()}`;
  } catch {
    return resolved;
  }
}

/** Replace {{VAR_NAME}} placeholders with environment variable values */
export function replaceEnvVars(text: string, env: Environment | null): string {
  if (!env) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const variable = env.variables.find(
      (v) => v.enabled && v.key === key.trim()
    );
    return variable ? variable.value : match;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "text-green-500";
  if (status >= 300 && status < 400) return "text-yellow-500";
  if (status >= 400 && status < 500) return "text-orange-500";
  if (status >= 500) return "text-red-500";
  return "text-gray-500";
}

export function getMethodColor(method: HttpMethod | string): string {
  const map: Record<string, string> = {
    GET: "text-green-400",
    POST: "text-yellow-400",
    PUT: "text-blue-400",
    PATCH: "text-purple-400",
    DELETE: "text-red-400",
    HEAD: "text-cyan-400",
    OPTIONS: "text-pink-400",
    TRACE: "text-gray-400",
  };
  return map[method.toUpperCase()] ?? "text-gray-400";
}

export function getMethodBadgeColor(method: HttpMethod | string): string {
  const map: Record<string, string> = {
    GET: "bg-green-500/15 text-green-400 border-green-500/30",
    POST: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    PUT: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    PATCH: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
    HEAD: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    OPTIONS: "bg-pink-500/15 text-pink-400 border-pink-500/30",
    TRACE: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  };
  return map[method.toUpperCase()] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
}

export function detectContentType(body: string): string {
  const trimmed = body.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.startsWith("<")) return "html";
  return "text";
}

export function tryFormatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function getAutoContentType(bodyType: string, rawContentType: string): string {
  switch (bodyType) {
    case "json":
      return "application/json";
    case "form-urlencoded":
      return "application/x-www-form-urlencoded";
    case "form-data":
      return "multipart/form-data";
    default:
      return rawContentType;
  }
}

export function serializeUrlencoded(pairs: KeyValuePair[]): string {
  return pairs
    .filter((p) => p.enabled && p.key.trim())
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join("&");
}

export function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  });
}
