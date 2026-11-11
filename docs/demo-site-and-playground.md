# Demo site and Playground

How the Fernhouse demo site is seeded, and how the Playground demo links are built and published.

## Demo site

The development site (not the tests site) is set up as a demo the first time `wp-env` starts. `scripts/setup-demo-site.mjs` runs after every start and calls `scripts/demo-site/seed.php`, which:

- activates the bundled Mainstay theme (`themes/mainstay/`);
- names the site Fernhouse and fills Home, About, Workshops, Café and Visit pages with the theme's sections;
- adds three journal posts with photos. It adds no menu, so the header and footer show WordPress's default list of pages.

It records that it has run in the `cnl_demo_site_version` option and leaves the site alone after that, so later edits survive restarts. It never overwrites a page someone has changed. When a new version of the demo changes a page's sections, only pages still exactly as the seed left them are updated. To run it again, delete the option and restart:

```sh
npm run wp-env run cli wp option delete cnl_demo_site_version
npm run wp-env start
```

To skip it, start with `WP_ENV_LIFECYCLE_SCRIPT_AFTER_START=true`.

Mainstay is a block theme made for this editor: pages are stacks of full-width sections, each with Soft, Tint, Brand, Contrast and Highlight colour styles for Compose's Colour menu, plus header and footer layouts, page layouts, palettes, font pairings and full looks for Colors & fonts. It lives in this repo but is not part of the plugin zip.

## Shop

