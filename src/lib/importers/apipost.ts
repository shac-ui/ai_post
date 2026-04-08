/**
 * APIPost v7 export importer
 *
 * APIPost exports a JSON with structure:
 * {
 *   "project": { "name": "..." },
 *   "apis": [ { id, name, method, url, request: { params, headers, body }, ... } ],
 *   "groups": [ { id, name, parent_id, ... } ],
 *   "envs": [ { id, name, variables: [ { key, value, ... } ] } ]
 * }
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
  BodyType,
  ContentType,
} from "@/types";
import type { ImportResult } from "./types";

// ─── Raw APIPost types ────────────────────────────────────────────────────────

interface APRawKV {
  key?: string;
  name?: string;
  value?: string;
  not_null?: number;
  description?: string;
  is_checked?: number | boolean;
  field_type?: string;
  type?: string;
}

interface APRawBody {
  mode?: "json" | "raw" | "urlencoded" | "form-data" | "none" | "binary";
  raw?: string;
  raw_para?: APRawKV[];
  form_data?: APRawKV[];
  urlencoded?: APRawKV[];
  parameter?: APRawKV[];
}

interface APRawRequest {
  query?: APRawKV[];
  header?: APRawKV[];
  body?: APRawBody;
  auth?: {
    type?: string;
    token?: string;
    username?: string;
    password?: string;
    key?: string;
    value?: string;
    add_to?: string;
  };
  description?: string;
}

interface APRawApi {
  target_id?: string;
  id?: string;
  name?: string;
  method?: string;
  url?: string;
  request?: APRawRequest;
  group_id?: string;
  parent_id?: string;
  description?: string;
}

interface APRawGroup {
  target_id?: string;
  id?: string;
  name?: string;
  parent_id?: string;
  description?: string;
}

interface APRawEnvVar {
  key?: string;
  name?: string;
  value?: string;
  description?: string;
  is_checked?: number | boolean;
}

interface APRawEnv {
  id?: string;
  name?: string;
  variables?: APRawEnvVar[];
  parameter?: APRawEnvVar[];
}

interface APIPostExport {
  project?: { name?: string; description?: string };
  apis?: APRawApi[];
  groups?: APRawGroup[];
  envs?: APRawEnv[];
  // Older format
  target?: {
    apis?: APRawApi[];
    groups?: APRawGroup[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeMethod(m?: string): HttpMethod {
  const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"];
  const upper = (m ?? "GET").toUpperCase() as HttpMethod;
  return methods.includes(upper) ? upper : "GET";
}

function kvEnabled(item: APRawKV): boolean {
  const v = item.is_checked;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return true;
}

function convertKVList(items?: APRawKV[]): KeyValuePair[] {
  if (!items?.length) return [];
  return items.map((item) => ({
    id: createId(),
    key: item.key ?? item.name ?? "",
    value: item.value ?? "",
    description: item.description ?? "",
    enabled: kvEnabled(item),
  }));
}

function convertBody(body?: APRawBody): RequestBody {
  const defaultBody: RequestBody = {
    type: "none",
    rawContent: "",
    rawContentType: "application/json",
    formData: [],
    urlencoded: [],
  };
  if (!body || body.mode === "none") return defaultBody;

  const mode = body.mode ?? "none";

  if (mode === "json" || mode === "raw") {
    const raw = body.raw ?? "";
    const trimmed = raw.trimStart();
    const isJson = mode === "json" || trimmed.startsWith("{") || trimmed.startsWith("[");
    return {
      ...defaultBody,
      type: isJson ? "json" : "raw",
      rawContent: raw,
      rawContentType: isJson ? "application/json" : "text/plain",
    };
  }

  if (mode === "urlencoded") {
    return {
      ...defaultBody,
      type: "form-urlencoded",
      urlencoded: convertKVList(body.urlencoded ?? body.parameter),
    };
  }

  if (mode === "form-data") {
    return {
      ...defaultBody,
      type: "form-data",
      formData: convertKVList(body.form_data ?? body.parameter).map((kv) => ({
        ...kv,
        type: "text" as const,
      })),
    };
  }

  return defaultBody;
}

function convertAuth(auth?: APRawRequest["auth"]): RequestAuth {
  if (!auth || !auth.type || auth.type === "none") return { type: "none" };
  switch (auth.type) {
    case "bearer":
    case "token":
      return { type: "bearer", bearerToken: auth.token ?? "" };
    case "basic":
      return { type: "basic", basicUsername: auth.username ?? "", basicPassword: auth.password ?? "" };
    case "apikey":
    case "api_key":
      return {
        type: "api-key",
        apiKeyName: auth.key ?? "",
        apiKeyValue: auth.value ?? "",
        apiKeyIn: auth.add_to === "query" ? "query" : "header",
      };
    default:
      return { type: "none" };
  }
}

function convertApi(api: APRawApi, collectionId: string): RequestConfig {
  const req = api.request ?? {};
  const now = Date.now();
  return {
    id: createId(),
    name: api.name ?? "Untitled",
    method: normalizeMethod(api.method),
    url: api.url ?? "",
    params: convertKVList(req.query),
    headers: convertKVList(req.header),
    body: convertBody(req.body),
    auth: convertAuth(req.auth),
    description: api.description ?? req.description ?? "",
    collectionId,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Tree building ────────────────────────────────────────────────────────────

function buildTree(
  apis: APRawApi[],
  groups: APRawGroup[],
  collectionId: string
): { items: CollectionItem[]; requestCount: number; folderCount: number } {
  let requestCount = 0;
  let folderCount = 0;

  // Map group id → children group ids
  const groupChildren = new Map<string, APRawGroup[]>();
  const groupApis = new Map<string, APRawApi[]>();

  for (const g of groups) {
    const pid = g.parent_id ?? "";
    if (!groupChildren.has(pid)) groupChildren.set(pid, []);
    groupChildren.get(pid)!.push(g);
  }

  for (const a of apis) {
    const gid = a.group_id ?? a.parent_id ?? "";
    if (!groupApis.has(gid)) groupApis.set(gid, []);
    groupApis.get(gid)!.push(a);
  }

  function buildFolder(groupId: string): CollectionItem[] {
    const result: CollectionItem[] = [];
    let order = 0;

    // Sub-groups
    for (const g of groupChildren.get(groupId) ?? []) {
      const gid = g.target_id ?? g.id ?? "";
      folderCount++;
      result.push({
        id: createId(),
        name: g.name ?? "Folder",
        type: "folder",
        children: buildFolder(gid),
        order: order++,
        expanded: false,
      });
    }

    // Requests in this group
    for (const a of groupApis.get(groupId) ?? []) {
      requestCount++;
      result.push({
        id: createId(),
        name: a.name ?? "Untitled",
        type: "request",
        request: convertApi(a, collectionId),
        order: order++,
      });
    }

    return result;
  }

  const items = buildFolder("");
  return { items, requestCount, folderCount };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseAPIPost(raw: unknown): ImportResult {
  const data = raw as APIPostExport;
  const warnings: string[] = [];

  // Support both root-level and nested under target
  const apis = data.apis ?? data.target?.apis ?? [];
  const groups = data.groups ?? data.target?.groups ?? [];
  const envs = data.envs ?? [];

  const collectionId = createId();
  const { items, requestCount, folderCount } = buildTree(apis, groups, collectionId);

  const collection: Collection = {
    id: collectionId,
    name: data.project?.name ?? "APIPost Import",
    description: data.project?.description ?? "",
    items,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const environments: Environment[] = envs.map((env) => ({
    id: createId(),
    name: env.name ?? "Imported Env",
    variables: (env.variables ?? env.parameter ?? []).map((v) => ({
      id: createId(),
      key: v.key ?? v.name ?? "",
      value: v.value ?? "",
      description: v.description ?? "",
      enabled: true,
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  if (apis.length === 0) {
    warnings.push("未找到任何 API，请确认导出的是 APIPost 项目数据文件");
  }

  return {
    format: "apipost",
    collections: [collection],
    environments,
    warnings,
    stats: { requests: requestCount, folders: folderCount, environments: environments.length },
  };
}
