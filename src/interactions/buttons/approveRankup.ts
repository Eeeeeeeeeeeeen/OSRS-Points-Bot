import { ButtonInteraction, GuildMember, MessageFlags } from 'discord.js';
import { applyRankUp } from '../../services/rankService';
import { getRankTierByRoleId } from '../../database/queries/ranks';
import { buildRankUpApprovedEmbed } from '../../embeds/rankUpEmbed';
import { config } from '../../config';
import { hasClanRole } from '../../utils/permissions';

export async function handleApproveRankup(
    interaction: ButtonInteraction,
    discordId: string,
    roleId: string,
): Promise<void> {
    if (!hasClanRole(interaction)) {
        await interaction.reply({ content: 'You do not have permission to do this.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferUpdate();

    const guild = interaction.guild!;
    const tier = getRankTierByRoleId(roleId);
    if (!tier) {
        await interaction.followUp({ content: 'This rank tier no longer exists.', flags: MessageFlags.Ephemeral });
        return;
    }

    let targetMember: GuildMember;
    try {
        targetMember = await guild.members.fetch(discordId);
    } catch {
        await interaction.followUp({ content: 'Could not find that member in the server.', flags: MessageFlags.Ephemeral });
        return;
    }

    await applyRankUp(guild, discordId, roleId);

    await interaction.message.edit({
        embeds: [buildRankUpApprovedEmbed(targetMember, tier, interaction.user)],
        components: [],
    });
}

