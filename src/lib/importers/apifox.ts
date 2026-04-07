/**
 * Apifox importer — supports two export formats:
 *
 * Format A — "API Collection" export (apifoxType / exportFormat field)
 *   { apifoxType: "apiCollection", apiCollection: [{ type: "apiDetailFolder"|"apiDetail", ... }] }
 *
 * Format B — "Project" full export (apifoxProject field) ← matches the real-world export
 *   { apifoxProject: "1.0.0", apiCollection: [{ name, id, items: [...] }], requestCollection: [...] }
 *   In Format B, nodes do NOT have a `type` field; presence of `api` field → request item.
 */

import { createId } from "@/lib/utils";
import type {
  Collection,
  CollectionItem,
  RequestConfig,
  KeyValuePair,
  RequestBody,
  RequestAuth,
  HttpMethod,
  Environment,
} from "@/types";
import type { ImportResult } from "./types";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function normalizeMethod(m?: string): HttpMethod {
  const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"];
  const upper = (m ?? "GET").toUpperCase() as HttpMethod;
  return methods.includes(upper) ? upper : "GET";
}

// ─── Format B — Project export ────────────────────────────────────────────────
// apiCollection items: { name, id, items?, api? }
// requestCollection items: { name, method, path, requestBody, parameters }

interface ProjParam {
  name?: string;
  value?: string;
  sampleValue?: string;
  example?: string;
  description?: string;
  type?: string;
  enable?: boolean;
  required?: boolean;
}

interface ProjRequestBody {
  type?: string;
  parameters?: Array<ProjParam & { type?: string }>;
  jsonSchema?: Record<string, unknown>;
  examples?: Array<{ value?: string; mediaType?: string; description?: string }>;
  example?: string;
  data?: string;
}

interface ProjApi {
  id?: string | number;
  method?: string;
  path?: string;
  parameters?: {
    query?: ProjParam[];
    header?: ProjParam[];
    path?: ProjParam[];
    cookie?: ProjParam[];
  };
  requestBody?: ProjRequestBody;
  auth?: Record<string, unknown>;
  description?: string;
}

interface ProjNode {
  name?: string;
  id?: string | number;
  parentId?: string | number;
  items?: ProjNode[];
  api?: ProjApi;
  // requestCollection items also use this shape but with top-level method/path
  method?: string;
  path?: string;
  requestBody?: ProjRequestBody;
  // parameters is shared between query/header style (apiCollection) and flat style (requestCollection)
  parameters?: Record<string, ProjParam[]> | ProjParam[];
}

interface ProjRequestFolder {
  name?: string;
  children?: ProjRequestFolder[];
  items?: ProjNode[];
}

function kvFromProjParams(params: ProjParam[] = []): KeyValuePair[] {
  return params.map((p) => ({
    id: createId(),
    key: p.name ?? "",
    value: p.value ?? p.sampleValue ?? p.example ?? "",
    description: p.description ?? "",
    enabled: p.enable !== false,
  }));
}

function bodyFromProj(rb?: ProjRequestBody): RequestBody {
  const def: RequestBody = {
    type: "none",
    rawContent: "",
    rawContentType: "application/json",
    formData: [],
    urlencoded: [],
  };
  if (!rb || !rb.type || rb.type === "none") return def;

  const ct = rb.type;

  // multipart/form-data
  if (ct === "multipart/form-data") {
    return {
      ...def,
      type: "form-data",
      formData: (rb.parameters ?? []).map((p) => ({
        id: createId(),
        key: p.name ?? "",
        value: p.value ?? p.sampleValue ?? "",
        description: p.description ?? "",
        enabled: p.enable !== false,
        type: p.type === "file" ? "file" : "text",
      })),
    };
  }

  // application/x-www-form-urlencoded
  if (ct === "application/x-www-form-urlencoded") {
    return {
      ...def,
      type: "form-urlencoded",
      urlencoded: kvFromProjParams(rb.parameters),
    };
  }

  // JSON or other
  if (ct.includes("json") || ct === "application/json") {
    // Prefer example string over schema
    let raw = "";
    if (rb.example && typeof rb.example === "string") {
      raw = rb.example;
    } else if (rb.data && typeof rb.data === "string") {
      raw = rb.data;
    } else if (rb.examples?.length) {
      const first = rb.examples[0];
      if (first.value) raw = first.value;
    } else if (rb.jsonSchema) {
      raw = genJsonFromSchema(rb.jsonSchema);
    }
    return { ...def, type: "json", rawContent: raw, rawContentType: "application/json" };
  }

  return def;
}

