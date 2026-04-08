// ─── Core HTTP Types ─────────────────────────────────────────────────────────

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "TRACE";

export type BodyType =
  | "none"
  | "json"
  | "form-urlencoded"
  | "form-data"
  | "raw"
  | "binary";

export type ContentType =
  | "application/json"
  | "application/x-www-form-urlencoded"
  | "multipart/form-data"
  | "text/plain"
  | "text/html"
  | "text/xml"
  | "application/xml";

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface FormDataItem extends KeyValuePair {
  type: "text" | "file";
  file?: File;
}

// ─── Request Types ────────────────────────────────────────────────────────────

export interface RequestBody {
  type: BodyType;
  rawContent: string;
  rawContentType: ContentType;
  formData: FormDataItem[];
  urlencoded: KeyValuePair[];
}

export interface RequestAuth {
  type: "none" | "bearer" | "basic" | "api-key";
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyIn?: "header" | "query";
}

export interface RequestConfig {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: RequestBody;
  auth: RequestAuth;
  description?: string;
  collectionId?: string;
  parentId?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  sizeBytes: number;
  isBinary: boolean;
  timestamp: number;
}

export interface HistoryEntry {
  id: string;
  request: RequestConfig;
  response: ResponseData;
  timestamp: number;
}

// ─── Tab Types ────────────────────────────────────────────────────────────────

export type RequestTabStatus = "idle" | "loading" | "success" | "error";

export interface RequestTab {
  id: string;
  request: RequestConfig;
  response: ResponseData | null;
  status: RequestTabStatus;
  isDirty: boolean;
}

// ─── Collection Types ─────────────────────────────────────────────────────────

export interface CollectionItem {
  id: string;
  name: string;
  type: "request" | "folder";
  request?: RequestConfig;
  children?: CollectionItem[];
  parentId?: string;
  order: number;
  expanded?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  items: CollectionItem[];
  createdAt: number;
  updatedAt: number;
  color?: string;
}

// ─── Environment Types ────────────────────────────────────────────────────────

export interface EnvVariable {
  id: string;
  key: string;
  value: string;
  initialValue?: string;
  description?: string;
  enabled: boolean;
  secret?: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvVariable[];
  createdAt: number;
  updatedAt: number;
}

// ─── SSO Config ───────────────────────────────────────────────────────────────

export interface SsoConfig {
  enabled: boolean;
  casLoginUrl: string;       // CAS 登录地址，例如 https://sso.example.com/cas/login
  casLogoutUrl: string;      // CAS 登出地址，例如 https://sso.example.com/cas/logout
  appIndexUrl: string;       // 本应用首页地址（service 参数）
  tokenApiUrl: string;       // ticket 换 token 的后端接口，例如 /cas/casLogin
  tokenApiBaseUrl: string;   // token 接口的 baseURL，例如 https://api.example.com
  tokenField: string;        // 响应中 token 字段路径，例如 data 或 data.token
  tokenStorage: "localStorage" | "sessionStorage" | "cookie";
  tokenStorageKey: string;   // 存储 key，例如 Authorization
}

export const DEFAULT_SSO_CONFIG: SsoConfig = {
  enabled: false,
  casLoginUrl: "",
  casLogoutUrl: "",
  appIndexUrl: "",
  tokenApiUrl: "/cas/casLogin",
  tokenApiBaseUrl: "",
  tokenField: "data",
  tokenStorage: "localStorage",
  tokenStorageKey: "access_token",
};

// ─── App State Types ──────────────────────────────────────────────────────────

export type SidebarView = "collections" | "history" | "environments";
export type ResponseViewTab = "body" | "headers" | "cookies";
export type RequestViewTab = "params" | "headers" | "body" | "auth" | "description";
