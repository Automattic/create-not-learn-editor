# Architecture

How the editor is put together, and the rules it keeps about WordPress and Gutenberg. For setting up a development copy, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Built from released packages

WordPress core and Gutenberg are moving toward a more extensible Site Editor architecture. Gutenberg currently includes an experimental full-page editor at:

```text
/wp-admin/admin.php?page=site-editor-v2
```

This project mirrors that experiment from the outside, as a plugin. The goal is to learn what can be built by composing the public packages and runtime exposed by the released Gutenberg plugin, without requiring a Gutenberg checkout, patch, submodule, or custom core build.

That matters because a standalone plugin is easier to install, evaluate, ship, and iterate on. It also keeps the experiment honest: if the editor cannot be built from released packages and plugin APIs, that is useful information.

## The editor shell

The first slice provides a full-page editor shell under:

```text
/wp-admin/admin.php?page=create-not-learn-editor
```

The editor appears in the WordPress admin menu at:

```text
Appearance > Create Not Learn
```

The shell mirrors Gutenberg's `site-editor-v2` experiment setup:

- It registers a hidden admin page.
- It intercepts `admin_init` and renders a standalone full-page HTML document.
- It avoids the normal wp-admin wrapper, sidebar, and footer.
- It uses the Gutenberg `@wordpress/boot` package for the editor frame.
- It uses `@wordpress/route` route modules for navigation.
- It imports WordPress packages from `@wordpress/*` modules and relies on generated asset metadata for runtime dependencies.
- It preserves extension points for route, menu, and boot dependency registration.

The current routes are:

- `/` for the Home route.
- `/types/$type` for a content type landing route.
- `/types/$type/list/$view` for content lists.
- `/types/$type/edit/$id` for editing existing content.
- `/types/$type/new` for creating new content.

Home and Content currently include visible placeholder canvases. They are deliberately simple surfaces so the boot frame, routing, menu, and content list behavior can be developed before replacing the placeholders with richer previews.

## Sections or blocks

Section editing is Add section, Edit design, the section bars and Compose. It is only for content built from sections. Everything else is edited block by block with core's own tools, and core's inserter between blocks.

Each post answers once whether it is built from sections, and everything in the editor that offers section editing asks that answer rather than checking post types itself. That covers the site canvas and its section layer, the full-screen editor's section wording and starter designs, and the section options menu.

### Deciding

The answer comes from `includes/sections.php`.

- A post type is built from sections when it supports `create-not-learn-editor-sections`. Pages do. Give the support to a post type built like pages.
- The `create-not-learn-editor_has_sections` filter changes the answer for one post that differs from the rest of its type.
- Layouts (templates) and template parts answer the same way, as the `wp_template` and `wp_template_part` post types. They don't support sections by default, so they are edited block by block. Either the support or the filter turns sections on for them.

```php
// A post type built like pages.
add_post_type_support( 'landing_page', 'create-not-learn-editor-sections' );

// Every layout, built from sections too.
add_post_type_support( 'wp_template', 'create-not-learn-editor-sections' );

// One post that isn't.
add_filter(
	'create-not-learn-editor_has_sections',
	function ( $has_sections, $post ) {
		return $post instanceof WP_Post && 42 === $post->ID ? false : $has_sections;
	},
	10,
	2
);
```

The filter gets a `WP_Post`, or a `WP_Block_Template` for a layout or template part that is still only in the theme's files.

Defaults are only defaults. The editor never rules a post type in or out itself, so anything it does by default can be changed through the support or the filter.

The shop integration uses the filter itself. WooCommerce's cart, checkout and account pages are each one of its blocks rather than sections, so `includes/shop.php` answers no for them. Any other plugin with pages like these should do the same, so the editor never has to know about them.

### Reading

The answer is on each post's REST record as `cnl_has_sections`. In JavaScript, ask `hasSections( select, postType, postId )` from `src/sections.js`. It is false until the record has loaded. Don't check for pages anywhere else.

### Template parts

Template parts get the same treatment wherever they appear, on content with sections or without. Each is purple, locked until "Edit header", "Edit footer" or "Edit" and the part's name opens it in the spotlight with the Edit design bar. The editor finds them by block type, not by name, so a sidebar or a second header is treated like the header. See `src/site-canvas/README.md`.

### Site parts

