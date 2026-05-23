# OSRS Clan Bot

A Discord bot for managing clan drop submissions and a points-based rank system. Members submit item drops with screenshots, staff review and approve them, and points are awarded based on real-time OSRS item prices.

## Features

- `/drop` — Submit an item drop with a screenshot and optional teammates; item prices fetched automatically from the OSRS Wiki API
- Staff review channel with Accept / Reject / Modify buttons
- Points split equally among team members (1 point per 1m GP, max 200 pts, min 1 pt per person)
- Configurable rank tiers linked to Discord roles, with optional time-in-server requirements
- Admin-approval workflow for rank-ups (no automatic role assignment)
- `/points` — Check your points, rank, and recent drops
- `/leaderboard` — Paginated clan leaderboard
- `/admin` commands for managing points and rank tiers

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A Discord application and bot created in the [Discord Developer Portal](https://discord.com/developers/applications)

---

## Discord Developer Portal Setup

### 1. Create an application and bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name
3. Go to the **Bot** tab
4. Click **Add Bot**
5. Under **Token**, click **Reset Token** and copy the token — this is your `DISCORD_TOKEN`
6. Under **Privileged Gateway Intents**, enable **Server Members Intent** (required for fetching member join dates and assigning roles)

### 2. Get your IDs

Enable **Developer Mode** in Discord: **User Settings → Advanced → Developer Mode**

| Value | How to get it |
|---|---|
| `CLIENT_ID` | Developer Portal → your app → **General Information** → Application ID |
| `GUILD_ID` | Right-click your server name → **Copy Server ID** |
| `CLAN_ROLE_ID` | Right-click the staff/admin role → **Copy Role ID** |
| `STAFF_REVIEW_CHANNEL_ID` | Right-click the channel → **Copy Channel ID** |
| `DROP_LOG_CHANNEL_ID` | Right-click the channel → **Copy Channel ID** |
| `RANK_UP_CHANNEL_ID` | Right-click the channel → **Copy Channel ID** |

### 3. Invite the bot to your server

Build an invite URL in the Developer Portal under **OAuth2 → URL Generator**:
- Scopes: `bot`, `applications.commands`
- Bot permissions: `Manage Roles`, `Send Messages`, `Embed Links`, `Read Message History`

Open the URL and invite the bot to your server.

> **Important:** The bot's role must be positioned **above** any rank roles it needs to assign in your server's role list (Server Settings → Roles).

---

## Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd OSRS-Clan-Bot

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
```

Edit `.env` and fill in all values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id
GUILD_ID=your_server_id

CLAN_ROLE_ID=id_of_your_staff_role
STAFF_REVIEW_CHANNEL_ID=id_of_drop_review_channel
DROP_LOG_CHANNEL_ID=id_of_drop_log_channel
RANK_UP_CHANNEL_ID=id_of_rank_up_channel

DB_PATH=./data/clan.db
```

> **Never commit your `.env` file.** It is already in `.gitignore`. `.env.example` should only contain empty placeholder values.

---

## Running the Bot

### Register slash commands (run once, or after command changes)

```bash
npm run deploy-commands
```

This registers `/drop`, `/points`, `/leaderboard`, and `/admin` with your Discord server. It only needs to be run again if you change a command's name, options, or description.

### Start the bot

**Development** (auto-restarts on file changes):
```bash
npm run dev
```

**Production** (compiled):
```bash
npm run build
npm start
```

---

## Configuring Ranks

Ranks are configured entirely through Discord — nothing is hardcoded.

### Add a rank tier

```
/admin addrank role:@Bronze name:Bronze min_points:10
/admin addrank role:@Silver name:Silver min_points:50 min_days:7
/admin addrank role:@Gold   name:Gold   min_points:150 min_days:30
```

- `role` — the Discord role to assign for this rank
- `name` — display name shown in bot messages
- `min_points` — points required to qualify
- `min_days` — days the user must have been in the server (optional, defaults to 0)

### View all tiers

```
/admin listranks
```

### Remove a tier

```
/admin removerank role:@Bronze
```

### How rank-ups work

When a user's points change (drop accepted or `/admin setpoints`), the bot checks if they qualify for a higher rank. If they do, it posts a notice in the **rank-up channel** with an **Approve Rank-Up** button. A staff member clicks the button to assign the role.

`/admin setrank` bypasses this and directly assigns a role regardless of requirements.

---

## Staff Workflow

1. A member runs `/drop`, selects an item via autocomplete, attaches a screenshot, and optionally tags teammates
2. The bot fetches the current price from the OSRS Wiki API and posts a pending embed to the **staff review channel**
3. Staff click one of three buttons:
   - **✅ Accept** — awards points to all team members, posts to the drop log channel, DMs the submitter
   - **❌ Reject** — cancels the submission and DMs the submitter
   - **✏️ Modify** — opens a form to change the item name and/or GP value, then re-shows the review embed

---

## Admin Commands

| Command | Description |
|---|---|
| `/admin setpoints user: points:` | Override a user's total points directly |
| `/admin setrank user: rank:` | Force assign a rank role (bypasses requirements) |
| `/admin addrank role: name: min_points: [min_days:]` | Add or update a rank tier |
| `/admin removerank role:` | Remove a rank tier |
| `/admin listranks` | List all configured rank tiers |

All admin commands require the `CLAN_ROLE_ID` role.
