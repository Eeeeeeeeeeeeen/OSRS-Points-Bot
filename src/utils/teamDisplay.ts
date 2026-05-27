import { User } from 'discord.js';

/**
 * Formats the team member list for display in embeds.
 * If teamSize is larger than the number of Discord members, shows the anonymous count.
 *
 * Examples:
 *   3 registered, no anonymous → "@User1, @User2, @User3"
 *   2 registered, 3 anonymous  → "@User1, @User2 + 3 anonymous (5 total)"
 */
export function buildTeamDisplay(submitter: User, teammates: User[], teamSize: number | null): string {
    const members = [submitter, ...teammates];
    const mentionList = members.map(u => `<@${u.id}>`).join(', ');

    if (!teamSize || teamSize <= members.length) {
        return mentionList;
    }

    const anonymousCount = teamSize - members.length;
    return `${mentionList} + ${anonymousCount} anonymous (${teamSize} total)`;
}
