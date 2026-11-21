# Plugin UI

One home for everything plugins add to the editor: a **Plugins** button in the site canvas's toolbar and in the full-screen editor's header, in place of a growing row of plugin icons. A spike; see the pull request "Spike: one home for plugin UI" for what it settles and what it leaves open.

## What goes where

| What a plugin adds | Where it goes |
| --- | --- |
| A sidebar (`PluginSidebar`), its pinned icon and its More menu item | A row in the Plugins list. Opening it docks the sidebar beside the page, as core's complementary area, so it stays open while editing. A plugin opening its own sidebar, or toggling it from a menu item, lands in the same place. |
| Document panels (`PluginDocumentSettingPanel`) and status rows (`PluginPostStatusInfo`) | **Settings from plugins**, CnL's own docked panel, first in the list. A plugin with only these opens it from its row. The full-screen editor still has them in core's Post tab too. |
| More menu items (`PluginMoreMenuItem`) | **Actions**, at the end of the list, in both surfaces. Core's ⋮ menu no longer lists them. |
| Preview menu items (`PluginPreviewMenuItem`) | The canvas's View menu, after its own items, as core's View menu has them. |
| Block settings menu items (`PluginBlockSettingsMenuItem`) | More, in the block toolbar's options menu (`src/block-toolbar/`), unchanged. |
| Pre-publish panels (`PluginPrePublishPanel`) | Review changes, under "Before it's published", when saving publishes the open page or post. The full-screen editor's own publish step, which now runs whenever a plugin has one. |
| Post-publish panels (`PluginPostPublishPanel`) | A **Published** dialog after the canvas publishes the open page or post. Core's own panel in the full-screen editor. |
| Classic meta boxes | A notice at the top of the list, with **Open in the full editor** (`post.php`). |
| Commands only, no UI | Nothing: the plugin isn't listed. |

People can pin a plugin's sidebar from the pin in its header. Up to two pinned plugins sit beside the Plugins button on a wide screen, one on a tablet, none on a phone. Pinning a third replaces the oldest.

The button only shows while the editor is on show and when some plugin adds something to open, or the post has meta boxes.

## How it works

`registerPluginUi()`, from app init, registers CnL's own plugin, so its root renders inside boot's slots, where it can read and render the other plugins' fills. It portals the button into the canvas toolbar's `.cnl-site-canvas__plugins` host, fills `PinnedItems/core` in the full-screen header, renders the Settings from plugins sidebar, the pin, and the publish panels.

Core keeps no record of which plugin rendered which fill. `use-plugin-inventory.jsx` reads the fills of core's More menu and document panel options through a probe slot and ties each to its plugin by its sidebar identifier, panel name or icon. Every internal this leans on is in [`docs/editor-workarounds.md`](../../docs/editor-workarounds.md).

| File | What it does |
| --- | --- |
| `index.jsx` | `registerPluginUi()` and the root: the button's two homes, Settings from plugins, the pin, and the publish panels. |
| `use-plugin-inventory.jsx` | `usePluginInventory()`, what each plugin adds, and `SlotProbe`. |
| `plugins-menu.jsx` | The Plugins button, its list and any pinned plugins beside it. |
| `sidebars.js` | Opening plugin sidebars, and the pinned ones. |
| `action-items.js` | Reading menu items from core's action item fills. |
| `publish-host.js` | Where the review dialog wants pre-publish panels, whether saving publishes the open post, and whether any plugin checks before publishing. |

## Trying it

The fixture plugin in `tests/e2e/plugins/cnl-plugin-ui-fixture/` registers something in every slot. It is mapped into wp-env but not active:

```sh
npm run wp-env run cli wp plugin activate cnl-plugin-ui-fixture
```

Set the `cnl_plugin_ui_fixture_only` option to a comma-separated list of its plugin names, like `cnl-fixture-seo`, to register only those.
