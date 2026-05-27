import { ButtonInteraction, GuildMember, MessageFlags, TextChannel } from 'discord.js';
import { applyRankUp } from '../../services/rankService';
import { getRankTierByRoleId } from '../../database/queries/ranks';
import { buildRankUpApprovedEmbed, buildRankUpCongratEmbed } from '../../embeds/rankUpEmbed';
import { hasStaffRole } from '../../utils/permissions';
import { config } from '../../config';

export async function handleApproveRankup(
    interaction: ButtonInteraction,
    discordId: string,
    roleId: string,
): Promise<void> {
    if (!hasStaffRole(interaction)) {
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

    const logChannel = guild.channels.cache.get(config.dropLogChannelId) as TextChannel | undefined;
    if (logChannel) {
        await logChannel.send({ embeds: [buildRankUpCongratEmbed(targetMember, tier)] });
    }
}

