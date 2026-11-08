/**
 * Gutenberg's font library, which the editor mounts at `/font-list`
 * (`includes/gutenberg-routes.php`), keeps its tabs to itself: it always
 * opens on Library, and the address doesn't say which tab is open. So a
 * link to another tab opens the screen and then picks the tab, from
 * outside, as the editor layer works with core's editor. If the tab never
 * shows, because this person can't add fonts or Gutenberg has changed its
 * markup, the screen is left on Library.
 */

/**
 * The font library's route.
 */
export const FONT_LIBRARY_PATH = '/font-list';

/**
 * The font library's tabs, by Gutenberg's ids for them. Each font
 * collection, like Google Fonts, has a tab of its own, under its slug.
 */
export const FONT_LIBRARY_TABS = {
	library: 'installed-fonts',
	upload: 'upload-fonts',
};

// The route's code loads the first time it opens, so give it a while.
const TAB_WAIT_MS = 10000;

let stopWaiting;

/**
 * The tab's button, once the font library shows it.
 *
 * @param {string} tabId Gutenberg's id for the tab.
 * @return {?HTMLElement} The tab.
 */
function findTab( tabId ) {
	// Gutenberg's tabs prefix each id with their own instance id.
	return document.querySelector(
		`.font-library-page__tablist [role="tab"][id$="-${ tabId }"]`
	);
}

/**
 * Pick one of the font library's tabs once it opens.
 *
 * @param {string} tabId Gutenberg's id for the tab.
 */
export function selectFontLibraryTab( tabId ) {
	stopWaiting?.();

	if ( tabId === FONT_LIBRARY_TABS.library ) {
		return;
	}

	const select = () => {
		const tab = findTab( tabId );

		if ( ! tab ) {
			return false;
		}

		if ( tab.getAttribute( 'aria-selected' ) !== 'true' ) {
			tab.click();
		}

		return true;
	};

	const observer = new window.MutationObserver( () => {
		if ( select() ) {
			stopWaiting();
		}
	} );
	const timeout = window.setTimeout( () => stopWaiting(), TAB_WAIT_MS );

	stopWaiting = () => {
		observer.disconnect();
		window.clearTimeout( timeout );
		stopWaiting = undefined;
	};

	observer.observe( document.body, { childList: true, subtree: true } );
}
