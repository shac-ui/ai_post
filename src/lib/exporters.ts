/**
 * Collection exporters
 *
 * Supported output formats:
 *   - reqhub   — Native JSON (lossless, re-importable)
 *   - postman  — Postman Collection v2.1
 *   - openapi  — OpenAPI 3.0 JSON (best-effort, read-only structure)
 */

import type {
  Collection,
  CollectionItem,
  RequestConfig,
  KeyValuePair,
  RequestBody,
  RequestAuth,
} from "@/types";

export type ExportFormat = "reqhub" | "postman" | "openapi";

// ─── Download helper ──────────────────────────────────────────────────────────

export function triggerDownload(content: string, filename: string, mime = "application/json"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "collection";
}

// ─── ReqHub native format ─────────────────────────────────────────────────────

interface ReqHubExport {
  __reqhub: "collection-export";
  version: "1";
  exportedAt: string;
  collections: Collection[];
}

export function exportAsReqHub(collections: Collection[]): string {
  const payload: ReqHubExport = {
    __reqhub: "collection-export",
    version: "1",
    exportedAt: new Date().toISOString(),
    collections,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadReqHub(collections: Collection[]): void {
  const name =
    collections.length === 1
      ? sanitizeFilename(collections[0].name)
      : `reqhub_collections_${Date.now()}`;
  triggerDownload(exportAsReqHub(collections), `${name}.reqhub.json`);
}

// ─── Postman v2.1 exporter ────────────────────────────────────────────────────

type PMMethod = string;

interface PMUrl {
  raw: string;
  host?: string[];
  path?: string[];
  query?: Array<{ key: string; value: string; description?: string; disabled?: boolean }>;
}

interface PMHeader {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PMBody {
  mode: "raw" | "urlencoded" | "formdata" | "none";
  raw?: string;
  urlencoded?: Array<{ key: string; value: string; description?: string; disabled?: boolean }>;
  formdata?: Array<{ key: string; value: string; description?: string; disabled?: boolean }>;
  options?: { raw?: { language?: string } };
}

interface PMAuth {
  type: string;
  bearer?: Array<{ key: string; value: string; type: string }>;
  basic?: Array<{ key: string; value: string; type: string }>;
  apikey?: Array<{ key: string; value: string; type: string }>;
}

interface PMRequest {
  method: PMMethod;
  header: PMHeader[];
  url: PMUrl;
  body?: PMBody;
  auth?: PMAuth;
  description?: string;
}

interface PMItem {
  name: string;
  item?: PMItem[];
  request?: PMRequest;
}

function buildPMUrl(req: RequestConfig): PMUrl {
  const raw = req.url || "";
  const url: PMUrl = { raw };
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    url.host = u.hostname.split(".");
    url.path = u.pathname.split("/").filter(Boolean);
    url.query = req.params
      .filter((p) => p.enabled && p.key)
      .map((p) => ({
        key: p.key,
        value: p.value,
        description: p.description,
        disabled: !p.enabled,
      }));
  } catch {
    // keep raw only
  }
  return url;
}

function buildPMHeaders(headers: KeyValuePair[]): PMHeader[] {
  return headers.map((h) => ({
    key: h.key,
    value: h.value,
    description: h.description,
    disabled: !h.enabled,
  }));
}

function buildPMBody(body: RequestBody): PMBody | undefined {
  if (body.type === "none") return undefined;

  if (body.type === "json") {
    return {
      mode: "raw",
      raw: body.rawContent,
      options: { raw: { language: "json" } },
    };
  }
  if (body.type === "raw") {
    const langMap: Record<string, string> = {
      "application/json": "json",
      "text/html": "html",
      "application/xml": "xml",
      "text/xml": "xml",
      "text/plain": "text",
    };
    return {
      mode: "raw",
      raw: body.rawContent,
      options: { raw: { language: langMap[body.rawContentType] ?? "text" } },
    };
  }
  if (body.type === "form-urlencoded") {
    return {
      mode: "urlencoded",
      urlencoded: body.urlencoded.map((p) => ({
        key: p.key,
        value: p.value,
        description: p.description,
        disabled: !p.enabled,
      })),
    };
  }
  if (body.type === "form-data") {
    return {
      mode: "formdata",
      formdata: body.formData.map((p) => ({
        key: p.key,
        value: p.value,
        description: p.description,
        disabled: !p.enabled,
      })),
    };
  }
  return undefined;
}

function buildPMAuth(auth: RequestAuth): PMAuth | undefined {
  if (auth.type === "none") return undefined;
  if (auth.type === "bearer") {
    return {
      type: "bearer",
      bearer: [{ key: "token", value: auth.bearerToken ?? "", type: "string" }],
    };
  }
  if (auth.type === "basic") {
    return {
      type: "basic",
      basic: [
        { key: "username", value: auth.basicUsername ?? "", type: "string" },
        { key: "password", value: auth.basicPassword ?? "", type: "string" },
      ],
    };
  }
  if (auth.type === "api-key") {
    return {
      type: "apikey",
      apikey: [
        { key: "key", value: auth.apiKeyName ?? "", type: "string" },
        { key: "value", value: auth.apiKeyValue ?? "", type: "string" },
        { key: "in", value: auth.apiKeyIn ?? "header", type: "string" },
      ],
    };
  }
  return undefined;
}

function collectionItemToPM(item: CollectionItem): PMItem {
  if (item.type === "folder") {
    return {
      name: item.name,
      item: (item.children ?? []).map(collectionItemToPM),
    };
  }
  const req = item.request!;
  return {
    name: item.name,
    request: {
      method: req.method,
      header: buildPMHeaders(req.headers),
      url: buildPMUrl(req),
      body: buildPMBody(req.body),
      auth: buildPMAuth(req.auth),
      description: req.description,
    },
  };
}

export function exportAsPostman(collection: Collection): string {
  const pmCollection = {
    info: {
      _postman_id: collection.id,
      name: collection.name,
      description: collection.description ?? "",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: collection.items.map(collectionItemToPM),
    variable: [] as unknown[],
  };
  return JSON.stringify(pmCollection, null, 2);
}

export function downloadPostman(collection: Collection): void {
  triggerDownload(
    exportAsPostman(collection),
    `${sanitizeFilename(collection.name)}.postman_collection.json`
  );
}

// ─── OpenAPI 3.0 exporter ─────────────────────────────────────────────────────

interface OASchema {
  type?: string;
  example?: string;
}

interface OAParam {
  name: string;
  in: "query" | "header" | "path";
  required?: boolean;
  description?: string;
  schema: OASchema;
}

interface OARequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema: Record<string, unknown>; example?: unknown }>;
}

interface OAOperation {
  operationId?: string;
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: OAParam[];
  requestBody?: OARequestBody;
  responses: Record<string, { description: string }>;
}

function buildOperationId(method: string, path: string): string {
  const clean = path.replace(/[{}]/g, "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
  return `${method.toLowerCase()}${clean}`;
}

function requestToOAOperation(req: RequestConfig, tags: string[]): OAOperation {
  const parameters: OAParam[] = [
    ...req.params
      .filter((p) => p.enabled && p.key)
      .map((p) => ({
        name: p.key,
        in: "query" as const,
        required: false,
        description: p.description,
        schema: { type: "string", example: p.value },
      })),
    ...req.headers
      .filter((h) => h.enabled && h.key)
      .map((h) => ({
        name: h.key,
        in: "header" as const,
        required: false,
        description: h.description,
        schema: { type: "string", example: h.value },
      })),
  ];

  let requestBody: OARequestBody | undefined;
  const { body } = req;
  if (body.type !== "none") {
    if (body.type === "json" || (body.type === "raw" && body.rawContentType === "application/json")) {
      let schema: Record<string, unknown> = { type: "object" };
      try {
        const parsed = JSON.parse(body.rawContent);
        schema = jsonToSchema(parsed);
      } catch { /* keep default */ }
      requestBody = {
        required: true,
        content: {
          "application/json": {
            schema,
            example: body.rawContent ? (() => { try { return JSON.parse(body.rawContent); } catch { return body.rawContent; } })() : undefined,
          },
        },
      };
    } else if (body.type === "form-urlencoded") {
      const properties: Record<string, OASchema> = {};
      body.urlencoded.filter((p) => p.key).forEach((p) => {
        properties[p.key] = { type: "string", example: p.value };
      });
      requestBody = {
        required: true,
        content: {
          "application/x-www-form-urlencoded": {
            schema: { type: "object", properties },
          },
        },
      };
    } else if (body.type === "form-data") {
      const properties: Record<string, OASchema> = {};
      body.formData.filter((p) => p.key).forEach((p) => {
        properties[p.key] = { type: p.type === "file" ? "string" : "string" };
      });
      requestBody = {
        required: true,
        content: {
          "multipart/form-data": {
            schema: { type: "object", properties },
          },
        },
      };
    } else if (body.type === "raw") {
      requestBody = {
        required: true,
        content: {
          [body.rawContentType]: { schema: { type: "string" } },
        },
      };
    }
  }

  return {
    operationId: buildOperationId(req.method, req.url),
    summary: req.name,
    description: req.description,
    tags,
    parameters: parameters.length > 0 ? parameters : undefined,
    requestBody,
    responses: { "200": { description: "成功" } },
  };
}

function jsonToSchema(value: unknown): Record<string, unknown> {
  if (value === null) return { type: "null" };
  if (typeof value === "boolean") return { type: "boolean", example: value };
  if (typeof value === "number") return { type: Number.isInteger(value) ? "integer" : "number", example: value };
  if (typeof value === "string") return { type: "string", example: value };
  if (Array.isArray(value)) {
    return { type: "array", items: value.length > 0 ? jsonToSchema(value[0]) : {} };
  }
  if (typeof value === "object" && value !== null) {
    const properties: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = jsonToSchema(v);
    }
    return { type: "object", properties };
  }
  return {};
}

function collectPaths(
  items: CollectionItem[],
  paths: Record<string, Record<string, OAOperation>>,
  tags: string[],
  parentTag?: string
) {
  for (const item of items) {
    if (item.type === "folder") {
      const tag = item.name;
      collectPaths(item.children ?? [], paths, [...tags, tag], tag);
    } else if (item.type === "request" && item.request) {
      const req = item.request;
      let path = req.url;
      try {
        const u = new URL(req.url.startsWith("http") ? req.url : `https://${req.url}`);
        path = u.pathname || "/";
      } catch {
        path = req.url || "/";
      }
      if (!paths[path]) paths[path] = {};
      const opTags = parentTag ? [parentTag] : tags.length > 0 ? [tags[tags.length - 1]] : [];
      paths[path][req.method.toLowerCase()] = requestToOAOperation(req, opTags);
    }
  }
}

export function exportAsOpenAPI(collection: Collection): string {
  const paths: Record<string, Record<string, OAOperation>> = {};
  collectPaths(collection.items, paths, []);

  // Collect unique tags
  const tagSet = new Set<string>();
  for (const methods of Object.values(paths)) {
    for (const op of Object.values(methods)) {
      (op.tags ?? []).forEach((t) => tagSet.add(t));
    }
  }

  const doc = {
    openapi: "3.0.3",
    info: {
      title: collection.name,
      description: collection.description ?? "",
      version: "1.0.0",
    },
    tags: Array.from(tagSet).map((name) => ({ name })),
    paths,
  };
  return JSON.stringify(doc, null, 2);
}

export function downloadOpenAPI(collection: Collection): void {
  triggerDownload(
    exportAsOpenAPI(collection),
    `${sanitizeFilename(collection.name)}.openapi.json`
  );
}

// ─── Batch export all collections ────────────────────────────────────────────

export function downloadAllAsReqHub(collections: Collection[]): void {
  downloadReqHub(collections);
}

// ─── Format info ──────────────────────────────────────────────────────────────

export const EXPORT_FORMAT_INFO: Record<ExportFormat, { label: string; ext: string; desc: string }> = {
  reqhub:  { label: "ReqHub 原生格式", ext: ".reqhub.json", desc: "无损导出，可完整导回 ReqHub" },
  postman: { label: "Postman v2.1",    ext: ".postman_collection.json", desc: "可导入 Postman / Insomnia" },
  openapi: { label: "OpenAPI 3.0",     ext: ".openapi.json", desc: "标准 API 规范，可导入 Swagger UI" },
};
