# Top bar and Publish site

The strip of boot's dark frame above the sidebar, the screen and the canvas, on every screen. The expanded canvas and small screens keep it too. Only core's full-screen editor, opened with "Open in advanced editor", hides it, as that has a header of its own. `mountTopBar()` adds it to boot's layout, which has no slot for it.

- **Start:** the site's logo and name (`site-button.jsx`). They open Name & logo, asking first about unsaved edits to a page or post open in the canvas, as Exit does.
- **Middle:** Go to page, the page finder (`src/page-finder`). It goes on small screens.
- **End:** which agent is connected, if one is (`agent-status.jsx`), and the publish status (`publish-status.jsx`).

## Why two publish buttons?

Two different kinds of things get published, on different timescales and for different people.

- **Site-wide changes** (name, logo, colours, header, menus) affect every page at once. People want to try them, preview them together, put them live in one go and roll them back if needed. That's **Publish site** in the top bar, on every screen, including ones with no canvas, so held changes are never stranded.
- **A page or post** is one document with its own life: draft, schedule, publish, then later edits, a flow writers already know from WordPress's post editor. That's **Save draft**, **Publish** and **Save** in the canvas, next to the document they belong to.

One button would force a bad choice. Either saving a page would also push half-finished site changes live, or a page couldn't be published without publishing the whole site too. Keeping them apart, with only one shown at a time, lets each control mean exactly one thing.

## Two scopes, one button at a time

`use-changes.js` splits what is unsaved in two:

- **The open document:** the page or post filling the canvas, as `src/site-canvas` notes it in the mode's store. It saves and publishes from the canvas, with core's buttons. See `src/site-canvas/README.md`.
- **The site's changes:** everything else. They wait for **Publish site**.

The end of the bar shows one of three things:

| State | Shows |
| --- | --- |
| Site changes waiting, no page or post open | **Publish site**, a primary button |
| Site changes waiting, a page or post open | "N site changes waiting", quiet text that does nothing. The page's own buttons are the button now, and Publish site comes back on leaving it |
| Nothing waiting | "✓ Up to date", quiet text, not a button |

Publish site opens a dialog (`publish-site-dialog.jsx`), as does the Home site card's badge: the changes, those shown on every page first under a purple heading, then pages changed beside the canvas, and **Publish**. **Discard changes…** sits behind the arrow beside it, and asks first.

Cmd+S follows the same rule: it saves the open page or post, or else opens Publish site. It is caught before boot's own shortcut, which would open boot's review of every change.

An edit made while a page is open that turns out to be the site's, like the header, says once a session that it waits for Publish site.

## What waits, and what doesn't

The rule is whether visitors could see it:

- **Could be seen on the site:** waits for Publish site.
- **Seen by nobody yet:** saves at once, and is never counted.

For menus, the editor can't know every place one is shown: a Navigation block can sit in any template, page, post or widget, and one with no menu of its own shows the newest published menu. So the only safe line is the menu's status. Core never shows a draft menu, nor picks one as the fallback.

- **New menus are drafts**, whether added or duplicated. A draft saves as it is changed, renamed or filled (`useSaveWhileDraft()` in `src/routes/navigation-edit/content.jsx`), and is listed in the mode's store as saving itself so it never shows as waiting.
- **A published menu may be live**, so every change to it waits for Publish site, its name included: the name labels the menu for screen readers on the site.
- **Putting a draft somewhere** is a change to the template part it goes in, so it waits. Publish site then publishes the draft with it (`publishDraftMenus()` in `use-changes.js`), so the place never shows an empty menu.
- **Putting a draft in a page or post** is a change to that page or post, which publishes from the canvas. Publishing, scheduling or saving it while live publishes the drafts its content shows with it (`publishDocumentMenus()` in `src/site-canvas/document-actions.jsx`), for the same reason.
- **Deleting** a menu in a place the editor knows of, the header say, isn't possible until another takes its place. Any other menu can be deleted after a warning, which for a published menu says it goes from wherever the site shows it, at once.

## Nothing kept between visits yet

The site's changes live in the editor's memory, as core's edits do, so the editor warns before the page is left while anything is unsaved. Keeping them as a site draft between visits, site history and scheduling are the next steps.
