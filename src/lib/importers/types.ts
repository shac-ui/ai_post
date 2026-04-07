import type { Collection, Environment } from "@/types";

export type ImportFormat =
  | "postman_v2"
  | "postman_v21"
  | "apipost"
  | "apifox"
  | "openapi3"
  | "swagger2"
  | "unknown";

export interface ImportResult {
  format: ImportFormat;
  collections: Collection[];
  environments: Environment[];
  warnings: string[];
  stats: {
    requests: number;
    folders: number;
    environments: number;
  };
}

export interface ImportError {
  message: string;
  hint?: string;
}
