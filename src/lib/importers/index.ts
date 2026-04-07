/**
 * Auto-detect import format and dispatch to the correct parser.
 */

import type { ImportResult, ImportFormat, ImportError } from "./types";
import { parsePostmanCollection, parsePostmanEnvironment } from "./postman";
import { parseAPIPost } from "./apipost";
import { parseApifox } from "./apifox";
import { parseOpenAPI } from "./openapi";
import type { Environment } from "@/types";

export type { ImportResult, ImportFormat, ImportError };

// ─── Format detection ─────────────────────────────────────────────────────────

function detectFormat(data: unknown): ImportFormat {
  if (!data || typeof data !== "object") return "unknown";
  const d = data as Record<string, unknown>;

  // Postman collection
  if (d.info && typeof d.info === "object") {
    const schema = (d.info as Record<string, unknown>).schema;
    if (typeof schema === "string" && schema.includes("postman")) {
      return schema.includes("v2.1") ? "postman_v21" : "postman_v2";
    }
  }

  // Postman v2.0 without explicit schema check (has "info" and "item")
  if (d.info && d.item) {
    const schema = (d.info as Record<string, unknown>).schema ?? "";
    if (typeof schema === "string" && schema.includes("postman")) {
      return "postman_v2";
    }
    // Still likely postman
    if (Array.isArray(d.item)) return "postman_v2";
  }

  // Apifox — project export: apifoxProject field, or $schema.app === "apifox"
  if (d.apifoxProject) return "apifox";
  if (
    d.$schema &&
    typeof d.$schema === "object" &&
    (d.$schema as Record<string, unknown>).app === "apifox"
  ) {
    return "apifox";
  }
  // Apifox — collection export: apifoxType or exportFormat
  if (d.apifoxType || (d.exportFormat && String(d.exportFormat).includes("apifox"))) {
    return "apifox";
  }
  // Apifox also uses apiCollection (fallback)
  if (d.apiCollection && Array.isArray(d.apiCollection)) {
    return "apifox";
  }

  // APIPost — has "project" + "apis" or "target" with apis
  if ((d.project && d.apis) || (d.target && (d.target as Record<string, unknown>).apis)) {
    return "apipost";
  }
  // APIPost also has groups + apis at root
  if (d.apis && Array.isArray(d.apis)) {
    return "apipost";
  }

  // OpenAPI 3.x
  if (typeof d.openapi === "string" && d.openapi.startsWith("3")) {
    return "openapi3";
  }

  // Swagger 2.x
  if (typeof d.swagger === "string" && d.swagger.startsWith("2")) {
    return "swagger2";
  }

  // OpenAPI / Swagger with paths (sometimes version is missing)
  if (d.paths && typeof d.paths === "object") {
    return "openapi3";
  }

  return "unknown";
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function importFromJson(jsonText: string): ImportResult | ImportError {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { message: "JSON 格式错误，请检查文件内容", hint: "确保文件编码为 UTF-8 且是有效的 JSON" };
  }

  const format = detectFormat(data);

  try {
    switch (format) {
      case "postman_v2":
      case "postman_v21":
        return parsePostmanCollection(data);

      case "apipost":
        return parseAPIPost(data);

      case "apifox":
        return parseApifox(data);

      case "openapi3":
      case "swagger2":
        return parseOpenAPI(data);

      default:
        // Last resort: try each parser
        return tryAllParsers(data);
    }
  } catch (err) {
    return {
      message: `解析失败：${err instanceof Error ? err.message : String(err)}`,
      hint: "请确认文件来自受支持的工具（Postman / APIPost / Apifox / OpenAPI）",
    };
  }
}

function tryAllParsers(data: unknown): ImportResult | ImportError {
  const parsers: Array<() => ImportResult> = [
    () => parsePostmanCollection(data),
    () => parseAPIPost(data),
    () => parseApifox(data),
    () => parseOpenAPI(data),
  ];

  for (const parser of parsers) {
    try {
      const result = parser();
      if (result.stats.requests > 0) return result;
    } catch {
      // try next
    }
  }

  return {
    message: "无法识别文件格式",
    hint: "支持格式：Postman v2.0/v2.1、APIPost、Apifox、OpenAPI 3.x、Swagger 2.x",
  };
}

/** Try to parse a standalone Postman environment file */
export function importEnvironmentFromJson(jsonText: string): Environment | ImportError {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { message: "JSON 格式错误" };
  }
  const env = parsePostmanEnvironment(data);
  if (!env) return { message: "无法识别环境变量格式" };
  return env;
}

export const FORMAT_LABELS: Record<ImportFormat, string> = {
  postman_v2: "Postman v2.0",
  postman_v21: "Postman v2.1",
  apipost: "APIPost",
  apifox: "Apifox",
  openapi3: "OpenAPI 3.x",
  swagger2: "Swagger 2.x",
  unknown: "未知格式",
};
