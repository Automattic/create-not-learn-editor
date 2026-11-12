# Editor workarounds

Some behaviour the prototype needs has no supported extension point in the released Gutenberg, so it is reached by leaning on private APIs, core class names, or editor internals. Everything of that kind is listed here. Each entry says what it depends on and what would let it go away, because each one can break on a Gutenberg update.

## Hiding core's "Edit original" toolbar button

Template parts are edited through this plugin's own "Edit Header" button instead, so core's is redundant. Core renders it whenever the `onNavigateToEntityRecord` editor setting is present, and offers no way to suppress it for one block type. Dropping that setting would work but would also take the button away from synced patterns, which still need it.

Instead `src/editor-extensions/template-part-editing.js` adds a `cnl-editor-template-part-selected` class to the admin document body while a template part is the selected block, and `src/style.scss` hides the button's toolbar group in that state.

The whole group is hidden rather than the slot inside it, because a group emptied of its contents still draws its own borders and reads as a broken gap in the toolbar.

Every slot in the toolbar carries the same `block-editor-block-toolbar__slot` class, so the group is picked out as the last one holding a slot, which is where the "other" group is rendered. Earlier slot groups carry controls that should stay, such as block alignment while a part is being edited.

So this depends on three things: the `block-editor-block-toolbar.is-synced` and `block-editor-block-toolbar__slot` class names, the "other" group being rendered last of the slots, and that group holding nothing but "Edit original" for a selected template part.

The replacement is rendered into `__unstableBlockToolbarLastItem`, the slot core's own template part toolbar buttons use, which is what keeps it out of the hidden group.

It also depends on the canvas being portalled into its iframe from the admin document's JavaScript realm, which is what makes `document` there the document the toolbar lives in.

Remove this once the template part block offers a way to opt out of the button.

## Unlocking a template part for in-place editing

The editor sets `disableContentOnlyForTemplateParts` whenever `renderingMode` is `template-locked`, which is the mode pages are edited in. Template parts are therefore not content-only sections there, and `DisableNonPageContentBlocks` additionally locks each part to `contentOnly` and each of its children to `disabled`.

Entering the overlay's edit mode dispatches the private `editContentOnlySection` action, which disables everything outside the part, and then lifts those explicit locks with `setBlockEditingMode( clientId, 'default' )`. Leaving puts them back as `contentOnly` and `disabled`.

The locks are re-read on every change and re-lifted if they come back, because `DisableNonPageContentBlocks` re-applies them whenever a block is added to or removed from the part, which would otherwise strand the author mid-edit.

This assumes the editor keeps locking parts exactly that way. Remove it if template parts become editable in place without the lock, or if the rendering mode stops forcing `disableContentOnlyForTemplateParts`.

## Leaving edit mode by clicking away

`useEditContentOnlySectionExit` in `@wordpress/editor` is meant to handle this, but every block outside the edited section is `inert`, so a click aimed at one never reaches the handler and editing never ends. The same module listens for clicks on the canvas document and ends editing when the click lands outside the part, ignoring popovers so in-canvas UI such as the link editor still works.

Remove it once core's handler fires for clicks on inert blocks.

## Entering edit mode on a second click

A click on an already selected template part enters edit mode. Knowing whether the part was selected *before* the click means reading the store ahead of the editor's own selection handling, so the listener runs in the capture phase on the canvas document, which fires before the editor's handlers at the React root. A first click therefore only ever selects.

Remove it if the editor gains its own click-into-section behaviour for template parts.

## Direct package imports in editor extensions

`src/editor-extensions/` imports each `@wordpress/*` package directly rather than through `src/wordpress-packages.js`, which is the convention everywhere else. The barrel reaches `@wordpress/lazy-editor`, and these modules are registered from app init, so going through it would make the editor a static dependency of page boot and stop it loading lazily.

## Block name label on hover

`includes/block-canvas-styles.php` styles the block wrapper's `data-title` attribute to show a block's name on hover. It depends on that attribute and on the `block-editor-block-list__block` class.

The label normally sits above its block. The topmost block has nothing above it, so the label would be drawn outside the canvas and clipped, which is what hid it on a site header. That one block gets the label just inside its top edge instead, matched through `.is-root-container > .block-editor-block-list__block:first-child`.

Template parts and synced patterns get the label in `--wp-block-synced-color` rather than the admin colour, since they are shared across the site rather than owned by the page. They are matched by `.wp-block-template-part` and `.is-reusable`, the same two selectors core uses to colour its own outline around them.

Both of those rules repeat the base rule's `:not()` chain. Without it the base rule wins on specificity and the override silently does nothing.

## wp-admin's menu navigating through the router

`packages/app-init/src/admin-menu.js` opens editor screens from wp-admin's menu, which is printed outside React, with `window.__TSR_ROUTER__.navigate()`. That's where TanStack Router, which `@wordpress/route` and boot are built on, keeps its router in the browser, since nothing public reaches it outside a component. If the global goes away, the menu falls back to `openRoute()`.

It navigates inside `flushSync()`. Boot's links navigate from a click React handles, which renders at once, so the screen being left unmounts before the next one's editor merges in its settings. A navigation from outside React renders later, after that merge. A layout's canvas then hands back its `disableContentOnlyForUnsyncedPatterns` too late, and core's patterns stay unlocked on the next screen. `openRoute()` from outside React, as the command palette and page finder call it, may have the same problem.
