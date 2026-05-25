import { Command } from '../types/command';
import { drop } from './drop';
import { points } from './points';
import { leaderboard } from './leaderboard';
import { admin } from './admin';
import { createThread } from './createThread';

const commandList: Command[] = [drop, points, leaderboard, admin, createThread];

export function loadCommands(): Map<string, Command> {
    const map = new Map<string, Command>();
    for (const cmd of commandList) {
        map.set(cmd.data.name, cmd);
    }
    return map;
}

export { commandList };
