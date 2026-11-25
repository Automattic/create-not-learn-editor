# Onboarding tips

Inline help that shows up when it's useful, not all at once. The first time something happens, the editor picks its moment, dims the rest of the screen round the control in question, and shows a short, silent, looping video of that control beside a line on what it's for. Each person sees each tip once.

Use this for any help that points at a control. Don't build a one-off popover, spotlight or "new!" badge elsewhere in the editor; add a tip here, so every hint shares the timing, the opt-out, the Builder rule and the "seen once" record.

There are two so far.

- **Publish.** After the first change that applies across the whole site, once the person pauses or moves to another screen, it points at Publish.
- **Edit.** The first time someone browsing clicks the page's words or a picture as if to change them, it points at Edit straight away. The click detection, and the pulse on Edit for every click after that, live in `src/site-canvas/edit-hint.js`.

## Files

| File | What it does |
|---|---|
| `index.jsx` | The registry, the rules for when a tip shows, and the seen record. `mountOnboarding()` starts it from app init. |
| `tips.js` | The editor's tips. Add new ones here. |
| `spotlight.jsx` | The tip on screen: the dimmed editor, the gap round the control and the popover. |
| `preferences.js` | The Show hints preference, kept apart so Preferences can offer it without loading the tips. |
| `request.js` | `requestOnboardingTip()`, for code in any bundle to ask for a tip. |
| `tip-ids.js` | The ids of tips that code elsewhere asks for, shared with `tips.js`. |
| `_style.scss` | The spotlight and popover. |
| `test/index.js` | Unit tests for when tips show. |
| `assets/onboarding/` (plugin root) | The videos. |

## Adding a tip

Register it in `tips.js`.

```js
registerOnboardingTip( {
	id: 'publish-site-wide',
	target: '.cnl-publish',
	title: __( 'Publish your site-wide changes' ),
	description: __(
		'You have changes that apply across your entire site, and this is where you publish them.'
	),
	video: video( 'publish.mp4' ),
	placement: 'top',
	showOn: [ 'idle', 'leave' ],
	when: ( select ) => getDirtyRecords( select ).some( isSiteWideChange ),
} );
```

| Option | Required | What it does |
|---|---|---|
| `id` | Yes | Kept in the person's seen record. Never rename a shipped tip's id, or everyone sees it again. |
| `target` | Yes | Selector for the control it points at, in the editor's own document (not inside the canvas iframe). |
| `title` | Yes | Its heading. |
| `description` | Yes | One or two sentences on what the control is for, in plain words. |
| `video` | No | URL of a short clip of the control. Use the `video( name )` helper in `tips.js`. |
| `placement` | No | Which side of the control it sits, as core's `Popover` takes it. `top` by default. |
| `when( select )` | One of these | Whether it's due, from the data stores. For tips about a state, like changes waiting to be published. |
| `requestOnboardingTip( id )` | One of these | Call it after an action, for tips about something done, like a click on the page while browsing, where there's no state to read afterwards. Import it from `request.js`. |
| `showOn` | No | When a due tip shows. See below. `[ 'idle' ]` by default. |

Then check it in the browser, write its unit or e2e test if its trigger needs one, and add a line about it to the list at the top of this file.

### Writing the words

Follow the editor's plain-language rules. Say what the control does for the person, not what it's called, with no jargon and no examples in the description. Keep the title to a few words and the description to one or two short sentences, as the video does the rest.

### Making the video

Videos live in `assets/onboarding/` and are served from the plugin (`settings.assetsUrl`). Keep them to a few seconds, cropped tight to the control, 640px wide at 16:9, H.264 with no sound, and with `-movflags +faststart` so they start before they've fully loaded. `publish.mp4` is about 80 KB.

One way to make one is to record the dev site with Playwright's `recordVideo`, draw a cursor in with a little CSS (recordings don't show one), then trim and crop with ffmpeg.

```sh
ffmpeg -ss <start> -t <seconds> -i recording.webm \
	-vf "crop=<w>:<h>:<x>:<y>,scale=640:-2:flags=lanczos,fps=24" \
	-an -c:v libx264 -pix_fmt yuv420p -crf 26 -preset slow \
	-movflags +faststart assets/onboarding/<name>.mp4
```

## When a tip shows

Being due says a tip has something to say. `showOn` says when to say it, as a list of moments, and the tip shows at whichever comes first.

