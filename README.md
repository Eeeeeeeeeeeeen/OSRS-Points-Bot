# OSRS Clan Bot

A Discord bot for managing clan drop submissions and a points-based rank system. Members submit item drops with screenshots, staff review and approve them, and points are awarded based on real-time OSRS Grand Exchange prices or fixed admin-configured values.

## Features

- `/drop` — Submit a drop with a screenshot and optional teammates; prices fetched from the OSRS Wiki API
- Supports GE-traded items, pets, custom untradeables, and multi-part items (e.g. Soulreaper Axe pieces)
- Points rounded to the nearest point (1 pt per 1M GP, max 200 pts), split equally among team members
- Staff review channel with Accept / Reject / Modify buttons
- Configurable rank tiers with optional time-in-server requirements and a staff-approval workflow for rank-ups
- `/points` — View your own points, rank progress, and recent drops
- `/leaderboard` — Paginated clan leaderboard
- Full suite of `/admin` commands for points, ranks, item overrides, pets, and custom items

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A Discord application and bot created in the [Discord Developer Portal](https://discord.com/developers/applications)

---

## Discord Developer Portal Setup

### 1. Create an application and bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name
3. Go to the **Bot** tab and click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it — this is your `DISCORD_TOKEN`
5. Under **Privileged Gateway Intents**, enable **Server Members Intent** (required for fetching member join dates and assigning roles)

### 2. Get your IDs

Enable **Developer Mode** in Discord: **User Settings → Advanced → Developer Mode**

| Value | How to get it |
|---|---|
| `CLIENT_ID` | Developer Portal → your app → **General Information** → Application ID |
| `GUILD_ID` | Right-click your server name → **Copy Server ID** |
| `ADMIN_ROLE_ID` | Right-click the admin role → **Copy Role ID** |
| `STAFF_ROLE_ID` | Right-click the staff role → **Copy Role ID** |
| `STAFF_REVIEW_CHANNEL_ID` | Right-click the review channel → **Copy Channel ID** |
| `DROP_LOG_CHANNEL_ID` | Right-click the drop log channel → **Copy Channel ID** |
| `RANK_UP_CHANNEL_ID` | Right-click the rank-up channel → **Copy Channel ID** |

### 3. Invite the bot

Build an invite URL under **OAuth2 → URL Generator**:
- Scopes: `bot`, `applications.commands`
- Bot permissions: `Manage Roles`, `Send Messages`, `Embed Links`, `Read Message History`

> **Important:** The bot's role must be positioned **above** any rank roles it manages in **Server Settings → Roles**.

---

## Installation

```bash
git clone <your-repo-url>
cd OSRS-Clan-Bot
npm install
cp .env.example .env
```

Edit `.env` and fill in all values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id
GUILD_ID=your_server_id

ADMIN_ROLE_ID=id_of_your_admin_role
STAFF_ROLE_ID=id_of_your_staff_role

STAFF_REVIEW_CHANNEL_ID=id_of_drop_review_channel
DROP_LOG_CHANNEL_ID=id_of_drop_log_channel
RANK_UP_CHANNEL_ID=id_of_rank_up_channel

DB_PATH=./data/clan.db
```

> **Never commit your `.env` file.** It is already in `.gitignore`.

---

## Running the Bot

```bash
# Register slash commands (once, or after any command changes)
npm run deploy-commands

# Development — auto-restarts on file changes
npm run dev

# Production
npm run build
npm start
```

---

## Points System

| Scenario | Points |
|---|---|
| GE item (live price) | 1 pt per 1M GP, rounded to nearest pt |
| GE item with fixed override | Fixed pts set by admin |
| Pet | Default pet pts (admin-configured), or individual override |
| Custom untradeable | Fixed pts set per item |
| Multi-part item (e.g. axe piece) | Parent item pts ÷ number of parts |

All awards are **split equally** among team members and **capped at 200 pts per person**.

For multi-part items using the live GE price, the GP value is divided across parts **before** converting to points — so the 200 pt cap applies per part, not to the whole item first.

---

## Staff Workflow

1. A member runs `/drop`, searches for an item via autocomplete, attaches a screenshot, and optionally tags up to 5 teammates
2. The bot posts a pending embed to the **staff review channel**
3. Staff click one of three buttons:
   - **✅ Accept** — awards points to all team members, posts to the drop log channel, DMs the submitter
   - **❌ Reject** — cancels the submission with an optional reason, DMs the submitter
   - **✏️ Modify** — opens a modal to adjust the item name and/or GP value before re-reviewing

---

## Rank System

Ranks are configured entirely through Discord — nothing is hardcoded.

```
/admin addrank role:@Bronze name:Bronze min_points:10
/admin addrank role:@Silver name:Silver min_points:50 min_days:7
/admin addrank role:@Gold   name:Gold   min_points:150 min_days:30
```

When a member's points change, the bot checks if they qualify for a higher rank. If they do, it posts a notice in the **rank-up channel** with an **Approve Rank-Up** button for staff to click.

`/admin setrank` bypasses requirements and assigns a role directly.

---

## Item Configuration

### GE item point overrides

Lock a GE item to a fixed point value instead of using the live price:

```
/admin setitempoints item:Twisted bow points:150
/admin removeitempoints item:Twisted bow
/admin listitempoints
```

### Pet default points

Set a default award for all pets (applied when no individual override is set):

```
/admin setcategorypoints category:Pet points:50
```

Override individual pets through the same interface as GE items:

```
/admin setitempoints item:Olmlet [Pet] points:75
/admin removeitempoints item:Olmlet [Pet]   ← reverts to pet default
```

### Custom untradeables

Add untradeable items that don't appear on the GE:

```
/admin addcustomitem name:"Torva platebody" category:Untradeable points:100
/admin removecustomitem item:Torva platebody
/admin listcustomitems
```

### Multi-part items

For items whose untradeable pieces each award a share of the parent's points (e.g. Soulreaper Axe):

1. Ensure the parent item already has points configured — either a GE item with a fixed override via `/admin setitempoints`, or any GE item (live price will be used)
2. Add each piece as a custom item and link it to the parent:

```
/admin addcustomitem name:"Soulreaper axe (piece 1)" category:Untradeable is_component_of:Soulreaper axe
/admin addcustomitem name:"Soulreaper axe (piece 2)" category:Untradeable is_component_of:Soulreaper axe
/admin addcustomitem name:"Soulreaper axe (piece 3)" category:Untradeable is_component_of:Soulreaper axe
/admin addcustomitem name:"Soulreaper axe (piece 4)" category:Untradeable is_component_of:Soulreaper axe
```

Each piece automatically awards `parent pts ÷ number of linked pieces`. Adding or removing pieces adjusts the split automatically.

Pets are auto-populated from the OSRS Wiki on startup — you only need to configure points for them.

---

## Event Points

Award or deduct points for up to 10 members at once (e.g. for event participation):

```
/admin eventpoints mode:Add points:10 reason:"Castle Wars event" user1:@Alice user2:@Bob
/admin eventpoints mode:Deduct points:5 reason:"Missed meeting" user1:@Charlie
```

A summary embed is posted to the drop log channel.

---

## Admin Command Reference

| Command | Description |
|---|---|
| `/admin setpoints user: points:` | Override a user's total points directly |
| `/admin setrank user: rank:` | Force assign a rank role (bypasses requirements) |
| `/admin addrank role: name: min_points: [min_days:]` | Add or update a rank tier |
| `/admin removerank role:` | Remove a rank tier |
| `/admin listranks` | List all configured rank tiers |
| `/admin setitempoints item: points:` | Set a fixed points value for a GE item or pet |
| `/admin removeitempoints item:` | Remove a fixed points override (reverts to live price or pet default) |
| `/admin listitempoints` | List all item point overrides |
| `/admin setcategorypoints category: points:` | Set the default points for all pets |
| `/admin addcustomitem name: [category:] [points:] [is_component_of:]` | Add or update a custom item |
| `/admin removecustomitem item:` | Remove a custom item |
| `/admin listcustomitems` | List all custom items, pets, and linked parts |
| `/admin eventpoints mode: points: reason: user1: [user2–10:]` | Bulk add or deduct points |
| `/admin removedrops user:` | Remove an accepted drop and deduct its points |

Admin commands require the `ADMIN_ROLE_ID` role. Staff commands (Accept/Reject/Modify buttons) require `STAFF_ROLE_ID`.
