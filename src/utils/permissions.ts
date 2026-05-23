import { GuildMember, Interaction } from 'discord.js';
import { config } from '../config';

function hasRole(interaction: Interaction, roleId: string): boolean {
    const member = interaction.member;
    if (!member) return false;
    if (member instanceof GuildMember) {
        return member.roles.cache.has(roleId);
    }
    // APIInteractionGuildMember — roles is a plain string[]
    return Array.isArray(member.roles) && member.roles.includes(roleId);
}

export function hasAdminRole(interaction: Interaction): boolean {
    return hasRole(interaction, config.adminRoleId);
}

export function hasStaffRole(interaction: Interaction): boolean {
    return hasRole(interaction, config.staffRoleId) || hasRole(interaction, config.adminRoleId);
}