| Moment | Shows the tip |
|---|---|
| `idle` | Once nothing has been clicked, typed, scrolled or edited for 2.5 seconds. Typing in the canvas counts, through listeners on the canvas iframe, and so do edits to core's records. |
| `leave` | Once the person moves to another screen than the one the tip became due on, after 0.6 seconds for the new screen to draw. The screen is the `p` in the address, so changing page in the canvas doesn't count. |
| `now` | As soon as it's due. |

The Publish tip waits for `idle` or `leave`. Someone who changes a colour and stops gets it there, and someone who carries straight on to another screen gets it as they leave the change behind.

A tip is noted as due the moment a data store changes, on the screen the change was made on, so leaving straight after still counts as leaving. A tip that stops being due before it shows, as when the changes are published first, is forgotten, and starts again from scratch if it's due again later. To add a moment, add a function to `MOMENTS` in `index.jsx`.

Whatever the moment, a tip shows only when all of these hold.

- The person hasn't turned hints off. Each tip has a "Don’t show hints like these" checkbox, which turns off every hint, not only that one. Preferences has a Show hints switch to turn them back on. Both set the `showHints` preference, which is on by default.
- The active workspace has `onboarding` on. Builder turns it off (`src/workspaces/presets.js`). Read the workspace's setting, never its id.
- The tip isn't in the person's `onboardingSeen` preference. The id is added the moment the tip is on screen, so it's seen once, even if the page is left before it's closed.
- The person hasn't clicked the control already. Someone who has used it has found it, so a click on the control, by pointer or keyboard, adds the tip to `onboardingSeen` without showing it, in any workspace and with hints off. Getting to the same place another way doesn't count, like a double click on the page going into Edit.
- The control is on screen and not inside something inert or hidden.
- No dialog is open, and no other tip is showing. When two are due at once, the one registered first shows.

## The tip on screen

`spotlight.jsx` darkens the rest of the editor round the control, with core's `Popover` beside it. A ring round the control draws the dark with its wide shadow. A layer over everything catches clicks, with a gap round the control cut out by `clip-path`, so the control can still be used straight away.

Using the control closes the tip, and so do Got it, Escape and a click on the dark. Got it takes focus first, so a stray Space or Enter can't tick the opt-out by mistake.

The video autoplays muted and loops. With reduced motion asked for, it doesn't autoplay and shows its controls instead, and the dark doesn't fade in.

### Asking for a tip from a route

`@wordpress/build` bundles each route with its own copy of what it imports, so a route importing `index.jsx` would get an empty registry of its own. Routes import `requestOnboardingTip()` from `request.js` instead, which asks app init's copy through a `@wordpress/hooks` filter, and the tip's id from `tip-ids.js`.

It answers whether the tip is showing or will show. When it won't, because the tip has been seen, hints are off or the workspace has onboarding off, the caller can do something lighter of its own. The Edit hint pulses Edit then, which isn't a hint: it answers the click, so it happens in every workspace and with hints off.

## Preferences

All three are in core's preferences store, in the `create-not-learn-editor` scope, saved to user meta.

| Preference | What it holds |
|---|---|
| `onboardingSeen` | The ids of the tips this person has seen. |
| `showHints` | Whether they want hints at all. On by default. |
| `workspace` | The active workspace, whose `onboarding` setting can turn hints off. |

To see the tips again while working on them, run this in the browser console, or call `resetOnboarding()`.

```js
wp.data.dispatch( 'core/preferences' ).set( 'create-not-learn-editor', 'onboardingSeen', [] );
```

## Tests

- `test/index.js` covers when tips show: each moment, the screen a tip became due on, the opt-out, workspaces, the control being on screen, open dialogs, one tip at a time, a click on the control counting as seen, and what `requestOnboardingTip()` answers. It mocks the spotlight and core's store, and uses fake timers. Add a case here when you add a moment or a rule.
- `tests/e2e/interactions/onboarding.spec.js` covers both tips in the editor. Publish shows after a pause and on leaving the screen, only once, not after opting out, and never in Builder. Edit shows on the first click on the page's words, then Edit only pulses, in Builder it only pulses, and clicking Edit counts as seeing it.
- Every other e2e test runs with hints off. A tip dims the editor and catches clicks, so one turning up would get in the way of tests about something else. `tests/e2e/global-setup.js` turns them off for the run, and `onboarding.spec.js` turns them on for itself with `rest.setEditorPreferences()`, which puts them back when it ends. A new e2e test about a tip should do the same.
