# Contributing

Thanks for helping out. This page covers setting up a development copy, building and checking your changes. The [docs](docs/) folder goes deeper on how the editor works.

If you're an agent, read [AGENTS.md](AGENTS.md) as well. It has the rules this repo expects you to follow.

## Getting set up

Install dependencies:

```sh
npm install
```

Start the local WordPress environment:

```sh
WP_ENV_PORT="<dev-port>" WP_ENV_TESTS_PORT="<test-port>" npm run wp-env start
```

Use available non-default local ports for `WP_ENV_PORT` and `WP_ENV_TESTS_PORT`.

The local environment uses WordPress 7.1 with the released Gutenberg 24.0.0 plugin. `npm run wp-env start` downloads these once into a cache that every checkout shares (`~/.cache/create-not-learn-editor/wp-env`), rather than once per checkout.

### How the shared downloads work

Always run wp-env through `npm run wp-env ...`, not the `wp-env` binary. `npm run wp-env` runs `scripts/wp-env.mjs`, which serves wp-env's downloads from the shared cache before passing the command on.

- Every checkout gets its own wp-env work directory, so letting wp-env download for itself means WordPress, Gutenberg and two PHPUnit clones per checkout. That is enough traffic to get throttled by wordpress.org and GitHub. Don't point `.wp-env.json` back at download URLs.
- On `start`, the script fills the cache (`~/.cache/create-not-learn-editor/wp-env`, or `CNL_WP_ENV_CACHE`) with anything missing, then sets up `.wp-env/sources/`, which `.wp-env.json` points at and git ignores. Gutenberg is a symlink into the cache. WordPress is copied into the checkout, because wp-env writes `wp-config.php` and uploads into it.
- Versions live in `scripts/wp-env.mjs`, not `.wp-env.json`. Each version downloads once. To change WordPress, update its `key` with its URL. To change the Gutenberg every checkout runs, the minimum the editor supports, change `GUTENBERG_PIN`, and keep the blueprints' Gutenberg version in step.
- wp-env always runs `git fetch` in its PHPUnit clones. The script points them at a cached wordpress-develop clone, so that fetch stays local.
- Keep the environment to what the editor needs, which is WordPress, Gutenberg, this plugin and the Mainstay theme. Optional plugins belong in a local `.wp-env.override.json`, as below, not in `.wp-env.json`.

### Trying another Gutenberg

Set `CNL_GUTENBERG_VERSION` when starting wp-env to run another Gutenberg than the pin: a release such as `24.4.2`, a release candidate such as `24.5.0-rc.1`, `latest` for the newest release, or `trunk` for the newest build of Gutenberg's trunk.

```sh
CNL_GUTENBERG_VERSION=latest npm run wp-env start
```

Each resolves to a version with a key of its own in the shared cache, so it downloads once and leaves the pin's in place. Trunk's builds are GitHub Actions artifacts, so `trunk` needs `GITHUB_TOKEN` or `GH_TOKEN`, or `gh` signed in, and is keyed by its commit. `trunk-<commit>` runs one build again. Start without the variable to go back to the pin. When the Gutenberg changes, the script stops wp-env before starting it, as Docker only follows the link into the cache when it makes the containers. The sites keep their data. `node scripts/wp-env.mjs --resolve-gutenberg` prints what a value resolves to without starting anything.

The [Gutenberg compatibility workflow](.github/workflows/gutenberg-compat.yml) runs the build, PHPUnit and the smoke test each week against the minimum, the latest release, trunk and the Gutenberg WordPress.com runs, from `.github/wpcom-gutenberg-version`. A version that fails gets an issue titled "Gutenberg compatibility: <version>". Pull requests still run the pin only.

### Trying another plugin alongside the editor

