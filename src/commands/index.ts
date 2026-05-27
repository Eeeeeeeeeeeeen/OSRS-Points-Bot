import { Command } from '../types/command';
import { drop } from './drop';
import { points } from './points';
import { leaderboard } from './leaderboard';
import { stats } from './stats';
import { referrals } from './referrals';
import { admin } from './admin';
import { setpoints } from './setpoints';
import { eventpoints } from './eventpoints';
import { listcustomitems } from './listcustomitems';
import { listitempoints } from './listitempoints';
import { createThread } from './createThread';

const commandList: Command[] = [drop, points, leaderboard, stats, referrals, admin, setpoints, eventpoints, listcustomitems, listitempoints, createThread];

export function loadCommands(): Map<string, Command> {
    const map = new Map<string, Command>();
    for (const cmd of commandList) {
        map.set(cmd.data.name, cmd);
    }
    return map;
}

export { commandList };