function genJsonFromSchema(schema: Record<string, unknown>): string {
  function extract(s: Record<string, unknown>): unknown {
    if (s.example !== undefined) return s.example;
    if (s.type === "object" && s.properties) {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s.properties as Record<string, Record<string, unknown>>)) {
        obj[k] = extract(v);
      }
      return obj;
    }
    if (s.type === "array" && s.items) return [extract(s.items as Record<string, unknown>)];
    const defaults: Record<string, unknown> = { string: "", integer: 0, number: 0, boolean: false };
    return s.default ?? defaults[s.type as string] ?? null;
  }
  try { return JSON.stringify(extract(schema), null, 2); } catch { return ""; }
}

function headersFromProjParams(params?: ProjParam[] | Record<string, ProjParam[]>): KeyValuePair[] {
  if (!params) return [];
  if (Array.isArray(params)) return kvFromProjParams(params);
  const arr = (params as Record<string, ProjParam[]>).header ?? [];
  return kvFromProjParams(arr);
}

function queryFromProjParams(params?: ProjParam[] | Record<string, ProjParam[]>): KeyValuePair[] {
  if (!params) return [];
  if (Array.isArray(params)) return [];
  const arr = (params as Record<string, ProjParam[]>).query ?? [];
  return kvFromProjParams(arr);
}

let _requestCount = 0;
let _folderCount = 0;

/** Convert a Format-B request node (has .api field) */
function convertProjApiNode(node: ProjNode, collectionId: string): RequestConfig {
  const api = node.api!;
  const now = Date.now();

  const queryKV: KeyValuePair[] = kvFromProjParams(api.parameters?.query);
  const headerKV: KeyValuePair[] = kvFromProjParams(api.parameters?.header);

  return {
    id: createId(),
    name: node.name ?? "Untitled",
    method: normalizeMethod(api.method),
    url: api.path ?? "",
    params: queryKV,
    headers: headerKV,
    body: bodyFromProj(api.requestBody),
    auth: { type: "none" },
    description: api.description ?? "",
    collectionId,
    createdAt: now,
    updatedAt: now,
  };
}

/** Convert a Format-B "quick request" node (has .method + .path directly) */
function convertProjQuickRequest(node: ProjNode, collectionId: string): RequestConfig {
  const now = Date.now();

  // parameters can be an object { query: [], header: [] } in requestCollection
  const params = node.parameters as Record<string, ProjParam[]> | undefined;

  const queryKV: KeyValuePair[] = kvFromProjParams(params?.query);
  const headerKV: KeyValuePair[] = kvFromProjParams(params?.header);

  return {
    id: createId(),
    name: node.name ?? "Untitled",
    method: normalizeMethod(node.method),
    url: node.path ?? "",
    params: queryKV,
    headers: headerKV,
    body: bodyFromProj(node.requestBody),
    auth: { type: "none" },
    description: "",
    collectionId,
    createdAt: now,
    updatedAt: now,
  };
}

function convertProjNodes(nodes: ProjNode[], collectionId: string, depth = 0): CollectionItem[] {
  return nodes.map((node, idx) => {
    // Has nested items → folder
    if (node.items && node.items.length > 0 && !node.api) {
      _folderCount++;
      return {
        id: createId(),
        name: node.name ?? "Folder",
        type: "folder" as const,
        children: convertProjNodes(node.items, collectionId, depth + 1),
        order: idx,
        expanded: depth === 0,
      };
    }

    // Has api field → request
    if (node.api) {
      _requestCount++;
      return {
        id: createId(),
        name: node.name ?? "Untitled",
        type: "request" as const,
        request: convertProjApiNode(node, collectionId),
        order: idx,
      };
    }

    // Has method + path → quick request style
    if (node.method && node.path) {
      _requestCount++;
      return {
        id: createId(),
        name: node.name ?? "Untitled",
        type: "request" as const,
        request: convertProjQuickRequest(node, collectionId),
        order: idx,
      };
    }

    // Empty folder (no items, no api) — still render as folder
    _folderCount++;
    return {
      id: createId(),
      name: node.name ?? "Folder",
      type: "folder" as const,
      children: [],
      order: idx,
      expanded: false,
    };
  });
}

function flattenRequestCollection(folders: ProjRequestFolder[], collectionId: string): CollectionItem[] {
  const result: CollectionItem[] = [];
  for (const folder of folders) {
    const folderItems = folder.items ?? [];
    if (folderItems.length === 0 && (!folder.children || folder.children.length === 0)) continue;

    const requests = folderItems.map((item, idx): CollectionItem => {
      _requestCount++;
      return {
        id: createId(),
        name: item.name ?? "Untitled",
        type: "request",
        request: convertProjQuickRequest(item as ProjNode, collectionId),
        order: idx,
      };
    });

    const subFolders = flattenRequestCollection(folder.children ?? [], collectionId);

    if (folder.name && folder.name !== "根目录") {
      _folderCount++;
      result.push({
        id: createId(),
        name: folder.name,
        type: "folder",
        children: [...requests, ...subFolders],
        order: 0,
        expanded: false,
      });
    } else {
      result.push(...requests, ...subFolders);
    }
  }
  return result;
}

