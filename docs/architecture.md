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

Section editing is Add section, a section's own tools on core's block toolbar (Layout, Colour, Width and Layers), the section bars and Compose. It is only for content built from sections. Everything else is edited block by block with core's own tools, and core's inserter between blocks.

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

## Site changes are explicit

The editor does not automatically create pages, navigation, or homepage settings, when it loads or when the plugin is activated. A new site keeps WordPress's own default of latest posts on the homepage. Home then offers to set the homepage up the way the workspace expects, step by step, and nothing changes until the person finishes.

The setup behavior is behind an explicit action:

```text
POST /wp-json/create-not-learn-editor/v1/setup-defaults
```

That action reuses a published Home page or creates one, never publishing a draft or private page, sets it as the static homepage, and ensures a basic Navigation menu exists. It is intended to be idempotent.

## Unsaved changes in the preview

Browse shows the real front end in an iframe. To show it as it would be once saved, the canvas sends the editor's unsaved changes to `POST /wp-json/create-not-learn-editor/v1/preview-changes` before the preview loads (`src/site-canvas/preview-changes.js`). Each editor page load is its own session (`previewSession` in `window.createNotLearnEditor`), and the preview's addresses carry it as `cnl-editor-changes`.

On a preview request that names a session of the current user, `includes/preview-changes.php` puts the changes in place of what is saved. It covers posts' titles, content and page layout, layouts and site parts, synced sections and menus, the site's look, and the site settings the editor changes. The changes are kept in a user option for an hour after they were last sent, for the user's five latest sessions and up to 2 MB each, and are forgotten when the user logs out. Site settings are only shown unsaved to those who could save them, and a preview lists at most 100 posts at once. Pages drawn with them are never cached. Visitors, other users and other sessions see the saved site.

Changes the layer doesn't cover, like a page's parent or order, still ask to be saved or discarded on the way to Browse.

The Site overview's pictures of pages use the same session, so they show the unsaved changes too. Each picture loads the page once, then is swapped for a copy of it without its scripts, kept until the editor sends new changes (`src/routes/site-overview/snapshots.js`). Cards load a few at a time, the homepage first, and only once the map is still: cards far from the screen, or too small on it to make out, show no page at all. This keeps a site with hundreds of pages smooth to pan and zoom.

## Autosaves and post locks

Editing a post or page here is as safe as in core's post editor. Work is autosaved, a closed tab's work can be recovered, and two people can't overwrite each other without knowing.

Core's post editor gets this from edit-post's layout, which mounts `AutosaveMonitor`, `LocalAutosaveMonitor` and `PostLockedModal` from `@wordpress/editor`, and from `wp-admin/edit-form-blocks.php`, which loads the heartbeat, locks the post and prints the lock and any newer autosave in the editor's settings. Boot and its lazy editor do none of it, so the editor does it itself.

### Where it applies

Every lazy editor goes through `packages/lazy-editor-compat`, which mounts `PostSafety` (`src/editor-layer/post-safety.jsx`) beside each editor that is open for editing:

- Boot's full-screen editor, always.
- The site canvas, in Edit and Compose only. It keeps its editor mounted under Browse too, so it says when it is editing with the editor's `isEditing` prop. Moving to Browse lets go of the post's lock.
- Never an editor opened as a preview (`isPreviewMode`), like the Menus screen's site preview.

The server says which posts get it: those core's post editor opens, the post types whose edit link is `post.php`. Templates, template parts and menus don't, as core's site editor doesn't autosave or lock them either. The `create-not-learn-editor_has_post_safety` filter changes the answer per post.

### Opening a post

When the editor has set a post up, `PostSafety` asks `POST /wp-json/create-not-learn-editor/v1/post-lock/<id>` (`includes/post-safety.php`). That does what `edit-form-blocks.php` does on opening a post: it locks the post for the current user, or says who has it, and answers with the lock, the lock's nonces (`postLockUtils`), the autosave interval (`AUTOSAVE_INTERVAL`, which the block editor settings endpoint doesn't have) and the current user's autosave, if it is newer than the post. `PostSafety` puts them in the editor's settings and store, then mounts core's three components.

