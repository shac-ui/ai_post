/**
 * Postman Collection Format v2.0 / v2.1 importer
 *
 * Spec: https://schema.getpostman.com/collection/json/v2.1.0/draft-07/docs/index.html
 */

import { createId, createKeyValuePair } from "@/lib/utils";
import type {
  Collection,
  CollectionItem,
  RequestConfig,
  KeyValuePair,
  RequestBody,
  RequestAuth,
  HttpMethod,
  Environment,
  BodyType,
  ContentType,
} from "@/types";
import type { ImportResult } from "./types";

// ─── Raw Postman types ────────────────────────────────────────────────────────

interface PMUrl {
  raw?: string;
  host?: string[];
  path?: string[];
  query?: Array<{ key: string; value: string; description?: string; disabled?: boolean }>;
  variable?: Array<{ key: string; value: string; description?: string }>;
}

interface PMHeader {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PMBody {
  mode?: "raw" | "urlencoded" | "formdata" | "file" | "graphql";
  raw?: string;
  urlencoded?: Array<{ key: string; value: string; description?: string; disabled?: boolean }>;
  formdata?: Array<{ key: string; value: string; description?: string; disabled?: boolean; type?: string }>;
  options?: { raw?: { language?: string } };
  graphql?: { query?: string; variables?: string };
}

interface PMAuth {
  type?: string;
  bearer?: Array<{ key: string; value: string }>;
  basic?: Array<{ key: string; value: string }>;
  apikey?: Array<{ key: string; value: string }>;
}

interface PMRequest {
  method?: string;
  header?: PMHeader[];
  url?: string | PMUrl;
  body?: PMBody;
  auth?: PMAuth;
  description?: string | { content?: string };
}

interface PMItem {
  id?: string;
  name?: string;
  request?: PMRequest;
  item?: PMItem[];
  description?: string | { content?: string };
}

interface PMVariable {
  id?: string;
  key?: string;
  name?: string;
  value?: string;
  description?: string;
  disabled?: boolean;
  type?: string;
}

interface PMCollection {
  info?: {
    name?: string;
    schema?: string;
    description?: string | { content?: string };
  };
  item?: PMItem[];
  variable?: PMVariable[];
  auth?: PMAuth;
}

interface PMEnvironment {
  id?: string;
  name?: string;
  values?: Array<{ key?: string; name?: string; value?: string; enabled?: boolean; type?: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(val: string | { content?: string } | undefined): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val.content ?? "";
}

function normalizeUrl(url: string | PMUrl | undefined): string {
  if (!url) return "";
  if (typeof url === "string") return url;
  if (url.raw) return url.raw;

  const host = Array.isArray(url.host) ? url.host.join(".") : "";
  const path = Array.isArray(url.path) ? "/" + url.path.join("/") : "";
  const query = Array.isArray(url.query) && url.query.length
    ? "?" + url.query.map((q) => `${q.key}=${q.value}`).join("&")
    : "";
  return `${host}${path}${query}`;
}

function normalizeMethod(m?: string): HttpMethod {
  const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"];
  const upper = (m ?? "GET").toUpperCase() as HttpMethod;
  return methods.includes(upper) ? upper : "GET";
}

function convertHeaders(headers?: PMHeader[]): KeyValuePair[] {
  if (!headers?.length) return [];
  return headers.map((h) => ({
    id: createId(),
    key: h.key ?? "",
    value: h.value ?? "",
    description: h.description ?? "",
    enabled: !h.disabled,
  }));
}

function convertQueryParams(url?: string | PMUrl): KeyValuePair[] {
  if (!url || typeof url === "string") return [];
  if (!url.query?.length) return [];
  return url.query.map((q) => ({
    id: createId(),
    key: q.key ?? "",
    value: q.value ?? "",
    description: q.description ?? "",
    enabled: !q.disabled,
  }));
}

function detectRawBodyType(body: PMBody): { type: BodyType; contentType: ContentType } {
  const lang = body.options?.raw?.language ?? "";
  if (lang === "json") return { type: "json", contentType: "application/json" };
  if (lang === "xml") return { type: "raw", contentType: "application/xml" };
  if (lang === "html") return { type: "raw", contentType: "text/html" };

  // Try auto-detect from content
  const raw = (body.raw ?? "").trimStart();
  if (raw.startsWith("{") || raw.startsWith("[")) return { type: "json", contentType: "application/json" };
  return { type: "raw", contentType: "text/plain" };
}

function convertBody(body?: PMBody): RequestBody {
  const defaultBody: RequestBody = {
    type: "none",
    rawContent: "",
    rawContentType: "application/json",
    formData: [],
    urlencoded: [],
  };
  if (!body || !body.mode) return defaultBody;

  switch (body.mode) {
    case "raw": {
      const { type, contentType } = detectRawBodyType(body);
      return { ...defaultBody, type, rawContent: body.raw ?? "", rawContentType: contentType };
    }
    case "urlencoded":
      return {
        ...defaultBody,
        type: "form-urlencoded",
        urlencoded: (body.urlencoded ?? []).map((item) => ({
          id: createId(),
          key: item.key ?? "",
          value: item.value ?? "",
          description: item.description ?? "",
          enabled: !item.disabled,
        })),
      };
    case "formdata":
      return {
        ...defaultBody,
        type: "form-data",
        formData: (body.formdata ?? []).map((item) => ({
          id: createId(),
          key: item.key ?? "",
          value: item.value ?? "",
          description: item.description ?? "",
          enabled: !item.disabled,
          type: item.type === "file" ? "file" : "text",
        })),
      };
    case "graphql":
      return {
        ...defaultBody,
        type: "json",
        rawContent: JSON.stringify(
          { query: body.graphql?.query ?? "", variables: body.graphql?.variables ?? "" },
          null,
          2
        ),
        rawContentType: "application/json",
      };
    default:
      return defaultBody;
  }
}

function getAuthValue(arr: Array<{ key: string; value: string }>, key: string): string {
  return arr.find((x) => x.key === key)?.value ?? "";
}

function convertAuth(auth?: PMAuth): RequestAuth {
  if (!auth || !auth.type || auth.type === "noauth") return { type: "none" };

  switch (auth.type) {
    case "bearer": {
      const token = getAuthValue(auth.bearer ?? [], "token");
      return { type: "bearer", bearerToken: token };
    }
    case "basic": {
      const basicArr = auth.basic ?? [];
      return {
        type: "basic",
        basicUsername: getAuthValue(basicArr, "username"),
        basicPassword: getAuthValue(basicArr, "password"),
      };
    }
    case "apikey": {
      const apikeyArr = auth.apikey ?? [];
      const inHeader = getAuthValue(apikeyArr, "in") !== "query";
      return {
        type: "api-key",
        apiKeyName: getAuthValue(apikeyArr, "key"),
        apiKeyValue: getAuthValue(apikeyArr, "value"),
        apiKeyIn: inHeader ? "header" : "query",
      };
    }
    default:
      return { type: "none" };
  }
}

function convertRequest(item: PMItem, collectionId: string): RequestConfig {
  const req = item.request ?? {};
  const now = Date.now();
  const urlRaw = typeof req.url === "string" ? req.url : (req.url?.raw ?? "");

  return {
    id: createId(),
    name: item.name ?? "Untitled",
    method: normalizeMethod(req.method),
    url: urlRaw,
    params: convertQueryParams(req.url),
    headers: convertHeaders(req.header),
    body: convertBody(req.body),
    auth: convertAuth(req.auth),
    description: extractText(req.description),
    collectionId,
    createdAt: now,
    updatedAt: now,
  };
}

let requestCount = 0;
let folderCount = 0;

function convertItems(items: PMItem[], collectionId: string): CollectionItem[] {
  return items.map((item, idx) => {
    if (item.item && item.item.length > 0) {
      // Folder
      folderCount++;
      return {
        id: createId(),
        name: item.name ?? "Folder",
        type: "folder" as const,
        children: convertItems(item.item, collectionId),
        order: idx,
        expanded: false,
      };
    } else {
      // Request
      requestCount++;
      return {
        id: createId(),
        name: item.name ?? "Untitled",
        type: "request" as const,
        request: convertRequest(item, collectionId),
        order: idx,
      };
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parsePostmanCollection(raw: unknown): ImportResult {
  const data = raw as PMCollection;
  const warnings: string[] = [];
  requestCount = 0;
  folderCount = 0;

  const collectionId = createId();
  const items = convertItems(data.item ?? [], collectionId);

  // Collection-level variables → embedded environment
  const environments: Environment[] = [];
  if (data.variable && data.variable.length > 0) {
    const vars = data.variable
      .filter((v) => v.key || v.name)
      .map((v) => ({
        id: createId(),
        key: v.key ?? v.name ?? "",
        value: v.value ?? "",
        description: v.description ?? "",
        enabled: !v.disabled,
        secret: v.type === "secret",
      }));
    if (vars.length > 0) {
      environments.push({
        id: createId(),
        name: `${data.info?.name ?? "Imported"} Variables`,
        variables: vars,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  const schema = data.info?.schema ?? "";
  const format = schema.includes("v2.1") ? "postman_v21" : "postman_v2";

  const collection: Collection = {
    id: collectionId,
    name: data.info?.name ?? "Imported Collection",
    description: extractText(data.info?.description),
    items,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    format,
    collections: [collection],
    environments,
    warnings,
    stats: {
      requests: requestCount,
      folders: folderCount,
      environments: environments.length,
    },
  };
}

/** Parse a standalone Postman environment export */
export function parsePostmanEnvironment(raw: unknown): Environment | null {
  const data = raw as { environment?: PMEnvironment; id?: string; name?: string; values?: PMEnvironment["values"] };
  const env: PMEnvironment = data.environment ?? (data as PMEnvironment);
  if (!env.name && !env.values) return null;

  return {
    id: createId(),
    name: env.name ?? "Imported Environment",
    variables: (env.values ?? []).map((v) => ({
      id: createId(),
      key: v.key ?? v.name ?? "",
      value: v.value ?? "",
      enabled: v.enabled !== false,
      secret: v.type === "secret",
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