With WooCommerce active, Home offers the shop. Map WooCommerce in a `.wp-env.override.json`, as [CONTRIBUTING.md](../CONTRIBUTING.md#trying-another-plugin-alongside-the-editor) describes, activate it, add its pages, then stock the shop with products that cover the awkward cases, like options, stock counts and drafts:

```sh
npm run wp-env run cli wp plugin activate woocommerce
npm run wp-env run cli -- wp wc tool run install_pages --user=1
npm run wp-env run cli -- --env-cwd=wp-content/plugins/<this folder> wp eval-file scripts/demo-site/seed-shop.php
```

## Playground demo

The demo links in the [README](../README.md) open [WordPress Playground](https://wordpress.org/playground/) with a blueprint from `demos/`.

- `demos/blueprint.json` installs Gutenberg, this plugin and the Mainstay theme, runs `scripts/demo-site/seed.php` to build Fernhouse, and lands in the editor.
- `demos/blueprint-shop.json` does the same, then installs WooCommerce, adds its pages, runs `scripts/demo-site/seed-shop.php` to stock the shop, and lands on the Shop screen.
- `demos/blueprint-ai.json` builds Fernhouse the same way, then installs the [AI plugin](https://wordpress.org/plugins/ai/), turns on its WebMCP experiment and lands in the editor in the Agent workspace, for an agent to drive (see [Driving the editor with WebMCP](webmcp.md)). The AI plugin's version is pinned, as the editor adapts its tools through the plugin's filters. It needs no AI provider, as the agent brings its own.
- `demos/blueprint-blank.json` installs Gutenberg and this plugin and lands in the editor. It adds no theme or content, so the site runs the default theme of whichever WordPress version Playground loads.
- `demos/blueprint-ipsum.json` installs Gutenberg, this plugin and [Ipsum](https://github.com/WordPress/ipsum), the proposed new default theme, from its `trunk`. It imports [Ipsum's own demo content](https://github.com/WordPress/ipsum/blob/trunk/.github/ipsum-demo-content.xml), then deletes its pages and menu and the Hello world post, so the site is a fresh install with only Ipsum's demo posts and their images, and lands in the editor in the Writing workspace. Ipsum needs WordPress 7.2, so this blueprint runs the WordPress beta, as [Ipsum's own blueprint](https://github.com/WordPress/ipsum/blob/trunk/.github/blueprint.json) does.

Playground can't install from the plugin source, which needs building first, or from workflow artifacts. So on every push to `trunk`, `.github/workflows/plugin-zip.yml` builds the plugin zip and publishes it to the `playground-build` branch, along with a zip of the theme and the seed scripts. The blueprints install from that branch, so the demos always run the latest successful build of `trunk`.

Keep the Gutenberg version in every blueprint in step with `.wp-env.json`. Canvas is left out, as the plugin doesn't need it.

Every demo but the AI and Ipsum ones opens in the Default workspace. Playground's `url` parameter changes where a blueprint lands, so any demo link opens in another workspace with `&url=` and the editor's address, encoded, on the end. This opens the trunk demo in Writing:

```text
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/trunk/demos/blueprint.json&url=%2Fwp-admin%2Fadmin.php%3Fpage%3Dcreate-not-learn-editor%26workspace%3Dwriting
```

The workflows below add the Writing, Builder and Selling links wherever they list the demos. Selling needs a shop, so its link uses the shop blueprint.

### Branch demos

Every other branch gets demos of its own too. Each push builds them to `refs/playground/<branch>`, with a `blueprint.json`, a `blueprint-shop.json`, a `blueprint-ai.json`, a `blueprint-blank.json` and a `blueprint-ipsum.json` that install from there. That ref is neither a branch nor a tag, so the demos stay out of the branch and tag lists. The links for `getdave/my-change` are

```text
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/playground/getdave/my-change/blueprint.json
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/playground/getdave/my-change/blueprint-shop.json
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/playground/getdave/my-change/blueprint-ai.json
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/playground/getdave/my-change/blueprint-blank.json
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/playground/getdave/my-change/blueprint-ipsum.json
```

When a pull request opens, `.github/workflows/playground-links.yml` comments the links on it. The demo follows the branch, updating a few minutes after each push, and is deleted with it.

### Release demos

The trunk demo changes with every push, which is no good for a user test. For a demo that stays put, tag a release and push the tag:

```sh
git tag v0.2.0
git push origin v0.2.0
```

The workflow builds the tagged commit and publishes its files to a `playground-v0.2.0` tag, with a `blueprint.json`, a `blueprint-shop.json`, a `blueprint-ai.json`, a `blueprint-blank.json` and a `blueprint-ipsum.json` that install from that tag. Those blueprints also pin WordPress to the version in `scripts/wp-env.mjs`, where the trunk and branch demos take the latest, so the blank site runs that version's default theme. The Ipsum one stays on the WordPress beta, as Ipsum needs a newer WordPress than the pinned one. The workflow then creates a GitHub release for `v0.2.0`, or updates one you made already, with the Playground links at the top of the notes and the plugin zip attached. The links are

```text
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/tags/playground-v0.2.0/blueprint.json
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/tags/playground-v0.2.0/blueprint-shop.json
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/tags/playground-v0.2.0/blueprint-ai.json
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/tags/playground-v0.2.0/blueprint-blank.json
https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/Automattic/create-not-learn-editor/refs/tags/playground-v0.2.0/blueprint-ipsum.json
```

Every release keeps its own links, so testers can stay on one while trunk moves on. Pushing the same tag to a new commit rebuilds that release in place.

`scripts/playground-build.sh` puts the files for each kind of demo together.

## Plugin directory images

`.wordpress-org/` holds the images for a WordPress.org plugin directory listing: the icon, the banner and screenshots, named the way the directory expects. They are not part of the plugin zip.

The icon is drawn in `.wordpress-org/icon.svg` and the banner in `scripts/wordpress-org-assets/banner.html`. Both use the Mainstay theme's colours, and the banner borrows its fonts and photos, so the listing looks like the sites the editor makes. After changing either, run `npm run wporg-assets` to render the PNG sizes the directory asks for.

The screenshot at the top of the [README](../README.md) is `.wordpress-org/screenshot-1.jpg`. It shows the Fernhouse demo site in a 1440 by 900 window, so retake it from a fresh `wp-env` site when the editor changes.