Moving to another post, in the site canvas or by route, without loading the page, lets go of the last post's lock as core does when its page unloads (`wp-remove-post-lock`), and locks the next one.

### Autosaves

- `AutosaveMonitor` autosaves on the server every `autosaveInterval` seconds while the post has unsaved changes. A published post's autosave is a revision, so nothing changes on the live site. A draft's autosave is the draft itself, which WordPress saves in place, as in core.
- `LocalAutosaveMonitor` backs the post up in the browser's session storage every `localAutosaveInterval` seconds (15, from the block editor settings), and offers the backup back when the post opens with different content. Each server autosave clears it.
- A newer autosave on the server, as a closed tab leaves, is offered when the post opens, with core's notice. **Restore the autosave** puts it back as unsaved changes, to be saved or discarded like any other, rather than opening core's revisions. It is offered each time the post opens, until it is saved over or discarded.

Both intervals are read from the editor's settings, so anything that changes them there is respected.

Discarding a post's changes, with Exit, Discard in the unsaved changes dialog, or Review changes, throws its backups away too (`src/editor-layer/post-backups.js`): the browser backup, and the current user's autosave on the server, so neither is offered back next time. A draft's autosaved changes are already the draft, so discarding only takes back what changed since the last autosave.

### Post locks

A heartbeat keeps the lock and checks it every 10 seconds while a post is held, as in core's post editor, or every minute while the tab is hidden, beating at once when it shows again. It stops when the post closes, so the editor's other screens make no requests.

It isn't WordPress's `heartbeat.js`, which depends on jQuery and polls on every page it loads on. `src/editor-layer/post-heartbeat.js` sends the same request with `fetch`, to `admin-ajax.php?action=heartbeat` with a `heartbeat-nonce` nonce from the lock route, so the server's side is core's own (`wp_refresh_post_lock()` on `heartbeat_received`). It fires the same `heartbeat.send` and `heartbeat.tick` hooks from `@wordpress/hooks`, which is all `PostLockedModal` listens to. A nonce that expires, after a day open, is fetched again from the lock route. Plugins that use the heartbeat for anything else, like core's login check, don't run on this page.

- Opening a post someone else has open shows core's "This post is already being edited". **Exit editor** leaves editing rather than going to wp-admin's list: the site canvas goes back to Browse, and the full-screen editor goes to the post type's list.
- **Take over** is core's link to `post.php`, which locks the post and redirects to the post's edit link. Taken over from here, it comes back to the page it was taken over from, which then opens with the post locked for the new person.
- The person taken over from sees "Someone else has taken over this post" on their next heartbeat, after core autosaves their changes.

## Requirements and the Gutenberg check

- WordPress 7.0 or newer.
- PHP 7.4 or newer.
- Gutenberg plugin 24.0.0 or newer.

The plugin header declares:

```text
Requires Plugins: gutenberg
```

WordPress plugin dependencies do not support minimum dependency versions, so the plugin also checks `GUTENBERG_VERSION >= 24.0.0` at runtime. If Gutenberg is missing or too old, the editor page is not registered and an admin notice is shown.

Pull requests are tested against that minimum. Newer Gutenbergs, the latest release, trunk and the one WordPress.com runs, are tested each week by the Gutenberg compatibility workflow, which opens an issue for each version that fails. See [Trying another Gutenberg](../CONTRIBUTING.md#trying-another-gutenberg).

## Opening in a workspace

A link can open the editor in a workspace by adding `workspace` to its address:

```text
/wp-admin/admin.php?page=create-not-learn-editor&workspace=writing
```

The ids are `simple` (Default), `writing`, `selling` and `builder`, from `src/workspaces/presets.js`. The link switches the person to that workspace as if they had picked it from the switcher, so it stays their workspace afterwards. The editor then takes `workspace` out of the address, so a reload doesn't undo a switch made since. A workspace the site can't use, like Selling on a site without WooCommerce, is ignored.

It is there for demos, and for the end of an onboarding flow, which can send people on to the workspace that suits what they came to do. It works with any other part of the address, such as `p` for the screen to open on.