The Site parts screen (`/site-parts`, in the sidebar's Site section and on Home) lists only the parts the homepage uses, so there is nothing to choose between. It shows the first header and the last footer. Each part's screen offers what is worth changing in it (layout, name and logo, a row for each menu, social links) and ends with a "See all" link to every part in its area, on the All site parts list (`/template-parts?area=…`).

A menu row switches menus only through a deliberate Change step, since a menu can be used in more than one place. Gutenberg's version also offers the navigation overlay; that is left out until we've worked out how it should show. It follows the same idea as Gutenberg's [Site parts experiment](https://github.com/WordPress/gutenberg/pull/87071). The code is in `src/routes/site-part/`.

## Visual theme

The editor uses the WordPress Design System as it ships. Its own surfaces take their colours, corners, spacing and shadows from WPDS tokens and core's elevation scale, so they sit alongside core's components rather than near them. The black sidebar's section titles, like Content and Design, are the one exception: they are set in EB Garamond, the heading face on [WordPress.org](https://wordpress.org/). The font lives in `assets/fonts/eb-garamond/` under the SIL Open Font License and loads from the plugin, not a third-party CDN.

An optional "modern" layer sits on top. It softens corners with WPDS's moderate corner preset and floats the site preview on a quiet backdrop.

It is off by default. Switch it with the `CNL_EDITOR_UI_THEME` constant, either `'default'` (stock WPDS) or `'modern'`:

```sh
npm run wp-env run cli wp config set CNL_EDITOR_UI_THEME modern
npm run wp-env run cli wp config delete CNL_EDITOR_UI_THEME
```

The `create-not-learn-editor_ui_theme` filter can override it too. The theme's settings live in `src/theme/`.

## Site changes

The editor changes a site by itself in one way only. Every site needs a menu to edit, so the editor makes sure there is one. Everything else waits for the person to ask.

### The menu, on every visit

Each time the full-page editor loads, `cnl_editor_ensure_default_navigation_menu()` (`includes/setup-defaults.php`) checks for a `wp_navigation` post, published or draft. Once one exists, the check is the whole cost.

On a site with none, it asks WordPress's own fallback, `WP_Navigation_Fallback::get_fallback()`. That is what the Navigation block uses, from its REST fallback endpoint in the editor and when it renders on the front end. So the editor and the block always settle on the same menu, in the same order:

1. the most recently published `wp_navigation` menu,
2. a classic menu converted to blocks, the one at the `primary` location first, then one with the `primary` slug, then the newest,
3. a new menu listing the pages.

The editor names that last one "Main menu" rather than core's "Navigation", which reads as the block's name. A menu converted from a classic menu keeps its name.

This is deliberate. Without it, the first menu a site gets is made in the browser by whichever Navigation block renders first. The editor's menu screens, the header's checklist and the menu WebMCP tools would all have to handle a site with no menu at all. Making it on the server means a menu is a real thing before any screen asks for one.

It runs only for people who can create `wp_navigation` posts, the same check core's fallback endpoint makes. Anyone else opening the editor changes nothing. A site that turns core's fallback off with `wp_navigation_should_create_fallback` turns this off too.

#### No duplicate menus

Core's fallback looks for a menu and then makes one, with nothing to stop two requests doing both at once. Two first visits to the editor, or a visit racing the block's fallback, could each find nothing and each make a menu.

The plugin closes that gap on core's own `wp_navigation_should_create_fallback` filter, for every caller and not just the editor. The first request to get there takes a lock, an option row named `cnl_editor_navigation_fallback_lock`, inserted with `INSERT IGNORE` as `WP_Upgrader::create_lock()` does. A second request waits, up to 5 seconds by default (the `create-not-learn-editor_navigation_lock_wait` filter), until the menu appears, and then uses it instead of making another. The lock is deleted once the menu is made, or at the end of the request. One left by a request that died is taken over after 30 seconds.

### Everything else is explicit

The editor does not create pages or change homepage settings when it loads or when the plugin is activated. A new site keeps WordPress's own default of latest posts on the homepage. Home then offers to set the homepage up the way the workspace expects, step by step, and nothing changes until the person finishes.

That setup is behind an explicit action:

```text
POST /wp-json/create-not-learn-editor/v1/setup-defaults
```

It creates or reuses a Home page, publishes it, sets it as the static homepage and makes sure there's a menu, in the same way as above. Running it again changes nothing.

## Unsaved changes in the preview

Browse shows the real front end in an iframe. To show it as it would be once saved, the canvas sends the editor's unsaved changes to `POST /wp-json/create-not-learn-editor/v1/preview-changes` before the preview loads (`src/site-canvas/preview-changes.js`). Each editor page load is its own session (`previewSession` in `window.createNotLearnEditor`), and the preview's addresses carry it as `cnl-editor-changes`.

On a preview request that names a session of the current user, `includes/preview-changes.php` puts the changes in place of what is saved. It covers posts' titles, content and page layout, layouts and site parts, synced sections and menus, the site's look, and the site settings the editor changes. The changes are kept in a user option for an hour after they were last sent, and pages drawn with them are never cached. Visitors, other users and other sessions see the saved site.

Changes the layer doesn't cover, like a page's parent or order, still ask to be saved or discarded on the way to Browse.

## Requirements and the Gutenberg check

- WordPress 7.0 or newer.
- PHP 7.4 or newer.
- Gutenberg plugin 24.0.0 or newer.

The plugin header declares:

```text
Requires Plugins: gutenberg
```

WordPress plugin dependencies do not support minimum dependency versions, so the plugin also checks `GUTENBERG_VERSION >= 24.0.0` at runtime. If Gutenberg is missing or too old, the editor page is not registered and an admin notice is shown.

## Opening in a workspace

A link can open the editor in a workspace by adding `workspace` to its address:

```text
/wp-admin/admin.php?page=create-not-learn-editor&workspace=writing
```

The ids are `simple` (Default), `writing`, `selling` and `builder`, from `src/workspaces/presets.js`. The link switches the person to that workspace as if they had picked it from the switcher, so it stays their workspace afterwards. The editor then takes `workspace` out of the address, so a reload doesn't undo a switch made since. A workspace the site can't use, like Selling on a site without WooCommerce, is ignored.

It is there for demos, and for the end of an onboarding flow, which can send people on to the workspace that suits what they came to do. It works with any other part of the address, such as `p` for the screen to open on.
