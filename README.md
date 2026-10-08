<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/kumodeck-logo-dark.png">
    <img src="assets/kumodeck-logo-light.png" alt="KUMODeck" width="480">
  </picture>
</p>

# KUMODeck plugin

Make a web app or a game with an AI chat, and put it online with KUMODeck.

This plugin gives the AI two things:

- **Step-by-step guides (Skills)** for working with KUMODeck: start a new app or game, put it online, fix errors, save
  each player's data, add sign-in, make a game playable online with friends, rankings, chat, your own server code and
  database, and what to do when something is too big or too fast.
- **The KUMODeck connector** (`https://mcp.kumodeck.com/mcp`), so the AI can make your app or game on KUMODeck and put
  it online for you, right from the chat. The first time, you sign in to KUMODeck in your browser.

## Claude Code

Type these two lines in Claude Code:

```
/plugin marketplace add kumodeck/kumodeck-plugin
/plugin install kumodeck@kumodeck
```

Then ask, for example: "Build a small puzzle game on KUMODeck and put it online."

To get the newest guides later: `/plugin marketplace update kumodeck`.

## Claude (claude.ai, the desktop app)

1. Open **Customize → Connectors** and choose **Add custom connector**.
2. Paste this address and press **Add**: `https://mcp.kumodeck.com/mcp`
3. Sign in to KUMODeck when the window opens.

On a Team or Enterprise plan, the owner adds the connector for everyone in **Organization settings → Connectors**;
then each person presses **Connect** and signs in.

Connectors added on the web or the desktop app also work in the Claude phone apps.

## ChatGPT

1. In **Settings → Security and login**, turn on **Developer mode** (Plus, Pro, Business, Enterprise and Edu plans).
2. Open **Plugins**, press **+**, give it the name `KUMODeck` and paste this address: `https://mcp.kumodeck.com/mcp`
3. Sign in to KUMODeck when the window opens.

## Grok Bot

KUMODeck is waiting for review before it appears in Grok Bot's **Connect apps** list. Until then, add the connector
yourself:

1. In a chat with your Bot, send: `Add this MCP server: https://mcp.kumodeck.com/mcp`
2. Confirm when the Bot asks, then sign in to KUMODeck in the browser window that opens.
3. From your next message, the Bot can use KUMODeck. Try: "Build a small puzzle game on KUMODeck and put it online."

Once the listing is live: open **Connect apps**, search for **KUMODeck**, add it, and sign in to KUMODeck.

## Cursor

The KUMODeck plugin for the Cursor Marketplace is pending review, so it is not in the **Customize** page yet. Until it
is listed, add the connector yourself: open **Cursor Settings**, go to the MCP section (**Tools & MCP**), choose
**Add custom MCP**, and put this in the file that opens (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "kumodeck": { "url": "https://mcp.kumodeck.com/mcp" }
  }
}
```

Then press **Connect** next to `kumodeck` and sign in to KUMODeck.

Once the listing is live, you can instead find **KUMODeck** in the Cursor Marketplace (the **Customize** page), press
**Install**, and sign in to KUMODeck when the window opens.

## Codex

In the Codex CLI, type this in your terminal:

```
codex plugin marketplace add kumodeck/kumodeck-plugin
codex plugin add kumodeck@kumodeck
```

Or, inside the Codex CLI, enter `/plugins`, pick **KUMODeck** and install it. Sign in to KUMODeck when the window opens,
then start a new session and ask, for example: "Build a small puzzle game on KUMODeck and put it online."

## What the connector can do

The connector lives at `https://mcp.kumodeck.com/mcp` (streamable HTTP). The first time, you sign in to KUMODeck in your
browser (OAuth); no key is pasted into the chat.

What the AI can do with it:

| Group | What it does |
| --- | --- |
| Guides | Read KUMODeck's own how-to guides (`guide_read`) |
| Projects | List your projects, create or rename one, see an overview, check or pick its URL name, publish a game (`projects_list`, `project_*`, `publish_game`) |
| Settings | Read, check and save a project's settings (`config_*`) |
| Hosting and releases | Put an app or game online, upload a page, list releases and switch back to an earlier one, add or remove your own domain (`hosting_*`, `deployments_list`, `deploy_activate`) |
| Server code and database | Turn on server code (Functions), deploy it, see its status and logs, read and change its database, run migrations, set or remove its secrets, manage its domains (`functions_*`) |
| Players | Look up your app's players and read ban appeals (`players_search`, `player_get`, `appeals_list`) |
| Sharing | Turn on sharing, make share links, see share stats and tags (`share_*`) |
| Balance and usage | Read your prepaid balance and usage (`prepaid_get`, `usage_get`, `usage_daily`) |
| Confirmations | Continue an action after you confirmed it (`pending_action_continue`) |

**Changes to the live (production) version ask you to confirm first.** Nothing goes to production until you approve it.

Permissions (OAuth scopes) the sign-in asks for:

| Scope | Lets the AI |
| --- | --- |
| `read:projects` | See your projects |
| `read:reports` | See how many people came from your share links on X |
| `read:players` | Look up your app's players |
| `read:payouts` | See your usage fees and prepaid balance |
| `write:config` | Change project settings |
| `deploy` | Put a version online or switch versions |
| `read:functions` | See your server code and its status |
| `read:logs` | Read logs |
| `write:functions` | Deploy and change server code, its database and its secrets |

Privacy: <https://kumodeck.com/privacy> · Terms: <https://kumodeck.com/terms>

## What is inside

| Folder or file | What it is |
| --- | --- |
| `skills/` | The guides. `skills/INDEX.md` lists them and says when each one is used |
| `.mcp.json` | The KUMODeck connector address |
| `.claude-plugin/` | The plugin's name card and the list Claude Code reads with `/plugin marketplace add` |
| `.cursor-plugin/`, `mcp.json` | The plugin's name card and the connector address for Cursor |
| `.codex-plugin/`, `.agents/plugins/` | The plugin's name card and the list Codex reads with `codex plugin marketplace add` |
| `assets/` | The KUMODeck logo and icon |

## Help

support@kumodeck.com

## License

MIT — see [LICENSE](LICENSE).