// ─── Format A — API Collection export (original Apifox Collection export) ────

interface AFKVParam {
  id?: string;
  name?: string;
  type?: string;
  enable?: boolean;
  required?: boolean;
  description?: string;
  example?: string | number;
  defaultValue?: string | number;
  value?: string | number;
}

interface AFHeader {
  name?: string;
  value?: string;
  enable?: boolean;
  description?: string;
}

interface AFBodyFormItem {
  id?: string;
  name?: string;
  type?: "text" | "file";
  value?: string;
  enable?: boolean;
  description?: string;
}

interface AFBody {
  type?: string;
  jsonSchema?: Record<string, unknown>;
  rawSchema?: string;
  formDataSchema?: { properties?: Record<string, { description?: string; example?: unknown; type?: string }> };
  urlencodedSchema?: { properties?: Record<string, { description?: string; example?: unknown }> };
  form?: AFBodyFormItem[];
  rawBody?: { data?: string };
  parameters?: AFBodyFormItem[];
}

interface AFApiDetail {
  type: "apiDetail";
  api?: {
    id?: string;
    name?: string;
    method?: string;
    path?: string;
    parameters?: {
      query?: AFKVParam[];
      path?: AFKVParam[];
      header?: AFHeader[];
      cookie?: AFKVParam[];
    };
    requestBody?: AFBody;
    auth?: {
      type?: string;
      bearer?: { token?: string };
      basic?: { username?: string; password?: string };
    };
    description?: string;
    status?: string;
  };
}

interface AFFolder {
  type: "apiDetailFolder";
  id?: string;
  name?: string;
  children?: AFNode[];
  description?: string;
}

type AFNode = AFApiDetail | AFFolder | Record<string, unknown>;

function schemaPropsToKV(props: Record<string, { description?: string; example?: unknown }> = {}): KeyValuePair[] {
  return Object.entries(props).map(([key, val]) => ({
    id: createId(),
    key,
    value: String(val.example ?? ""),
    description: val.description ?? "",
    enabled: true,
  }));
}

function convertAFBody(body?: AFBody): RequestBody {
  const def: RequestBody = { type: "none", rawContent: "", rawContentType: "application/json", formData: [], urlencoded: [] };
  if (!body || body.type === "none") return def;
  const ct = body.type ?? "";

  if (ct === "application/json") {
    let raw = body.rawBody?.data ?? "";
    if (!raw && body.jsonSchema) raw = genJsonFromSchema(body.jsonSchema);
    return { ...def, type: "json", rawContent: raw, rawContentType: "application/json" };
  }
  if (ct === "application/x-www-form-urlencoded") {
    const props = body.urlencodedSchema?.properties ?? {};
    const pairs = body.parameters?.map((f) => ({ id: createId(), key: f.name ?? "", value: f.value ?? "", description: f.description ?? "", enabled: f.enable !== false, type: "text" as const })) ?? schemaPropsToKV(props);
    return { ...def, type: "form-urlencoded", urlencoded: pairs };
  }
  if (ct === "multipart/form-data") {
    const items = body.form ?? body.parameters ?? [];
    return { ...def, type: "form-data", formData: items.map((f) => ({ id: createId(), key: f.name ?? "", value: f.value ?? "", description: f.description ?? "", enabled: f.enable !== false, type: f.type === "file" ? "file" : "text" })) };
  }
  if (ct === "text/plain" || ct === "application/xml") {
    return { ...def, type: "raw", rawContent: body.rawSchema ?? body.rawBody?.data ?? "", rawContentType: ct === "application/xml" ? "application/xml" : "text/plain" };
  }
  return def;
}

function convertAFAuth(auth?: AFApiDetail["api"] extends undefined ? undefined : NonNullable<AFApiDetail["api"]>["auth"]): RequestAuth {
  if (!auth || !auth.type || auth.type === "none" || auth.type === "noauth") return { type: "none" };
  if (auth.type === "bearer") return { type: "bearer", bearerToken: auth.bearer?.token ?? "" };
  if (auth.type === "basic") return { type: "basic", basicUsername: auth.basic?.username ?? "", basicPassword: auth.basic?.password ?? "" };
  return { type: "none" };
}

