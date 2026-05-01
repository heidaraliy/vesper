import type { GuildMember } from "discord.js";
import type { UserRole } from "./types.js";

export interface PermissionConfig {
  ownerIds: string[];
}

const roleRank: Record<UserRole, number> = {
  viewer: 0,
  requester: 1,
  operator: 2,
  approver: 3,
  owner: 4,
};

const discordRoleNames: Array<[string, UserRole]> = [
  ["vesper owner", "owner"],
  ["vesper approver", "approver"],
  ["vesper operator", "operator"],
  ["vesper requester", "requester"],
  ["vesper viewer", "viewer"],
];

export function rolesForMember(member: GuildMember | null, config: PermissionConfig): UserRole[] {
  if (!member) return ["viewer"];
  if (config.ownerIds.includes(member.id)) return ["owner", "approver", "operator", "requester", "viewer"];

  const roles = new Set<UserRole>(["viewer"]);
  for (const [, role] of discordRoleNames) {
    if (member.roles.cache.some((discordRole) => discordRole.name.toLowerCase() === roleNameFor(role))) {
      roles.add(role);
    }
  }
  if (roles.has("owner")) {
    roles.add("approver");
    roles.add("operator");
    roles.add("requester");
  }
  if (roles.has("approver")) {
    roles.add("operator");
    roles.add("requester");
  }
  if (roles.has("operator")) roles.add("requester");
  return [...roles];
}

export function hasRole(roles: UserRole[], required: UserRole): boolean {
  return roles.some((role) => roleRank[role] >= roleRank[required]);
}

function roleNameFor(role: UserRole): string {
  return discordRoleNames.find(([, mapped]) => mapped === role)?.[0] ?? `vesper ${role}`;
}
