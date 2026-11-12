# Agent Instructions

This is a standalone WordPress plugin repo for Create Not Learn Editor.

## Documentation

The README is for people trying the editor and explains the ideas behind it. The detail you need to work on the code lives elsewhere. Read only the doc for the area you're changing, not all of them:

- [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, wp-env and its shared downloads, scripts, verification and the repository layout.
- [docs/architecture.md](docs/architecture.md) covers the editor shell and routes, what is edited as sections and what as blocks, the visual theme, explicit site changes, the Gutenberg version check and opening in a workspace.
- [docs/webmcp.md](docs/webmcp.md) covers the editor's WebMCP tools, the official AI plugin's tools alongside them, and how an agent connects.
- [docs/demo-site-and-playground.md](docs/demo-site-and-playground.md) covers the Mainstay theme, the demo seed, the shop and the Playground demos, and the rules for changing them. Read it before touching `themes/`, `scripts/demo-site/`, `demos/` or the Playground workflows.
- [docs/editor-workarounds.md](docs/editor-workarounds.md) lists every reliance on private APIs or core internals. Add an entry there whenever you add one.
- [docs/vendored-list-view.md](docs/vendored-list-view.md) covers the vendored ListView bridge.
- Folders such as `src/editor-layer/`, `src/block-toolbar/` and `src/site-canvas/` have their own README. Read it when you work in that folder.

Keep those files current when behaviour they describe changes. Keep the README to what the editor is, why it exists and how to try it.

## Working Lean

Every turn re-reads the whole conversation, so long sessions cost far more than short ones.

- One task per session. When a PR merges, or the task changes, suggest that David starts a fresh session rather than carrying on in this one.
- Search before reading. Read large files by line range around what search finds, rather than whole. Several files in `src/` are over 20KB.
- Keep command output short. Pipe long output through `tail`, `head` or `grep`, and don't re-run a command just to see its output again.
- Keep screenshots few and small. Clip them to the part that matters and save them under `.context/`.
- Gutenberg's JavaScript source is in `node_modules/@wordpress/*/src`, and the Gutenberg plugin wp-env runs, PHP included, is in `~/.cache/create-not-learn-editor/wp-env/gutenberg-<version>/`. Look there rather than searching the web or the whole disk.

## Core Direction

- Keep this plugin independent from the Gutenberg repository.
- Do not add a Gutenberg checkout, submodule, or source mount.
- Do not copy Gutenberg source except for the scripted, provenance-tracked ListView vendor bridge under `src/vendor/gutenberg/list-view/`.
- Consume released WordPress and Gutenberg packages.
- Preserve the plugin dependency on the released Gutenberg plugin.
- The editor should mirror Gutenberg's experimental `site-editor-v2` full-page setup where practical.

## Visual Parity Rules

- Do not artificially enlarge standard WordPress/Gutenberg component sizing to match screenshots that may show only part of a page or UI. Preserve proportional component sizing from the prototype or established WordPress defaults unless a full-context design explicitly requires otherwise.

## Important Runtime Facts

- Plugin slug: `create-not-learn-editor`.
- Full-page admin URL: `/wp-admin/admin.php?page=create-not-learn-editor`.
- WordPress menu location: `Appearance > Create Not Learn`.
- Required Gutenberg version: `24.0.0` or newer.
- Minimum PHP version: `7.4`.
- WordPress dependency header must keep `Requires Plugins: gutenberg`.

## Build Artifacts

- `build/` is generated and ignored by git.
- `*.zip` plugin packages are generated and ignored by git.
- Do not commit `node_modules/`, `build/`, or plugin zip files.
- Run `npm run build` before runtime checks or `npm run plugin-zip`.

## wp-env, Demos and Playground

- Always run wp-env through `npm run wp-env ...`, never the `wp-env` binary, and don't point `.wp-env.json` at download URLs. Versions live in `scripts/wp-env.mjs`. CONTRIBUTING.md explains the shared downloads.
- Start it with `npm run wp-env start -- --auto-port`, which prints the port it picked, and preview changes there rather than reasoning about behaviour from code alone. The editor is at `http://localhost:<port>/wp-admin/admin.php?page=create-not-learn-editor`.
- `npm run dev` is the watch build. Stop it before finishing unless David wants it left running.
- `themes/mainstay/` and `scripts/demo-site/` are the development site's demo, not part of the plugin. Keep the seed additive and idempotent.
- `demos/` holds the Playground blueprints. Never commit to the `playground-build` branch, or create, push to or move `refs/playground/*` refs or `playground-v*` tags, by hand.
- Read [docs/demo-site-and-playground.md](docs/demo-site-and-playground.md) before changing any of these.

Check the UI with `npm run ui` by default, and fall back to the browser MCP only when it can't do what you need. It opens an editor path logged in (with the login `tests/e2e/global-setup.js` saves), runs a few clicks, prints a short text summary of the page and can save a 1x JPEG to `.context/`, e.g. `npm run ui -- p=/types/page --click "Add page" --shot add-page`. See `npm run ui -- --help`. Don't write Playwright scripts or login code inline.

## Verification Expectations

CI (`.github/workflows/ci.yml`) runs the build, lints, ListView check, PHP lint, unit tests and the sharded e2e suite on every pull request, and trunk requires them to pass. Don't run the full e2e suite locally; it is slow and costs tokens.

Before handing off code changes:

1. Run the quick checks locally: `npm run build`, `npm run lint:js` and `npm run lint:css`, plus `npm run test:php` when PHP changed. Cover new PHP logic with a PHPUnit test in `tests/phpunit/` rather than an e2e test.
2. Run only the e2e specs that cover what you changed, against the `wp-env` tests site, e.g. `WP_BASE_URL=http://localhost:<tests-port> npx playwright test tests/e2e/interactions/compose.spec.js`.
3. Once the branch is pushed, wait with `gh pr checks --watch` and, if something fails, read just `gh run view <run-id> --log-failed`. Fix and push again until the checks pass.

A change that alters behaviour a test checks must update that test in the same pull request.

For runtime checks, use the `wp-env` instance above.

## Editor Architecture

- PHP full-page shell lives in `includes/admin-page.php`. The routes and sidebar items it boots with are registered in `includes/editor-registry.php`, its scripts, modules and styles in `includes/editor-assets.php`, and `window.createNotLearnEditor` is built in `includes/app-settings.php`.
- Every `includes/*.php` file adds its hooks in a `cnl_editor_register_*_hooks()` function that `cnl_editor_bootstrap()` calls, never when the file loads. Paths and URLs into Gutenberg go through `cnl_editor_get_gutenberg_path()` and `cnl_editor_get_gutenberg_url()`.
- Route implementations live under `src/routes/`.
- Build entry wrappers live under root `routes/` for `@wordpress/build`.
- Shared client settings live in `src/settings.js`.
- REST helpers live in `src/records.js`.
- Shared WordPress package imports are centralized in `src/wordpress-packages.js`.
- Styles live beside the code they style, in `_style.scss` or `_<name>.scss` partials. `src/style.scss` only puts them in order, and app-init's `packages/app-init/src/style.scss` loads it with the sidebar's and the other features' stylesheets. Styles more than one screen shares, the stage, the canvas and the DataViews lists, are in `src/styles/`. Add a partial to the index rather than rules to the index itself, and keep its place in the order, since a later rule wins over an earlier one of the same weight.
- Customisations of the full-screen edit canvas live in the editor layer, `src/editor-layer/`. It hides, adds to and configures core's editor from outside rather than forking it; see its README before working around the editor another way.
- The block toolbar's rework, after Gutenberg's proposal for it, lives in `src/block-toolbar/`. It works from outside core's toolbar, through its slots and a stylesheet; see its README before changing core's toolbar another way.
- Pickers used by more than one screen live in `src/pickers/`. Change a picker there rather than copying it, so the screens stay the same.
- The editor's section picker comes from `packages/app-init-deferred`, a script module app init fetches once the page is idle (`src/app-init-deferred.js`), so page boot doesn't wait for it.
- Section editing (Add section, Edit design, Compose) is only for content the site says is built from sections: post types supporting `create-not-learn-editor-sections`, as pages do, changed per post by the `create-not-learn-editor_has_sections` filter (`includes/sections.php`). Ask `hasSections()` from `src/sections.js`; never check for pages or name plugins' pages in the editor. Everything else is edited block by block. Layouts and template parts don't have sections by default, but answer through the same support and filter, so never rule a post type in or out in code; keep every default changeable. Template parts always get the part treatment. See `docs/architecture.md`.
- The editor's WebMCP tools live in `src/webmcp/`. App init registers their names, descriptions and inputs (`declarations.js`) only where the browser has WebMCP; what they do (`tools.js`) comes from `packages/app-init-deferred` the first time one is called. Make each change with the functions the editor's own controls use, as an unsaved edit, and add no tool that saves. The official AI plugin's WebMCP block tools load on the page too, from `includes/plugin-compat.php`. See `docs/webmcp.md`.
- The temporary vendored ListView bridge lives in `src/vendor/gutenberg/list-view/` and must be regenerated with `npm run sync:list-view`, not edited by hand.

Import WordPress packages from `@wordpress/*` modules instead of reading them from `window.wp`. Build assets are generated by `@wordpress/build`, which writes the dependency metadata PHP needs to enqueue package scripts and script modules.

Write components in JSX, not `createElement` calls. `@wordpress/build` only parses JSX in `.jsx` files, so any module containing JSX must use the `.jsx` extension; modules without JSX stay `.js`. The root `eslint.config.cjs` extends the `@wordpress/scripts` config so `.jsx` files are linted.

Code comments explain why the code is as it is, briefly. The story of a feature's design, and how its parts fit together, goes in the folder's README or `docs/`, with a link from the code if it helps. Tidy over-long comments in code you're already changing, but don't sweep files just to trim them.

Root `routes/*` files should stay thin re-export wrappers around the source route modules. Do not put substantive route implementation in the wrappers unless the build tool requires it.

`@wordpress/build` bundles each route module separately, with its own copy of everything it imports. So screens that share source share one module: `routes/static` serves Design, Colors, Fonts, Name & logo and the Advanced lists, `routes/site-part` serves Header, Footer and Header & footer, and `routes/content` serves both content paths. `cnl_editor_get_routes()` maps each path to its module, and the screen is picked by path. Add a screen to one of these rather than giving it a wrapper of its own that bundles the same code again.

DataViews is the biggest package the editor uses, so it lives in its own script module, `packages/dataviews`, which screens load with `useDataViews()` from `src/use-dataviews.js` the first time they show a list. Don't import `@wordpress/dataviews` anywhere else.

Don't import `@wordpress/block-library` either: any import puts the whole library on every screen's page load. The editor's assets load and register WordPress's blocks; wait for `useEditorAssets()` before building blocks, as the Menus edit canvas does.

## Site Mutation Rules

- Do not mutate site defaults when the editor loads, except that every site needs a menu to edit: `cnl_editor_ensure_default_navigation_menu()` (`includes/setup-defaults.php`) runs on every full-page editor load and makes one, as WordPress's own Navigation block does on the front end when none exists. It is a no-op once a menu exists.
- Keep homepage setup (the static front page and Reading settings) behind the explicit setup action.
- The setup action should remain idempotent.
- The setup endpoint is `POST /wp-json/create-not-learn-editor/v1/setup-defaults`.

## Git Rules

- Do not commit or push unless David explicitly asks.
- Never push without a separate explicit confirmation.
- Keep commits source-only unless David asks for generated artifacts.
- No GitHub remote is expected by default.
