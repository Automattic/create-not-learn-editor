# Driving the editor with WebMCP

An agent working in the browser can use the editor through [WebMCP](https://github.com/webmachinelearning/webmcp), the same way a person would. The editor registers its own tools (`src/webmcp/`), and they change the page open in the canvas, so the person sees each change as it happens.

Every change is an unsaved edit, like one made by hand. It can be undone, and nothing goes live until the person saves it with Save or Review changes. There's no tool for saving.

## Connecting an agent

Chrome 150 and newer has WebMCP behind the `--enable-features=WebMCP` flag. To connect Claude Code, or another MCP client, use Google's [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp). It starts Chrome with the flag and passes the page's tools on to the agent:

```sh
claude mcp add cnl-webmcp -- npx -y chrome-devtools-mcp@latest --categoryExperimentalWebmcp --chrome-arg=--enable-features=WebMCP --no-usage-statistics
```

Ask the agent to open the editor in that browser and log in. It can then list the page's tools with `list_webmcp_tools` and call them with `execute_webmcp_tool`.

## Trying it in Playground

The quickest way to try it is the [AI demo in Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint-ai.json), which needs nothing set up beyond Chrome DevTools MCP above. Give the agent the link and ask it to open it in its browser. Playground logs in and opens the editor in the Agent workspace, with the Fernhouse site, the AI plugin and both sets of tools ready. Playground passes on the site's tools along with tools of its own, named `playground_*`, which work on Playground rather than in the editor.

## Trying it locally

On a development copy, map the AI plugin and the [MCP Adapter](https://wordpress.org/plugins/mcp-adapter/) into `wp-env` with a `.wp-env.override.json`, as [CONTRIBUTING.md](../CONTRIBUTING.md#trying-another-plugin-alongside-the-editor) describes. Then activate them and turn on the WebMCP experiment under Settings > AI:

```sh
npm run wp-env run cli wp plugin activate ai mcp-adapter
npm run wp-env run cli wp option update wpai_feature_webmcp_enabled 1
```

The AI plugin's other features, and the AI the site uses itself, need an AI provider set up under Settings > Connectors.

## The tools

| Tool | What it does |
| --- | --- |
| `cnl-connect` | Gives the agent's name, for the canvas toolbar's list of its changes |
| `cnl-start-task` | Names what the agent is working on, so its changes are grouped under it |
| `cnl-set-workspace` | Switches workspace, such as to Agent, where the canvas fills the screen so the person can watch, and keeps the page open |
| `cnl-set-canvas` | Switches the canvas to Browse, Edit or Compose, and to desktop, tablet or mobile. Browse asks the person about unsaved changes first, as the canvas's own switch does |
| `cnl-list-pages` | Lists the pages, which one is the homepage and which one is open |
| `cnl-open-page` | Opens a page in the canvas, by ID, title or `home` |
| `cnl-get-page` | Lists the open page's sections by number, as the canvas names them, with the colours, layouts and widths each can take |
| `cnl-get-designs` | Lists the section designs, the theme's first |
| `cnl-get-site-style` | Lists the looks, palettes and font pairings, and which are in use |
| `cnl-get-changes` | Lists the unsaved changes, and whether each shows on every page |
| `cnl-add-section` | Adds a design, or a blank section, at a place on the page |
| `cnl-move-section`, `cnl-duplicate-section`, `cnl-remove-section` | Move, copy or remove a section |
| `cnl-style-section` | Sets a section's colour, layout and width, from what Edit design offers |
| `cnl-set-site-style` | Applies a look, palette or font pairing to the whole site |
| `cnl-set-site-title` | Changes the site title and tagline |

The tools make each change with the same functions as the editor's own controls, and number sections as the canvas shows them, with a run of plain text counting as one Text section. Only their names and descriptions load with the page, and only in a browser with WebMCP. The rest loads the first time a tool is called.

## The AI plugin's tools

The tools work alongside the official [AI plugin](https://wordpress.org/plugins/ai/). Its WebMCP experiment adds tools that work on single blocks (`editor-get-document`, `editor-update-block-text` and others), and the editor loads them on its page too (`includes/plugin-compat.php`). Through the plugin's `wpai.webmcp.tools` filter, they see the page's blocks inside its template, add blocks to the page's content when given no place, and flash what they change.

## Watching the changes

Each change is scrolled into view and flashed for three seconds, without being picked, so the person can watch without the editor's bars opening over the page. The flash is an orange outline and tint, the agent's own colour, with an "Updated by agent" badge in the block label's place (`src/webmcp/flash.js`, `includes/block-canvas-styles.php`). It looks like core's highlight, but is drawn by the editor, as core's `flashBlock` only highlights one block at a time. WebMCP doesn't tell the page which agent called a tool, so the badge can't name it.

In the Agent workspace, while an agent is connected, the canvas toolbar says "Agent: connected" before Save, with a green dot that pulses while the agent works (`src/top-bar/agent-status.jsx`).

Opened, it lists what the agent has changed since the editor loaded, under its name, as one row for each request it worked on, newest first, so a long session stays short to read. The agent names each request with `cnl-start-task`, and its changes go under it until it names the next; changes it makes without naming one are grouped until it pauses for two minutes.

Picking a row flashes all of its changes at once, scrolled so they're all in view if they fit. A block that changed several times, or sits inside another that changed, flashes once.

The page isn't told when an agent connects, so it counts one as connected once a tool is called, or from the start in a browser an agent drives, as Chrome DevTools MCP's is. The agent gives its name with `cnl-connect`.
