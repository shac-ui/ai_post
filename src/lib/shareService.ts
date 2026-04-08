/**
 * Share Service — export & import share packages
 *
 * Two distribution methods:
 *   1. Share Link  — Base64-encoded JSON embedded in a URL fragment (#share=…)
 *                    Recipient opens URL, app auto-imports the package
 *   2. Share File  — Download a .reqhub JSON file for offline sharing
 *
 * Secret env variables are redacted before export (value replaced with "").
 */

import type {
  Collection,
  Environment,
  SharePackage,
  ShareLink,
  TeamMember,
  PermissionRule,
} from "@/types";

// ─── Build share package ──────────────────────────────────────────────────────

export function buildSharePackage(
  params: {
    collections: Collection[];
    environments: Environment[];
    teamName: string;
    exportedBy: string;
    permissions: Pick<PermissionRule, "canRead" | "canWrite">;
  }
): SharePackage {
  // Redact secret env variable values
  const safeEnvs: Environment[] = params.environments.map((env) => ({
    ...env,
    variables: env.variables.map((v) =>
      v.secret ? { ...v, value: "", initialValue: "" } : v
    ),
  }));

  return {
    version: "1",
    teamName: params.teamName,
    exportedAt: Date.now(),
    exportedBy: params.exportedBy,
    collections: params.collections,
    environments: safeEnvs,
    permissions: params.permissions,
  };
}

// ─── URL share link ───────────────────────────────────────────────────────────

/** Encode package into a URL-safe base64 string */
export function encodeSharePackage(pkg: SharePackage): string {
  const json = JSON.stringify(pkg);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode URL-safe base64 back to package */
export function decodeSharePackage(encoded: string): SharePackage | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const pkg = JSON.parse(json) as SharePackage;
    if (pkg.version !== "1") return null;
    return pkg;
  } catch {
    return null;
  }
}

/** Build a full shareable URL with embedded package */
export function buildShareUrl(pkg: SharePackage, baseUrl?: string): string {
  const encoded = encodeSharePackage(pkg);
  const base = baseUrl ?? window.location.origin + window.location.pathname;
  return `${base}#share=${encoded}`;
}

/** Check if current URL contains a share payload and return it */
export function extractShareFromUrl(): SharePackage | null {
  const hash = window.location.hash;
  const match = hash.match(/[#&]share=([^&]+)/);
  if (!match) return null;
  return decodeSharePackage(match[1]);
}

/** Clear share payload from URL without page reload */
export function clearShareFromUrl(): void {
  const clean = window.location.hash.replace(/[#&]share=[^&]+/, "").replace(/^#$/, "");
  history.replaceState(null, document.title, window.location.pathname + window.location.search + (clean || ""));
}

// ─── File download / upload ───────────────────────────────────────────────────

/** Trigger browser download of a .reqhub share file */
export function downloadShareFile(pkg: SharePackage, filename?: string): void {
  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `${pkg.teamName.replace(/\s+/g, "_")}_share.reqhub`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Read a .reqhub / .json file and parse as SharePackage */
export function readShareFile(file: File): Promise<SharePackage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const pkg = JSON.parse(text) as SharePackage;
        if (pkg.version !== "1") reject(new Error("不支持的分享包版本"));
        else resolve(pkg);
      } catch {
        reject(new Error("文件格式错误，无法解析分享包"));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, "utf-8");
  });
}

// ─── Invite link token utils ──────────────────────────────────────────────────

interface InvitePayload {
  teamId: string;
  teamName: string;
  role: TeamMember["role"];
  invitedBy: string;
  expiresAt: number;
}

export function buildInviteLink(payload: InvitePayload, baseUrl?: string): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  const token = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const base = baseUrl ?? window.location.origin + window.location.pathname;
  return `${base}?invite=${token}`;
}

export function parseInviteLink(token: string): InvitePayload | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as InvitePayload;
    if (payload.expiresAt < Date.now()) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

/** Extract invite token from current URL */
export function extractInviteFromUrl(): InvitePayload | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("invite");
  if (!token) return null;
  return parseInviteLink(token);
}

// ─── Stat helpers ─────────────────────────────────────────────────────────────

export function countItemsInPackage(pkg: SharePackage): { requests: number; collections: number; environments: number } {
  function countReqs(items: Collection["items"]): number {
    let n = 0;
    for (const item of items) {
      if (item.type === "request") n++;
      if (item.type === "folder" && item.children) n += countReqs(item.children);
    }
    return n;
  }
  return {
    collections: pkg.collections.length,
    requests: pkg.collections.reduce((acc, col) => acc + countReqs(col.items), 0),
    environments: pkg.environments.length,
  };
}

export function isShareLinkExpired(link: ShareLink): boolean {
  if (!link.expiresAt) return false;
  return link.expiresAt < Date.now();
}

export function isShareLinkExhausted(link: ShareLink): boolean {
  if (!link.maxUses) return false;
  return link.usedCount >= link.maxUses;
}

export function formatExpiry(expiresAt: number | null): string {
  if (!expiresAt) return "永不过期";
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "已过期";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} 天后过期`;
  if (hours > 0) return `${hours} 小时后过期`;
  return "即将过期";
}
