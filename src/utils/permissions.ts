import { GuildMember, Interaction } from 'discord.js';
import { config } from '../config';

export function hasClanRole(interaction: Interaction): boolean {
    const member = interaction.member;
    if (!member) return false;
    if (member instanceof GuildMember) {
        return member.roles.cache.has(config.clanRoleId);
    }
    // APIInteractionGuildMember — roles is a plain string[]
    return Array.isArray(member.roles) && member.roles.includes(config.clanRoleId);
}
