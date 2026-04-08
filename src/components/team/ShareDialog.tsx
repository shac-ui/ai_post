import React, { useState, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  buildSharePackage,
  buildShareUrl,
  downloadShareFile,
  readShareFile,
  countItemsInPackage,
  formatExpiry,
  isShareLinkExpired,
  isShareLinkExhausted,
} from "@/lib/shareService";
import { copyToClipboard } from "@/lib/utils";
import type { ShareLink, Collection, Environment } from "@/types";

// ─── Share tab types ──────────────────────────────────────────────────────────

type ShareTab = "create" | "links" | "import";

// ─── Resource picker ──────────────────────────────────────────────────────────

function ResourcePicker({
  collections,
  environments,
  selectedCollections,
  selectedEnvironments,
  onToggleCollection,
  onToggleEnvironment,
}: {
  collections: Collection[];
  environments: Environment[];
  selectedCollections: Set<string>;
  selectedEnvironments: Set<string>;
  onToggleCollection: (id: string) => void;
  onToggleEnvironment: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {collections.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">集合</p>
          <div className="flex flex-col gap-1">
            {collections.map((col) => (
              <label key={col.id} className="flex items-center gap-2 p-2 rounded hover:bg-white/[0.03] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCollections.has(col.id)}
                  onChange={() => onToggleCollection(col.id)}
                  className="accent-brand-500 w-3.5 h-3.5"
                />
                <svg className="w-3.5 h-3.5 text-yellow-600/70 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                <span className="text-xs text-gray-300 flex-1 truncate">{col.name}</span>
                <span className="text-[10px] text-gray-600 flex-shrink-0">{col.items.length} 项</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {environments.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">环境变量</p>
          <div className="flex flex-col gap-1">
            {environments.map((env) => (
              <label key={env.id} className="flex items-center gap-2 p-2 rounded hover:bg-white/[0.03] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedEnvironments.has(env.id)}
                  onChange={() => onToggleEnvironment(env.id)}
                  className="accent-brand-500 w-3.5 h-3.5"
                />
                <svg className="w-3.5 h-3.5 text-brand-400/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span className="text-xs text-gray-300 flex-1 truncate">{env.name}</span>
                <span className="text-[10px] text-gray-600 flex-shrink-0">{env.variables.length} 变量</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create share ─────────────────────────────────────────────────────────────

function CreateShare() {
  const team = useAppStore((s) => s.team);
  const collections = useAppStore((s) => s.collections);
  const environments = useAppStore((s) => s.environments);
  const addShareLink = useAppStore((s) => s.addShareLink);

  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    new Set(collections.map((c) => c.id))
  );
  const [selectedEnvs, setSelectedEnvs] = useState<Set<string>>(new Set());
  const [canWrite, setCanWrite] = useState(false);
  const [expiry, setExpiry] = useState<"none" | "1d" | "7d" | "30d">("7d");
  const [maxUses, setMaxUses] = useState<"" | "1" | "5" | "10" | "50">("" as "");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ url: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const expiryMs: Record<string, number | null> = {
    none: null, "1d": 86400000, "7d": 604800000, "30d": 2592000000,
  };
  const maxUsesMap: Record<string, number | null> = {
    "": null, "1": 1, "5": 5, "10": 10, "50": 50,
  };

  function handleGenerate() {
    const selCols = collections.filter((c) => selectedCols.has(c.id));
    const selEnvs = environments.filter((e) => selectedEnvs.has(e.id));

    const pkg = buildSharePackage({
      collections: selCols,
      environments: selEnvs,
      teamName: team.name,
      exportedBy: team.ownerId,
      permissions: { canRead: true, canWrite },
    });

    const expiresAt = expiryMs[expiry] ? Date.now() + expiryMs[expiry]! : null;
    const maxUsesValue = maxUsesMap[maxUses as string] ?? null;

    const link = addShareLink({
      resourceType: "all",
      resourceIds: [...selectedCols, ...selectedEnvs],
      createdBy: team.ownerId,
      expiresAt,
      maxUses: maxUsesValue,
      permissions: { canRead: true, canWrite },
      note: note.trim() || undefined,
    });

    const url = buildShareUrl(pkg);
    setResult({ url, token: link.token });
  }

  function handleDownload() {
    const selCols = collections.filter((c) => selectedCols.has(c.id));
    const selEnvs = environments.filter((e) => selectedEnvs.has(e.id));
    const pkg = buildSharePackage({
      collections: selCols,
      environments: selEnvs,
      teamName: team.name,
      exportedBy: team.ownerId,
      permissions: { canRead: true, canWrite },
    });
    downloadShareFile(pkg);
  }

  function handleCopy() {
    if (result) {
      copyToClipboard(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-green-400 font-medium">分享链接已生成</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-gray-500">分享链接（发给团队成员）</p>
          <div className="flex gap-1.5">
            <input
              value={result.url}
              readOnly
              className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px] text-gray-400 font-mono truncate focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`px-2.5 py-1.5 text-xs rounded border transition-colors flex-shrink-0 ${
                copied
                  ? "border-green-500/40 text-green-400 bg-green-500/10"
                  : "border-[#333] text-gray-400 hover:text-gray-200"
              }`}
            >
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <p className="text-[10px] text-gray-600">
            对方打开链接后，应用会自动提示导入集合数据
          </p>
        </div>
        <button
          onClick={() => setResult(null)}
          className="text-xs text-gray-500 hover:text-gray-300 py-1"
        >
          重新生成
        </button>
      </div>
    );
  }

  const hasSelection = selectedCols.size > 0 || selectedEnvs.size > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Resource selection */}
      {collections.length === 0 && environments.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">暂无可分享的集合或环境变量</p>
      ) : (
        <ResourcePicker
          collections={collections}
          environments={environments}
          selectedCollections={selectedCols}
          selectedEnvironments={selectedEnvs}
          onToggleCollection={(id) => setSelectedCols((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
          })}
          onToggleEnvironment={(id) => setSelectedEnvs((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
          })}
        />
      )}

      {/* Permissions */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">接收方权限</p>
        <div className="flex gap-2">
          {[
            { value: false, label: "只读", desc: "仅可查看和复制" },
            { value: true, label: "可编辑", desc: "可修改并保存" },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setCanWrite(opt.value)}
              className={`flex-1 p-2.5 rounded-lg border text-left transition-colors ${
                canWrite === opt.value
                  ? "border-brand-500/50 bg-brand-500/5"
                  : "border-[#2a2a2a] hover:border-[#333]"
              }`}
            >
              <p className="text-xs font-semibold text-gray-300">{opt.label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Expiry */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-gray-500">过期时间</label>
          <select
            value={expiry}
            onChange={(e) => setExpiry(e.target.value as typeof expiry)}
            className="bg-[#1e1e1e] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
          >
            <option value="none">永不过期</option>
            <option value="1d">1 天</option>
            <option value="7d">7 天</option>
            <option value="30d">30 天</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-gray-500">最大使用次数</label>
          <select
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value as typeof maxUses)}
            className="bg-[#1e1e1e] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
          >
            <option value="">不限制</option>
            <option value="1">1 次</option>
            <option value="5">5 次</option>
            <option value="10">10 次</option>
            <option value="50">50 次</option>
          </select>
        </div>
      </div>

      {/* Note */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-gray-500">备注（可选）</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：给前端团队的接口文档"
          className="bg-[#1e1e1e] border border-[#333] rounded px-2.5 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          disabled={!hasSelection}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs border border-[#333] text-gray-400 hover:text-gray-200 hover:border-[#444] disabled:opacity-40 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载文件
        </button>
        <button
          onClick={handleGenerate}
          disabled={!hasSelection}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-40 rounded-lg transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          生成链接
        </button>
      </div>
    </div>
  );
}

// ─── Links list ───────────────────────────────────────────────────────────────

function LinksList() {
  const team = useAppStore((s) => s.team);
  const removeShareLink = useAppStore((s) => s.removeShareLink);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (team.shareLinks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-24 text-gray-600">
        <p className="text-xs">暂无分享链接</p>
      </div>
    );
  }

  function copyLink(link: ShareLink) {
    copyToClipboard(`${window.location.origin}${window.location.pathname}#share-token=${link.token}`);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="flex flex-col gap-2">
      {team.shareLinks.map((link) => {
        const expired = isShareLinkExpired(link);
        const exhausted = isShareLinkExhausted(link);
        const invalid = expired || exhausted;
        return (
          <div
            key={link.id}
            className={`p-3 border rounded-lg ${invalid ? "border-[#222] opacity-60" : "border-[#2a2a2a]"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded ${
                    link.permissions.canWrite
                      ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
                      : "text-gray-400 border-gray-500/30 bg-gray-500/10"
                  }`}>
                    {link.permissions.canWrite ? "可编辑" : "只读"}
                  </span>
                  {invalid && (
                    <span className="text-[10px] text-red-400">{expired ? "已过期" : "已用尽"}</span>
                  )}
                </div>
                {link.note && <p className="text-[11px] text-gray-400 mt-1 truncate">{link.note}</p>}
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-600">
                  <span>{formatExpiry(link.expiresAt)}</span>
                  <span>·</span>
                  <span>已用 {link.usedCount}{link.maxUses ? `/${link.maxUses}` : ""} 次</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!invalid && (
                  <button
                    onClick={() => copyLink(link)}
                    className={`p-1 rounded text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-colors ${copiedId === link.id ? "text-green-400" : ""}`}
                    title="复制链接"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => removeShareLink(link.id)}
                  className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="删除链接"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Import share ─────────────────────────────────────────────────────────────

function ImportShare() {
  const importCollections = useAppStore((s) => s.importCollections);
  const importEnvironments = useAppStore((s) => s.importEnvironments);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{ msg: string; ok: boolean } | null>(null);

  async function processFile(file: File) {
    try {
      const pkg = await readShareFile(file);
      const stats = countItemsInPackage(pkg);
      importCollections(pkg.collections);
      importEnvironments(pkg.environments);
      setResult({
        ok: true,
        msg: `导入成功：${stats.collections} 个集合、${stats.requests} 个请求、${stats.environments} 个环境变量`,
      });
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : "导入失败" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        onClick={() => fileRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition-all ${
          dragging ? "border-brand-500 bg-brand-500/5" : "border-[#2a2a2a] hover:border-[#333]"
        }`}
      >
        <svg className={`w-8 h-8 ${dragging ? "text-brand-400" : "text-gray-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-xs text-gray-500">拖拽 .reqhub 文件到此处</p>
        <p className="text-[10px] text-gray-700">或点击选择文件</p>
      </div>
      <input ref={fileRef} type="file" accept=".reqhub,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} className="hidden" />
      {result && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${
          result.ok
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {result.ok
            ? <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          }
          {result.msg}
        </div>
      )}
    </div>
  );
}

// ─── Main ShareDialog ─────────────────────────────────────────────────────────

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({ open, onClose }: ShareDialogProps) {
  const [tab, setTab] = useState<ShareTab>("create");

  if (!open) return null;

  const tabs: { id: ShareTab; label: string }[] = [
    { id: "create", label: "生成分享" },
    { id: "links", label: "管理链接" },
    { id: "import", label: "导入分享" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#252525] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600/20 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-gray-200">团队共享</h2>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 p-1 rounded hover:bg-white/5 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#222] flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-brand-500 text-gray-100"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "create" && <CreateShare />}
          {tab === "links" && <LinksList />}
          {tab === "import" && <ImportShare />}
        </div>
      </div>
    </div>
  );
}
