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

Each post answers once whether it is built from sections, and everything in the editor that offers section editing asks that answer rather than checking post types itself. That covers the site canvas and its section layer, Browse's hints, the full-screen editor's section wording and starter designs, and the section options menu.

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

## Visual theme

The editor uses the WordPress Design System as it ships. Its own surfaces take their colours, corners, spacing and shadows from WPDS tokens and core's elevation scale, so they sit alongside core's components rather than near them. The black sidebar's section titles, like Content and Design, are the one exception: they are set in EB Garamond, the heading face on [WordPress.org](https://wordpress.org/). The font lives in `assets/fonts/eb-garamond/` under the SIL Open Font License and loads from the plugin, not a third-party CDN.

An optional "modern" layer sits on top. It softens corners with WPDS's moderate corner preset and floats the site preview on a quiet backdrop.

It is off by default. Switch it with the `CNL_EDITOR_UI_THEME` constant, either `'default'` (stock WPDS) or `'modern'`:

```sh
npm run wp-env run cli wp config set CNL_EDITOR_UI_THEME modern
npm run wp-env run cli wp config delete CNL_EDITOR_UI_THEME
```

The `create-not-learn-editor_ui_theme` filter can override it too. The theme's settings live in `src/theme/`.

## Site changes are explicit

The editor does not automatically create pages, navigation, or homepage settings, when it loads or when the plugin is activated. A new site keeps WordPress's own default of latest posts on the homepage. Home then offers to set the homepage up the way the workspace expects, step by step, and nothing changes until the person finishes.

The setup behavior is behind an explicit action:

```text
POST /wp-json/create-not-learn-editor/v1/setup-defaults
```

That action creates or reuses a Home page, sets it as the static homepage, and ensures a basic Navigation menu exists. It is intended to be idempotent.

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
