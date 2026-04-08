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

// ─── Team & Sharing Types ─────────────────────────────────────────────────────

/** 成员角色：owner > admin > editor > viewer */
export type TeamRole = "owner" | "admin" | "editor" | "viewer";

/** 资源类型 */
export type ResourceType = "collection" | "environment" | "all";

/** 单条权限规则 */
export interface PermissionRule {
  resourceType: ResourceType;
  resourceId: string | "*";       // * 表示对该类型所有资源
  canRead: boolean;
  canWrite: boolean;              // 编辑 / 保存 / 删除
  canShare: boolean;              // 生成分享链接
  canManageMembers: boolean;      // 仅 owner/admin 可用
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;                // 初始字母头像颜色 seed
  role: TeamRole;
  permissions: PermissionRule[];  // 额外细粒度权限（覆盖角色默认权限）
  joinedAt: number;
  invitedBy?: string;             // 邀请者 id
  status: "active" | "pending" | "disabled";
}

export interface ShareLink {
  id: string;
  token: string;                  // URL-safe base64 token
  resourceType: ResourceType;
  resourceIds: string[];          // 包含的集合/环境 id
  createdBy: string;              // 创建者成员 id
  createdAt: number;
  expiresAt: number | null;       // null = 永不过期
  maxUses: number | null;         // null = 不限次数
  usedCount: number;
  permissions: Pick<PermissionRule, "canRead" | "canWrite">;
  note?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string;                // 对应 TeamMember.id
  members: TeamMember[];
  shareLinks: ShareLink[];
  createdAt: number;
  updatedAt: number;
}

/** 分享包（通过链接或文件分发的数据载体） */
export interface SharePackage {
  version: "1";
  teamName: string;
  exportedAt: number;
  exportedBy: string;
  collections: Collection[];
  environments: Environment[];    // secret 字段已脱敏
  permissions: Pick<PermissionRule, "canRead" | "canWrite">;
}

// ─── Role defaults ────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<TeamRole, string> = {
  owner:  "所有者",
  admin:  "管理员",
  editor: "编辑者",
  viewer: "只读成员",
};

export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner:  "完全控制权限，可管理成员和团队设置",
  admin:  "可管理成员权限，可编辑所有集合和环境",
  editor: "可查看并编辑集合和环境，不可管理成员",
  viewer: "仅可查看集合和环境，不可编辑",
};

/** 角色默认权限（细粒度权限规则可覆盖） */
export function getRoleDefaultPermission(role: TeamRole): Omit<PermissionRule, "resourceType" | "resourceId"> {
  switch (role) {
    case "owner":
      return { canRead: true, canWrite: true, canShare: true, canManageMembers: true };
    case "admin":
      return { canRead: true, canWrite: true, canShare: true, canManageMembers: true };
    case "editor":
      return { canRead: true, canWrite: true, canShare: false, canManageMembers: false };
    case "viewer":
      return { canRead: true, canWrite: false, canShare: false, canManageMembers: false };
  }
}

export const DEFAULT_TEAM: Team = {
  id: "default-team",
  name: "我的团队",
  description: "",
  ownerId: "me",
  members: [
    {
      id: "me",
      name: "我（本地）",
      email: "",
      role: "owner",
      permissions: [],
      joinedAt: Date.now(),
      status: "active",
    },
  ],
  shareLinks: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ─── App State Types ──────────────────────────────────────────────────────────

export type SidebarView = "collections" | "history" | "environments" | "team";
export type ResponseViewTab = "body" | "headers" | "cookies";
export type RequestViewTab = "params" | "headers" | "body" | "auth" | "description";