function convertAFNode(node: AFNode, collectionId: string): CollectionItem | null {
  const n = node as (AFApiDetail | AFFolder);
  if (n.type === "apiDetailFolder") {
    const folder = n as AFFolder;
    _folderCount++;
    return {
      id: createId(), name: folder.name ?? "Folder", type: "folder",
      children: (folder.children ?? []).map((c) => convertAFNode(c, collectionId)).filter(Boolean) as CollectionItem[],
      order: 0, expanded: false,
    };
  }
  if (n.type === "apiDetail") {
    const detail = n as AFApiDetail;
    const api = detail.api;
    if (!api) return null;
    _requestCount++;
    const now = Date.now();
    const queryParams: KeyValuePair[] = (api.parameters?.query ?? []).map((p) => ({ id: createId(), key: p.name ?? "", value: String(p.example ?? p.defaultValue ?? ""), description: p.description ?? "", enabled: p.enable !== false }));
    const headers: KeyValuePair[] = (api.parameters?.header ?? []).map((h) => ({ id: createId(), key: h.name ?? "", value: h.value ?? "", description: h.description ?? "", enabled: h.enable !== false }));
    const request: RequestConfig = { id: createId(), name: api.name ?? "Untitled", method: normalizeMethod(api.method), url: api.path ?? "", params: queryParams, headers, body: convertAFBody(api.requestBody), auth: convertAFAuth(api.auth), description: api.description ?? "", collectionId, createdAt: now, updatedAt: now };
    return { id: createId(), name: api.name ?? "Untitled", type: "request", request, order: 0 };
  }
  return null;
}

// ─── Environment (both formats) ───────────────────────────────────────────────

interface AFEnvV2 {
  id?: string;
  name?: string;
  variables?: Array<{ id?: string; name?: string; localValue?: string; remoteValue?: string; enable?: boolean; type?: string }>;
}

function convertEnvironments(envs: AFEnvV2[]): Environment[] {
  return envs.map((env) => ({
    id: createId(),
    name: env.name ?? "Imported Env",
    variables: (env.variables ?? []).map((v) => ({
      id: createId(),
      key: v.name ?? "",
      value: v.localValue ?? v.remoteValue ?? "",
      enabled: v.enable !== false,
      secret: v.type === "secret",
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseApifox(raw: unknown): ImportResult {
  const data = raw as Record<string, unknown>;
  _requestCount = 0;
  _folderCount = 0;
  const warnings: string[] = [];

  // Detect format: Format B has `apifoxProject` field
  const isProjectExport = !!data.apifoxProject || (
    data.$schema && typeof data.$schema === "object" &&
    (data.$schema as Record<string, unknown>).type === "project"
  );

  const collectionId = createId();
  let items: CollectionItem[] = [];
  const environments = convertEnvironments((data.environments as AFEnvV2[]) ?? []);
  const projectName = (data.info as { name?: string } | undefined)?.name ?? "Apifox Import";

  if (isProjectExport) {
    // ── Format B: project export ──────────────────────────────────────────
    const apiCollection = (data.apiCollection as ProjNode[]) ?? [];
    const requestCollection = (data.requestCollection as ProjRequestFolder[]) ?? [];

    // apiCollection root nodes are the top-level folders/requests
    // Each root node may have `items` sub-array
    for (const rootNode of apiCollection) {
      const subNodes = rootNode.items ?? [];
      if (subNodes.length > 0) {
        // rootNode is a root folder — its items are the real content
        const rootName = rootNode.name;
        const converted = convertProjNodes(subNodes, collectionId, 1);
        if (rootName && rootName !== "根目录") {
          _folderCount++;
          items.push({
            id: createId(),
            name: rootName,
            type: "folder",
            children: converted,
            order: items.length,
            expanded: true,
          });
        } else {
          items.push(...converted.map((c, i) => ({ ...c, order: items.length + i })));
        }
      } else if (rootNode.api) {
        // Top-level request
        _requestCount++;
        items.push({
          id: createId(),
          name: rootNode.name ?? "Untitled",
          type: "request",
          request: convertProjApiNode(rootNode as ProjNode, collectionId),
          order: items.length,
        });
      }
    }

    // Also import requestCollection as a separate folder if it has items
    const quickItems = flattenRequestCollection(requestCollection, collectionId);
    if (quickItems.length > 0) {
      items.push({
        id: createId(),
        name: "快捷请求",
        type: "folder",
        children: quickItems,
        order: items.length,
        expanded: false,
      });
    }
  } else {
    // ── Format A: API collection export ──────────────────────────────────
    const nodes = (data.apiCollection ?? data.collection ?? []) as AFNode[];
    items = nodes.map((n) => convertAFNode(n, collectionId)).filter(Boolean) as CollectionItem[];
    if (items.length === 0) {
      warnings.push("未找到任何 API，请确认导出的是 Apifox 接口集合文件");
    }
  }

  if (_requestCount === 0 && items.length === 0) {
    warnings.push("未找到任何 API 请求，文件可能为空集合");
  }

  const collection: Collection = {
    id: collectionId,
    name: projectName,
    description: (data.info as { description?: string } | undefined)?.description ?? "",
    items,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    format: "apifox",
    collections: [collection],
    environments,
    warnings,
    stats: { requests: _requestCount, folders: _folderCount, environments: environments.length },
  };
}
