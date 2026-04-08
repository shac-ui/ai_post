/**
 * OpenAPI 3.x / Swagger 2.x importer
 *
 * Converts OpenAPI spec into a ReqHub Collection, grouping by tag.
 * Extracts servers as base URL (first server).
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

// ─── Raw OpenAPI types ────────────────────────────────────────────────────────

interface OAParameter {
  name?: string;
  in?: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  schema?: { type?: string; example?: unknown; default?: unknown };
  example?: unknown;
}

interface OAMediaType {
  schema?: Record<string, unknown>;
  example?: unknown;
  examples?: Record<string, { value?: unknown; summary?: string }>;
}

interface OARequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, OAMediaType>;
}

interface OASecurityScheme {
  type?: string;
  scheme?: string;
  in?: string;
  name?: string;
  bearerFormat?: string;
}

interface OAOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OAParameter[];
  requestBody?: OARequestBody;
  security?: Array<Record<string, string[]>>;
}

interface OpenAPI3 {
  openapi?: string;
  info?: { title?: string; description?: string; version?: string };
  servers?: Array<{ url?: string; description?: string }>;
  paths?: Record<string, Record<string, OAOperation>>;
  components?: {
    securitySchemes?: Record<string, OASecurityScheme>;
  };
  security?: Array<Record<string, string[]>>;
}

interface Swagger2 {
  swagger?: string;
  info?: { title?: string; description?: string; version?: string };
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths?: Record<string, Record<string, OAOperation>>;
  securityDefinitions?: Record<string, OASecurityScheme>;
}

type OASpec = OpenAPI3 & Swagger2;

// ─── HTTP Methods ─────────────────────────────────────────────────────────────

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl(spec: OASpec): string {
  // OpenAPI 3.x
  if (spec.servers?.length) {
    return spec.servers[0].url ?? "";
  }
  // Swagger 2.x
  if (spec.host) {
    const scheme = spec.schemes?.[0] ?? "https";
    const base = spec.basePath ?? "";
    return `${scheme}://${spec.host}${base}`;
  }
  return "";
}

function exampleFromSchema(schema?: Record<string, unknown>): unknown {
  if (!schema) return "";
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.type === "object" && schema.properties) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
      obj[k] = exampleFromSchema(v);
    }
    return obj;
  }
  if (schema.type === "array" && schema.items) {
    return [exampleFromSchema(schema.items as Record<string, unknown>)];
  }
  switch (schema.type) {
    case "string": return "string";
    case "integer":
    case "number": return 0;
    case "boolean": return false;
    default: return null;
  }
}

function convertRequestBody(rb?: OARequestBody): RequestBody {
  const defaultBody: RequestBody = {
    type: "none",
    rawContent: "",
    rawContentType: "application/json",
    formData: [],
    urlencoded: [],
  };
  if (!rb?.content) return defaultBody;

  const contentTypes = Object.keys(rb.content);

  // JSON
  const jsonKey = contentTypes.find((ct) => ct.includes("json"));
  if (jsonKey) {
    const media = rb.content[jsonKey];
    let raw = "";
    if (media.example !== undefined) {
      raw = typeof media.example === "string" ? media.example : JSON.stringify(media.example, null, 2);
    } else if (media.examples) {
      const first = Object.values(media.examples)[0];
      raw = first?.value !== undefined ? JSON.stringify(first.value, null, 2) : "";
    } else if (media.schema) {
      const sample = exampleFromSchema(media.schema as Record<string, unknown>);
      raw = sample !== null ? JSON.stringify(sample, null, 2) : "";
    }
    return { ...defaultBody, type: "json", rawContent: raw, rawContentType: "application/json" };
  }

  // Form URL-encoded
  const formKey = contentTypes.find((ct) => ct.includes("x-www-form-urlencoded"));
  if (formKey) {
    const media = rb.content[formKey];
    const props = (media.schema as Record<string, unknown> | undefined)?.properties as
      Record<string, Record<string, unknown>> | undefined;
    return {
      ...defaultBody,
      type: "form-urlencoded",
      urlencoded: Object.entries(props ?? {}).map(([key, val]) => ({
        id: createId(),
        key,
        value: String(val.example ?? val.default ?? ""),
        description: String(val.description ?? ""),
        enabled: true,
      })),
    };
  }

  // Multipart
  const multiKey = contentTypes.find((ct) => ct.includes("multipart"));
  if (multiKey) {
    const media = rb.content[multiKey];
    const props = (media.schema as Record<string, unknown> | undefined)?.properties as
      Record<string, Record<string, unknown>> | undefined;
    return {
      ...defaultBody,
      type: "form-data",
      formData: Object.entries(props ?? {}).map(([key, val]) => ({
        id: createId(),
        key,
        value: String(val.example ?? ""),
        description: String(val.description ?? ""),
        enabled: true,
        type: val.format === "binary" ? "file" : "text",
      })),
    };
  }

  // Plain text or XML
  const textKey = contentTypes.find((ct) => ct.includes("text/") || ct.includes("xml"));
  if (textKey) {
    const media = rb.content[textKey];
    return {
      ...defaultBody,
      type: "raw",
      rawContent: String(media.example ?? ""),
      rawContentType: textKey.includes("xml") ? "application/xml" : "text/plain",
    };
  }

  return defaultBody;
}

function inferAuth(
  security?: Array<Record<string, string[]>>,
  globalSecurity?: Array<Record<string, string[]>>,
  schemes?: Record<string, OASecurityScheme>
): RequestAuth {
  const effectiveSecurity = security ?? globalSecurity ?? [];
  if (!effectiveSecurity.length || !schemes) return { type: "none" };

  const firstKey = Object.keys(effectiveSecurity[0] ?? {})[0];
  if (!firstKey) return { type: "none" };

  const scheme = schemes[firstKey];
  if (!scheme) return { type: "none" };

  if (scheme.type === "http") {
    if (scheme.scheme === "bearer") return { type: "bearer", bearerToken: "" };
    if (scheme.scheme === "basic") return { type: "basic", basicUsername: "", basicPassword: "" };
  }
  if (scheme.type === "apiKey") {
    return {
      type: "api-key",
      apiKeyName: scheme.name ?? firstKey,
      apiKeyValue: "",
      apiKeyIn: scheme.in === "query" ? "query" : "header",
    };
  }

  return { type: "none" };
}

function convertOperation(
  path: string,
  method: string,
  op: OAOperation,
  baseUrl: string,
  globalSecurity: Array<Record<string, string[]>> | undefined,
  schemes: Record<string, OASecurityScheme> | undefined,
  collectionId: string
): RequestConfig {
  const now = Date.now();
  const url = baseUrl ? `${baseUrl.replace(/\/$/, "")}${path}` : path;

  const queryParams: KeyValuePair[] = [];
  const headers: KeyValuePair[] = [];

  for (const param of op.parameters ?? []) {
    const kv: KeyValuePair = {
      id: createId(),
      key: param.name ?? "",
      value: String(
        param.example ?? param.schema?.example ?? param.schema?.default ?? ""
      ),
      description: param.description ?? "",
      enabled: true,
    };
    if (param.in === "query") queryParams.push(kv);
    if (param.in === "header") headers.push(kv);
  }

  return {
    id: createId(),
    name: op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`,
    method: method.toUpperCase() as HttpMethod,
    url,
    params: queryParams,
    headers,
    body: convertRequestBody(op.requestBody),
    auth: inferAuth(op.security, globalSecurity, schemes),
    description: op.description ?? "",
    collectionId,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseOpenAPI(raw: unknown): ImportResult {
  const spec = raw as OASpec;
  const warnings: string[] = [];
  let requestCount = 0;

  const isSwagger2 = !!spec.swagger;
  const isOpenAPI3 = !!spec.openapi;

  if (!isSwagger2 && !isOpenAPI3) {
    warnings.push("无法识别 OpenAPI 版本，尝试按 OpenAPI 3.x 解析");
  }

  const baseUrl = getBaseUrl(spec);
  const securitySchemes = spec.components?.securitySchemes ?? spec.securityDefinitions ?? {};
  const globalSecurity = spec.security;
  const collectionId = createId();

  // Group by tag
  const tagGroups = new Map<string, CollectionItem[]>();
  const untagged: CollectionItem[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method.toLowerCase() as keyof typeof pathItem] as OAOperation | undefined;
      if (!op) continue;

      requestCount++;
      const request = convertOperation(
        path, method, op, baseUrl, globalSecurity, securitySchemes, collectionId
      );
      const item: CollectionItem = {
        id: createId(),
        name: request.name,
        type: "request",
        request,
        order: 0,
      };

      const tags = op.tags ?? [];
      if (tags.length === 0) {
        untagged.push(item);
      } else {
        for (const tag of tags) {
          if (!tagGroups.has(tag)) tagGroups.set(tag, []);
          tagGroups.get(tag)!.push(item);
        }
      }
    }
  }

  // Build collection items: one folder per tag
  const items: CollectionItem[] = [];
  let order = 0;
  for (const [tag, tagItems] of tagGroups.entries()) {
    items.push({
      id: createId(),
      name: tag,
      type: "folder",
      children: tagItems.map((i, idx) => ({ ...i, order: idx })),
      order: order++,
      expanded: true,
    });
  }
  items.push(...untagged.map((i, idx) => ({ ...i, order: order + idx })));

  // Server URL as environment variable
  const environments: Environment[] = [];
  if (baseUrl) {
    environments.push({
      id: createId(),
      name: `${spec.info?.title ?? "API"} - Servers`,
      variables: [
        {
          id: createId(),
          key: "BASE_URL",
          value: baseUrl,
          description: "API base URL",
          enabled: true,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  if ((spec.servers?.length ?? 0) > 1) {
    warnings.push(`发现 ${spec.servers!.length} 个服务器地址，已使用第一个：${baseUrl}`);
  }

  const collection: Collection = {
    id: collectionId,
    name: spec.info?.title ?? "OpenAPI Import",
    description: spec.info?.description ?? "",
    items,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return {
    format: isSwagger2 ? "swagger2" : "openapi3",
    collections: [collection],
    environments,
    warnings,
    stats: { requests: requestCount, folders: tagGroups.size, environments: environments.length },
  };
}
