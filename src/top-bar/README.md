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
- **Deleting** a menu in a place the editor knows of, the header say, isn't possible until another takes its place. Any other menu can be deleted after a warning, which for a published menu says it goes from wherever the site shows it, at once.

## Site history

A clock in the top bar, before Publish site, opens a panel down the right (`site-history-panel.jsx`). It lists what **Publish site** published, newest first, grouped by day, at three levels of detail:

1. **The entry:** "Published N changes", the time, who published it and the names of the changes.
2. **Its changes:** clicking the entry opens it in place. Each change has one line on what it changed: from → to when it is one thing, the names of the first few settings, or for blocks "2 edits, 1 block added".
3. **Every detail:** a change with more than one detail opens a screen of its own, listing each one from → to, with colours as swatches. Back, or Escape, returns to the list where it was.

The details are worked out just before the save, while the editor still holds both the saved record and the edited one (`site-history-diff.js`). They are kept in the log with the entry, so an entry still reads the same after the theme or palette has changed. Style values name the preset they point at, "Contrast" rather than `var:preset|color|contrast`, and blocks are matched before and after as a text diff matches lines.

- **Latest** marks the newest entry instead of Restore: it is what the site shows, so restoring it would change nothing.
- **Restore** on any other entry asks first, in a dialog: the editor's preview goes back to that version, and the site itself doesn't change until it is published with Publish site. It also says when restoring would replace changes not yet published.
- The clock is disabled until something has been published.
- The panel slides in over the canvas and closes on Escape, Close, or a click anywhere else, since it covers the canvas's toolbar.

Only what Publish site publishes is in it: templates, template parts, site styles, menus and site settings. Pages and posts keep core's own revisions.

- **Built on core revisions.** Core already keeps a revision of each template, part, styles record and menu it saves. What it doesn't say is which were saved together, and site settings have no revisions. So `includes/site-history.php` keeps a small log, the option `create-not-learn-editor_site_history`, newest 50, not autoloaded. Each entry has the time, the user and its changes. A change holds the revision the save made or, for site settings, the values saved, and its summary and details, the first 60 of them, with only plain colours and web addresses kept. It is read and added to through `/site-history` (`edit_theme_options`); anything that isn't one of those kinds is dropped.
- **Logged after the save.** `publishSite()` in `use-changes.js` posts what was saved once core's save finishes, leaving out whatever is still unsaved after it. A failure to log doesn't fail the publish.
- **Restore is an edit, not a save.** `site-history.js` fetches each revision and loads it into the record as an unsaved edit, so it waits for Publish site like any other change. Settings are edited from the values in the entry. A revision core has since pruned is skipped, and the snackbar says so. There is no preview of an old version.

## Nothing kept between visits yet

The site's changes live in the editor's memory, as core's edits do, so the editor warns before the page is left while anything is unsaved. Keeping them as a site draft between visits and scheduling are the next steps.
