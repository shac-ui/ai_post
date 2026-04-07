/**
 * Apifox export importer
 *
 * Apifox exports "Apifox Collection" JSON:
 * {
 *   "apifoxType": "apiCollection",
 *   "info": { "name": "...", "description": "..." },
 *   "apiCollection": [ { type: "apiDetailFolder" | "apiDetail", ... } ],
 *   "environments": [ { name, variables: [ { name, value, enable } ] } ]
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
} from "@/types";
import type { ImportResult } from "./types";

// ─── Raw Apifox types ─────────────────────────────────────────────────────────

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
  type?: "none" | "application/json" | "application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain" | "application/xml";
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
  // Older format: request info directly
  id?: string;
  name?: string;
  method?: string;
  path?: string;
}

interface AFFolder {
  type: "apiDetailFolder";
  id?: string;
  name?: string;
  children?: AFNode[];
  description?: string;
}

type AFNode = AFApiDetail | AFFolder | Record<string, unknown>;

interface AFEnvVariable {
  id?: string;
  name?: string;
  localValue?: string;
  remoteValue?: string;
  enable?: boolean;
  type?: string;
}

interface AFEnvironment {
  id?: string;
  name?: string;
  variables?: AFEnvVariable[];
}

interface ApifoxExport {
  apifoxType?: string;
  exportFormat?: string;
  info?: { name?: string; description?: string };
  apiCollection?: AFNode[];
  environments?: AFEnvironment[];
  // v1 keys
  collection?: AFNode[];
  name?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeMethod(m?: string): HttpMethod {
  const methods: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"];
  const upper = (m ?? "GET").toUpperCase() as HttpMethod;
  return methods.includes(upper) ? upper : "GET";
}

function schemaPropsToKV(props: Record<string, { description?: string; example?: unknown }> = {}): KeyValuePair[] {
  return Object.entries(props).map(([key, val]) => ({
    id: createId(),
    key,
    value: String(val.example ?? ""),
    description: val.description ?? "",
    enabled: true,
  }));
}

function convertBody(body?: AFBody): RequestBody {
  const defaultBody: RequestBody = {
    type: "none",
    rawContent: "",
    rawContentType: "application/json",
    formData: [],
    urlencoded: [],
  };
  if (!body || body.type === "none") return defaultBody;

  const ct = body.type ?? "";

  if (ct === "application/json") {
    let rawContent = body.rawBody?.data ?? "";
    if (!rawContent && body.jsonSchema) {
      // Generate sample JSON from schema example
      rawContent = generateJsonFromSchema(body.jsonSchema);
    }
    return { ...defaultBody, type: "json", rawContent, rawContentType: "application/json" };
  }

  if (ct === "application/x-www-form-urlencoded") {
    const props = body.urlencodedSchema?.properties ?? {};
    const pairs = body.parameters?.map((f) => ({
      id: createId(),
      key: f.name ?? "",
      value: f.value ?? "",
      description: f.description ?? "",
      enabled: f.enable !== false,
      type: "text" as const,
    })) ?? schemaPropsToKV(props);
    return { ...defaultBody, type: "form-urlencoded", urlencoded: pairs };
  }

  if (ct === "multipart/form-data") {
    const items = body.form ?? body.parameters ?? [];
    return {
      ...defaultBody,
      type: "form-data",
      formData: items.map((f) => ({
        id: createId(),
        key: f.name ?? "",
        value: f.value ?? "",
        description: f.description ?? "",
        enabled: f.enable !== false,
        type: f.type === "file" ? "file" : "text",
      })),
    };
  }

  if (ct === "text/plain" || ct === "application/xml") {
    return {
      ...defaultBody,
      type: "raw",
      rawContent: body.rawSchema ?? body.rawBody?.data ?? "",
      rawContentType: ct === "application/xml" ? "application/xml" : "text/plain",
    };
  }

  return defaultBody;
}

function generateJsonFromSchema(schema: Record<string, unknown>): string {
  // Best-effort: traverse "example" fields in the schema
  function extract(s: Record<string, unknown>): unknown {
    if (s.example !== undefined) return s.example;
    if (s.type === "object" && s.properties) {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s.properties as Record<string, Record<string, unknown>>)) {
        obj[k] = extract(v);
      }
      return obj;
    }
    if (s.type === "array" && s.items) {
      return [extract(s.items as Record<string, unknown>)];
    }
    return s.default ?? null;
  }
  try {
    return JSON.stringify(extract(schema), null, 2);
  } catch {
    return "";
  }
}

function convertAuth(auth?: AFApiDetail["api"] extends undefined ? undefined : NonNullable<AFApiDetail["api"]>["auth"]): RequestAuth {
  if (!auth || !auth.type || auth.type === "none" || auth.type === "noauth") return { type: "none" };
  if (auth.type === "bearer") return { type: "bearer", bearerToken: auth.bearer?.token ?? "" };
  if (auth.type === "basic") {
    return { type: "basic", basicUsername: auth.basic?.username ?? "", basicPassword: auth.basic?.password ?? "" };
  }
  return { type: "none" };
}

let requestCount = 0;
let folderCount = 0;

function convertNode(node: AFNode, collectionId: string): CollectionItem | null {
  const n = node as (AFApiDetail | AFFolder);

  if (n.type === "apiDetailFolder") {
    const folder = n as AFFolder;
    folderCount++;
    return {
      id: createId(),
      name: folder.name ?? "Folder",
      type: "folder",
      children: (folder.children ?? [])
        .map((c) => convertNode(c, collectionId))
        .filter(Boolean) as CollectionItem[],
      order: 0,
      expanded: false,
    };
  }

  if (n.type === "apiDetail") {
    const detail = n as AFApiDetail;
    const api = detail.api;
    if (!api) return null;
    requestCount++;

    const now = Date.now();
    const queryParams: KeyValuePair[] = (api.parameters?.query ?? []).map((p) => ({
      id: createId(),
      key: p.name ?? "",
      value: String(p.example ?? p.defaultValue ?? ""),
      description: p.description ?? "",
      enabled: p.enable !== false,
    }));

    const headers: KeyValuePair[] = (api.parameters?.header ?? []).map((h) => ({
      id: createId(),
      key: h.name ?? "",
      value: h.value ?? "",
      description: h.description ?? "",
      enabled: h.enable !== false,
    }));

    const request: RequestConfig = {
      id: createId(),
      name: api.name ?? "Untitled",
      method: normalizeMethod(api.method),
      url: api.path ?? "",
      params: queryParams,
      headers,
      body: convertBody(api.requestBody),
      auth: convertAuth(api.auth),
      description: api.description ?? "",
      collectionId,
      createdAt: now,
      updatedAt: now,
    };

    return {
      id: createId(),
      name: api.name ?? "Untitled",
      type: "request",
      request,
      order: 0,
    };
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseApifox(raw: unknown): ImportResult {
  const data = raw as ApifoxExport;
  requestCount = 0;
  folderCount = 0;
  const warnings: string[] = [];

  const nodes = data.apiCollection ?? data.collection ?? [];
  const collectionId = createId();

  const items = nodes
    .map((n) => convertNode(n, collectionId))
    .filter(Boolean) as CollectionItem[];

  const collection: Collection = {
    id: collectionId,
    name: data.info?.name ?? data.name ?? "Apifox Import",
    description: data.info?.description ?? "",
    items,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const environments: Environment[] = (data.environments ?? []).map((env) => ({
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

  if (nodes.length === 0) {
    warnings.push("未找到任何 API，请确认导出的是 Apifox 接口集合文件");
  }

  return {
    format: "apifox",
    collections: [collection],
    environments,
    warnings,
    stats: { requests: requestCount, folders: folderCount, environments: environments.length },
  };
}
