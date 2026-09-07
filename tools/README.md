# Snakes &amp; Ladders Board Builder

`snl-board-builder.html` builds the board file that `/snl setup` asks for, without anyone
having to write JSON by hand.

## Running it

**Double-click `snl-board-builder.html`.** It opens in your web browser and that's it — no
install, no Node, no command line. It is a single file, so you can email it to whoever is
organising the event or drop it on a shared drive.

An internet connection is needed for the item search (it reads the live item list from the
OSRS Wiki price API). Without one the page still works, but items have to be added by ID.

## Building a board

1. Fill in the board name and how many squares it has. Square 1 is bottom-left and the
   numbers snake back and forth, like a real board.
2. Click a square and choose what it does:
   - **Nothing** — teams pass straight over it.
   - **Needs item** — search for the drops that count, set how many are required, and
     optionally add a short label (e.g. *Any Godsword blade*) to stand in for a long list.
   - **Ladder** / **Snake** — pick the square it leads to.
3. Watch the **Checks** panel. It applies exactly the same rules the bot does, so anything
   listed there as an error would be rejected by `/snl setup`. Notes in amber are only
   suggestions.
4. Click **Download board JSON**, then upload that file in Discord with `/snl setup`.

Work is saved in the browser as you go, so the page can be closed and reopened. Use
**Open board file…** to load an existing board (for example `snl-board.example.json` in the
project root) and edit it; **Start over** clears everything.

## The board picture

**Download board picture (PNG)** draws the whole board — item icons, snakes and ladders,
square numbers — as one image sized for Discord.

The bot stores a *link* to the picture rather than the file, so:

1. Download the PNG.
2. Upload it somewhere permanent — [Imgur](https://imgur.com/upload) is the easy option — and
   copy the direct image link.
3. Run `/snl setimage <link>` (or pass `image:` when you run `/snl setup`).

Posting the PNG in Discord and copying *that* link works for a while, but those attachment
links expire and the picture will stop showing — the bot warns you if you use one.

## Notes

- Custom items (untradeables, pets, multi-part pieces) live only in the bot's database, so
  the builder can't fetch them. Run `/listcustomitems` in Discord: each entry now shows its
  ID (`custom:14`), and the command attaches a `custom-items.json`. Save that file, press
  **Load custom items** in the builder, and they become searchable by name alongside GE
  items — they're listed first, since they're the ones you can't look up anywhere else. The
  list is remembered between sessions, and **Add a custom item by ID** is still there if you
  only need one.
- The final square can't hold an item, a snake, or a ladder — reaching it wins the game.
- Square 1 can't start a snake or a ladder either, though it can require an item.
- A square that starts a snake or a ladder can't also require an item: teams owe the item
  where they end up, not where they landed.
- Snakes and ladders can't be chained; one can't land on the start of another.