To try another plugin alongside the editor, such as [Canvas](https://github.com/Automattic/canvas), build it somewhere and map it in a `.wp-env.override.json` next to `.wp-env.json`. The file is ignored by git.

```json
{
	"mappings": {
		"wp-content/plugins/canvas": "~/path/to/canvas"
	}
}
```

Then restart and activate it:

```sh
npm run wp-env start
npm run wp-env run cli wp plugin activate canvas
```

## Building

Run the development build watcher:

```sh
npm run dev
```

Create production assets:

```sh
npm run build
```

Create an installable plugin zip:

```sh
npm run plugin-zip
```

Generated `build/` assets and plugin zips are intentionally ignored by git. The source repo is the canonical state; build artifacts are generated when needed.

## Scripts

- `npm run dev` watches and rebuilds development assets.
- `npm run start` is an alias for the same watcher.
- `npm run build` builds production assets.
- `npm run sync:list-view` regenerates the temporary vendored Gutenberg ListView bridge from the pinned `@wordpress/block-editor` package.
- `npm run check:list-view` verifies the committed ListView bridge is current.
- `npm run lint:js` runs JavaScript linting.
- `npm run lint:css` runs stylesheet linting.
- `npm run test:unit` runs the unit tests with Vitest. Its settings live in `vitest.config.mjs`.
- `npm run test:php` runs the PHPUnit tests in `tests/phpunit/` inside wp-env's tests container, with WordPress and Gutenberg loaded. Start wp-env first. The first run installs Composer's dev packages into `vendor/`. Arguments go to PHPUnit, e.g. `npm run test:php -- --filter Setup_Defaults`. Test the PHP here, not through the browser, whenever an e2e test would only be checking what the server returns. PHPUnit can't set the query string the editor reads with `filter_input()`, so code that asks whether a request is a canvas preview or the full-page editor can be switched on with the `create-not-learn-editor_is_preview_frame_request` and `create-not-learn-editor_is_full_page_request` filters instead, as `tests/phpunit/request-detection-test.php` does.
- `npm run perf:budget` checks the build against the performance budget. Run `npm run build` first. See [the performance budget](docs/performance-budget.md).
- `npm run plugin-zip` creates an installable plugin zip.
- `npm run test:e2e` runs every end-to-end test against the `wp-env` tests site. `test:e2e:smoke`, `test:e2e:views` and `test:e2e:interactions` run one group. See [the end-to-end tests guide](tests/e2e/README.md).
- `npm run wporg-assets` renders the plugin directory icon and banner PNGs in `.wordpress-org/`.
- `npm run wp-env` proxies to `wp-env`, after preparing the shared downloads on `start`.
- `npm run i18n` makes the translation template and module JSON with WP-CLI. See [Translations](#translations).

## Verification

[The CI workflow](.github/workflows/ci.yml) runs on every pull request. One job builds, lints JS, CSS and PHP, checks the ListView bridge and runs the unit tests. Another runs PHPUnit in a `wp-env`. Another checks the build against [the performance budget](docs/performance-budget.md). The last runs the end-to-end tests over six shards, each with its own `wp-env`. Pull requests that only change docs skip the end-to-end tests. Trunk only takes a pull request once they all pass.

Before pushing, run the quick checks locally:

```sh
npm run build
npm run lint:js
npm run lint:css
npm run perf:budget
```

Then let CI run the rest. `gh pr checks --watch` waits for the results, and `gh run view <run-id> --log-failed` shows only the steps that failed. A failed end-to-end shard uploads its screenshots and traces as an artifact. Run a single end-to-end spec locally when you are fixing it, rather than the whole suite.

When checking runtime behavior, start `wp-env` with explicit local ports and visit:

```text
http://localhost:<dev-port>/wp-admin/admin.php?page=create-not-learn-editor
```

## Translations

Every string the editor adds is in the `create-not-learn-editor` text domain. In JavaScript that means passing it to `__()`, `_x()`, `_n()` and `_nx()`, which the `@wordpress/i18n-text-domain` lint rule checks for `src/`, `routes/` and `packages/*/src/`. `npm run lint:js -- --fix` adds a missing domain.

A few strings are deliberately core's, in the default domain, because the editor finds one of core's controls by its words, such as the format buttons in `src/block-toolbar/`. They turn the rule off where they are, saying why. Section wording (`src/editor-layer/section-wording.js`) swaps core's strings through the default domain's gettext filters, and says its replacements in the editor's own domain.

How they load:

- Each of the editor's script modules is registered with `wp_set_script_module_translations()` (WordPress 7.0) in `includes/translations.php`. `@wordpress/build` has no text domain option for plugin builds, so the editor sets it when it registers its modules itself.
- WordPress finds a module's translations by the md5 of its unminified path in the plugin, as it does for scripts, such as `create-not-learn-editor-de_DE-<md5 of build/routes/home/content.js>.json` in `wp-content/languages/plugins`.
- The full-page editor prints them itself, before the modules run, since it doesn't fire `admin_print_footer_scripts`, where core prints them.
- A string with no translation in the editor's domain falls back to core's translation of the same words, so strings like "Save" stay translated while a language pack is missing or behind.

#### The core translation fallback

`cnl_editor_get_core_translation_fallback_script()` in `includes/translations.php` adds a 1 KB inline script after `wp-i18n`. It uses only `@wordpress/i18n`'s public API: the `i18n.gettext_create-not-learn-editor` filter (with its context and plural versions), plus `hasTranslation()` to check whether the editor's own pack has the string. It changes nothing for other domains, and the editor's own translation always wins.

It costs about a microsecond for each string the editor's pack doesn't translate. Looking up all of the editor's 1,420 strings took 2.4 ms with it and 0.7 ms without. A screen draws far fewer than that.

Remove it once the editor's language packs cover its strings. Delete the function and the `wp_add_inline_script( 'wp-i18n', … )` call in `includes/editor-assets.php`, and the second test in `tests/e2e/views/translations.spec.js`.

To make the files, build, then run WP-CLI over the built plugin. `npm run i18n` does both steps with the right options, and runs WP-CLI with enough memory to parse the modules:

```sh
npm run build
npm run i18n -- pot                     # languages/create-not-learn-editor.pot, from this checkout
npm run i18n -- pot path/to/unzipped    # the same, from an unzipped plugin-zip
npm run i18n -- json languages          # a JSON file per module, beside each .po in languages/
```

The template is made from `build/` and `includes/`, not `src/`, so each string points at the module file that ships it, which is the path WordPress hashes. `languages/` is ignored by git.

The e2e spec `tests/e2e/views/translations.spec.js` checks this end to end with a German test locale. The tests site maps `tests/e2e/fixtures/mu-plugins/` into `wp-content/mu-plugins`, where a plugin switches requests carrying a test cookie to German and reads the editor's translations from the fixture beside it. After changing its `.po`, run `npm run i18n -- fixture`.

## Repository shape

- `create-not-learn-editor.php` is the plugin entry point.
- `includes/` contains PHP bootstrap, dependency checks, admin page rendering, REST endpoints, and setup behavior.
- `src/` contains JavaScript route modules, content surfaces, settings helpers, and styles.
- `routes/` contains thin `@wordpress/build` entry wrappers for the editor routes.
- `src/list-view.js` is the stable internal wrapper around the temporary vendored ListView bridge.
- `src/editor-extensions/` contains block editor filters registered at app init, such as template part editing.
- `@wordpress/build` creates the browser bundles and asset metadata under `build/`.
- `.wp-env.json` defines the local WordPress and Gutenberg plugin environment.
- `themes/mainstay/` is the demo block theme the development site uses. `scripts/demo-site/` seeds its content.
- `demos/` holds the WordPress Playground blueprints for the demo links. Branch and release demos are generated from them.
- `.wordpress-org/` holds the plugin directory icon, banner and screenshots.

## Design constraints

- Do not depend on a local Gutenberg repository checkout.
- Do not copy source from Gutenberg into this plugin, except for the scripted ListView bridge under `src/vendor/gutenberg/list-view`.
- Use published `@wordpress/*` packages and runtime modules from the released Gutenberg plugin.
- Import WordPress packages directly from `@wordpress/*`; do not access package APIs through `window.wp`.
- Keep automatic site changes out of editor load.
- Preserve PHP 7.4 compatibility.
- Keep the plugin installable on the latest WordPress release once Gutenberg is installed and active.

## Documentation

- [Architecture](docs/architecture.md) covers how the editor is built from released packages, its shell and routes, the visual theme, site changes, the Gutenberg version check and opening in a workspace.
- [Driving the editor with WebMCP](docs/webmcp.md) covers the editor's WebMCP tools, the official AI plugin's tools alongside them, and how an agent connects.
- [Performance budget](docs/performance-budget.md) covers what the budget measures, how CI checks it and when to raise a number.
- [Demo site and Playground](docs/demo-site-and-playground.md) covers the Fernhouse seed, the shop, the Playground demos for trunk, branches and releases, how to cut a release, and the plugin directory images.
- [Editor workarounds](docs/editor-workarounds.md) lists every place the editor leans on private APIs or core internals, and what would let each one go.
- [Vendored ListView bridge](docs/vendored-list-view.md) explains the one piece of copied Gutenberg source and how to regenerate it.

Some folders have their own README too, such as [`src/editor-layer/`](src/editor-layer/README.md), [`src/block-toolbar/`](src/block-toolbar/README.md), [`src/site-canvas/`](src/site-canvas/README.md) and [the end-to-end tests](tests/e2e/README.md).
