import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { copyToClipboard } from "@/lib/utils";
import { buildInviteLink } from "@/lib/shareService";
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  getRoleDefaultPermission,
} from "@/types";
import type { TeamMember, TeamRole, PermissionRule, ResourceType } from "@/types";
import { ShareDialog } from "./ShareDialog";

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-yellow-500",
  "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];

function Avatar({ member, size = "sm" }: { member: TeamMember; size?: "sm" | "md" }) {
  const idx = member.id.charCodeAt(0) % AVATAR_COLORS.length;
  const bg = AVATAR_COLORS[idx];
  const initial = (member.name || member.email || "?")[0].toUpperCase();
  const sizeClass = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${bg} ${sizeClass} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 select-none`}>
      {initial}
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: TeamRole }) {
  const colors: Record<TeamRole, string> = {
    owner:  "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    admin:  "bg-brand-500/15 text-brand-400 border-brand-500/30",
    editor: "bg-green-500/15 text-green-400 border-green-500/30",
    viewer: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  };
  return (
    <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded flex-shrink-0 ${colors[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: TeamMember["status"] }) {
  if (status === "active") return <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" title="活跃" />;
  if (status === "pending") return <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" title="待接受邀请" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" title="已禁用" />;
}

// ─── Permission toggles ───────────────────────────────────────────────────────

interface PermissionEditorProps {
  member: TeamMember;
  onClose: () => void;
}

function PermissionEditor({ member, onClose }: PermissionEditorProps) {
  const collections = useAppStore((s) => s.collections);
  const environments = useAppStore((s) => s.environments);
  const setMemberRole = useAppStore((s) => s.setMemberRole);
  const setMemberPermissions = useAppStore((s) => s.setMemberPermissions);

  const [role, setRole] = useState<TeamRole>(member.role);
  const [perms, setPerms] = useState<PermissionRule[]>(() => {
    // Initialize from existing member permissions, defaulting from role
    const defaults = getRoleDefaultPermission(member.role);
    return [
      {
        resourceType: "all",
        resourceId: "*",
        canRead: defaults.canRead,
        canWrite: defaults.canWrite,
        canShare: defaults.canShare,
        canManageMembers: defaults.canManageMembers,
        ...member.permissions.find((p) => p.resourceType === "all" && p.resourceId === "*"),
      },
      ...collections.map((col) => ({
        resourceType: "collection" as ResourceType,
        resourceId: col.id,
        canRead: defaults.canRead,
        canWrite: defaults.canWrite,
        canShare: defaults.canShare,
        canManageMembers: false,
        ...member.permissions.find((p) => p.resourceType === "collection" && p.resourceId === col.id),
      })),
    ];
  });

  function updatePerm(idx: number, field: keyof PermissionRule, value: boolean) {
    setPerms((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function handleSave() {
    setMemberRole(member.id, role);
    setMemberPermissions(member.id, perms);
    onClose();
  }

  const globalPerm = perms[0];
  const collectionPerms = perms.slice(1);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#222] flex-shrink-0">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-0.5 rounded hover:bg-white/5 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar member={member} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-200 truncate">{member.name}</p>
          <p className="text-[10px] text-gray-600 truncate">{member.email || "未设置邮箱"}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {/* Role selector */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">角色</p>
          <div className="flex flex-col gap-1.5">
            {(["admin", "editor", "viewer"] as TeamRole[]).map((r) => (
              <label
                key={r}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  role === r
                    ? "border-brand-500/40 bg-brand-500/5"
                    : "border-[#2a2a2a] hover:border-[#333]"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  className="mt-0.5 accent-brand-500 flex-shrink-0"
                />
                <div>
                  <p className="text-xs font-semibold text-gray-300">{ROLE_LABELS[r]}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Global permission overrides */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">全局权限覆盖</p>
          <div className="flex flex-col gap-1.5 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
            {[
              { field: "canRead" as const, label: "查看所有资源" },
              { field: "canWrite" as const, label: "编辑所有资源" },
              { field: "canShare" as const, label: "生成分享链接" },
              { field: "canManageMembers" as const, label: "管理团队成员" },
            ].map(({ field, label }) => (
              <label key={field} className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-gray-400 group-hover:text-gray-300">{label}</span>
                <div
                  onClick={() => updatePerm(0, field, !globalPerm[field])}
                  className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${globalPerm[field] ? "bg-brand-600" : "bg-[#333]"}`}
                  style={{ height: "18px", width: "32px" }}
                >
                  <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${globalPerm[field] ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Per-collection permissions */}
        {collections.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">集合权限</p>
            <div className="flex flex-col gap-1.5">
              {collectionPerms.map((perm, idx) => {
                const col = collections.find((c) => c.id === perm.resourceId);
                if (!col) return null;
                return (
                  <div key={perm.resourceId} className="p-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                    <div className="flex items-center gap-1.5 mb-2">
                      <svg className="w-3 h-3 text-yellow-600/70 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      </svg>
                      <span className="text-xs font-medium text-gray-300 truncate">{col.name}</span>
                    </div>
                    <div className="flex gap-3">
                      {[
                        { field: "canRead" as const, label: "查看" },
                        { field: "canWrite" as const, label: "编辑" },
                        { field: "canShare" as const, label: "分享" },
                      ].map(({ field, label }) => (
                        <label key={field} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={perm[field]}
                            onChange={() => updatePerm(idx + 1, field, !perm[field])}
                            className="accent-brand-500 w-3 h-3"
                          />
                          <span className="text-[10px] text-gray-500">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="px-3 py-2.5 border-t border-[#222] flex-shrink-0">
        <button
          onClick={handleSave}
          className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          保存权限设置
        </button>
      </div>
    </div>
  );
}

// ─── Invite member form ───────────────────────────────────────────────────────

function InviteMember({ onClose }: { onClose: () => void }) {
  const addMember = useAppStore((s) => s.addMember);
  const team = useAppStore((s) => s.team);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("viewer");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  function handleAdd() {
    if (!name.trim()) return;
    addMember({
      name: name.trim(),
      email: email.trim(),
      role,
      permissions: [],
      invitedBy: team.ownerId,
      status: "pending",
    });
    // Generate invite link
    const link = buildInviteLink({
      teamId: team.id,
      teamName: team.name,
      role,
      invitedBy: team.ownerId,
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000, // 7 days
    });
    setInviteLink(link);
  }

  function handleCopy() {
    copyToClipboard(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (inviteLink) {
    return (
      <div className="p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-xs text-green-400">已添加成员，邀请链接已生成（7天内有效）</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-gray-500">邀请链接（发送给对方）</p>
          <div className="flex gap-1.5">
            <input
              value={inviteLink}
              readOnly
              className="flex-1 bg-[#141414] border border-[#2a2a2a] rounded px-2 py-1.5 text-[10px] text-gray-400 font-mono truncate focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className={`px-2.5 py-1.5 text-xs rounded border transition-colors flex-shrink-0 ${
                copied
                  ? "border-green-500/40 text-green-400 bg-green-500/10"
                  : "border-[#333] text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        </div>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 py-1">
          完成
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">邀请新成员</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">姓名 <span className="text-red-400">*</span></label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="张三"
          autoFocus
          className="bg-[#1e1e1e] border border-[#333] rounded px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">邮箱（可选）</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="zhangsan@example.com"
          type="email"
          className="bg-[#1e1e1e] border border-[#333] rounded px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400">初始角色</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(["admin", "editor", "viewer"] as TeamRole[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-2.5 py-1.5 text-xs rounded border transition-colors text-left ${
                role === r
                  ? "border-brand-500/50 bg-brand-500/10 text-brand-300"
                  : "border-[#2a2a2a] text-gray-500 hover:border-[#333] hover:text-gray-300"
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-1.5 text-xs text-gray-500 hover:text-gray-300 border border-[#2a2a2a] rounded transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="flex-1 py-1.5 text-xs text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded transition-colors"
        >
          添加并生成邀请链接
        </button>
      </div>
    </div>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  canManage,
  onEditPerms,
}: {
  member: TeamMember;
  canManage: boolean;
  onEditPerms: (m: TeamMember) => void;
}) {
  const removeMember = useAppStore((s) => s.removeMember);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group flex items-center gap-2 px-2 py-2 hover:bg-white/[0.03] rounded-lg">
      <Avatar member={member} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-300 truncate">{member.name}</span>
          <StatusDot status={member.status} />
        </div>
        {member.email && (
          <p className="text-[10px] text-gray-600 truncate">{member.email}</p>
        )}
      </div>

      <RoleBadge role={member.role} />

      {canManage && member.role !== "owner" && (
        <div className="relative flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-36 bg-[#1e1e1e] border border-[#333] rounded shadow-xl overflow-hidden">
                <button
                  onClick={() => { onEditPerms(member); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                >
                  编辑权限
                </button>
                {member.status === "active" ? (
                  <button
                    onClick={() => { /* disable */ setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                  >
                    暂停访问
                  </button>
                ) : (
                  <button
                    onClick={() => { /* enable */ setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                  >
                    恢复访问
                  </button>
                )}
                <div className="border-t border-[#2a2a2a] my-0.5" />
                <button
                  onClick={() => { removeMember(member.id); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                >
                  移除成员
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main TeamSidebar ─────────────────────────────────────────────────────────

export function TeamSidebar() {
  const team = useAppStore((s) => s.team);
  const [view, setView] = useState<"list" | "invite" | "perms">("list");
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const me = team.members.find((m) => m.id === team.ownerId);
  const canManage = me?.role === "owner" || me?.role === "admin";

  const activeMembers = team.members.filter((m) => m.status === "active");
  const pendingMembers = team.members.filter((m) => m.status === "pending");

  if (view === "invite") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#222] flex-shrink-0">
          <button onClick={() => setView("list")} className="text-gray-500 hover:text-gray-300 p-0.5 rounded hover:bg-white/5 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs font-semibold text-gray-400">邀请成员</span>
        </div>
        <InviteMember onClose={() => setView("list")} />
      </div>
    );
  }

  if (view === "perms" && editingMember) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <PermissionEditor
          member={editingMember}
          onClose={() => { setView("list"); setEditingMember(null); }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#222] flex-shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">团队</span>
        <div className="flex items-center gap-0.5">
          {canManage && (
            <button
              onClick={() => setShareOpen(true)}
              title="分享集合"
              className="text-gray-600 hover:text-gray-300 p-1 rounded hover:bg-white/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setView("invite")}
              title="邀请成员"
              className="text-gray-600 hover:text-gray-300 p-1 rounded hover:bg-white/5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Team name */}
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-200">{team.name}</p>
          {team.description && <p className="text-[11px] text-gray-600 mt-0.5">{team.description}</p>}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-600">{team.members.length} 成员</span>
            <span className="text-[10px] text-gray-700">·</span>
            <span className="text-[10px] text-gray-600">{team.shareLinks.length} 分享链接</span>
          </div>
        </div>

        {/* Active members */}
        {activeMembers.length > 0 && (
          <div className="px-2 pb-2">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-2 py-1">
              活跃成员 ({activeMembers.length})
            </p>
            {activeMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canManage={canManage}
                onEditPerms={(member) => { setEditingMember(member); setView("perms"); }}
              />
            ))}
          </div>
        )}

        {/* Pending invites */}
        {pendingMembers.length > 0 && (
          <div className="px-2 pb-2 border-t border-[#1e1e1e] pt-2">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-2 py-1">
              待接受邀请 ({pendingMembers.length})
            </p>
            {pendingMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canManage={canManage}
                onEditPerms={(member) => { setEditingMember(member); setView("perms"); }}
              />
            ))}
          </div>
        )}

        {team.members.length <= 1 && (
          <div className="flex flex-col items-center justify-center h-24 text-center px-4 gap-2">
            <p className="text-xs text-gray-600">暂无其他成员</p>
            {canManage && (
              <button
                onClick={() => setView("invite")}
                className="text-xs text-brand-400 hover:text-brand-300"
              >
                + 邀请第一个成员
              </button>
            )}
          </div>
        )}
      </div>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
