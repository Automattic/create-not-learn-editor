# Driving the editor with WebMCP

An agent working in the browser can use the editor through [WebMCP](https://github.com/webmachinelearning/webmcp), the same way a person would. The editor registers its own tools (`src/webmcp/`), and they change the page open in the canvas, so the person sees each change as it happens.

Every change is an unsaved edit, like one made by hand. It can be undone, and nothing goes live until the person saves it with Save or Review changes. There's no tool for saving.

| Tool | What it does |
| --- | --- |
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

The tools work alongside the official [AI plugin](https://wordpress.org/plugins/ai/). Its WebMCP experiment adds tools that work on single blocks (`editor-get-document`, `editor-update-block-text` and others), and the editor loads them on its page too (`includes/plugin-compat.php`).

To try both, map the AI plugin and the [MCP Adapter](https://wordpress.org/plugins/mcp-adapter/) into `wp-env` with a `.wp-env.override.json`, as [CONTRIBUTING.md](../CONTRIBUTING.md#trying-another-plugin-alongside-the-editor) describes. Then activate them and turn on the WebMCP experiment under Settings > AI:

```sh
npm run wp-env run cli wp plugin activate ai mcp-adapter
npm run wp-env run cli wp option update wpai_feature_webmcp_enabled 1
```

The AI plugin's other features, and the AI the site uses itself, need an AI provider set up under Settings > Connectors.

Chrome 150 and newer has WebMCP behind the `--enable-features=WebMCP` flag. To connect Claude Code, or another MCP client, use Google's [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp). It starts Chrome with the flag and passes the page's tools on to the agent:

```sh
claude mcp add cnl-webmcp -- npx -y chrome-devtools-mcp@latest --categoryExperimentalWebmcp --chrome-arg=--enable-features=WebMCP --no-usage-statistics
```

Ask the agent to open the editor in that browser and log in. It can then list the page's tools with `list_webmcp_tools` and call them with `execute_webmcp_tool`.
