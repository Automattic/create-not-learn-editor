/**
 * Opening a page on the Pages screen, kept apart from the page finder so code
 * that only opens pages doesn't load the finder with it.
 */

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { MODE_EDIT, setCanvasMode } from '../site-canvas/mode';

export const PAGES_PATH = '/types/page/list/all';

/**
 * Open a page on the Pages screen, in Edit unless told to keep the mode.
 * The page finder keeps it, so going to a page on view leaves it on view.
 *
 * @param {number|string} pageId           Page ID, or `HOMEPAGE`.
 * @param {Object}        options
 * @param {boolean}       options.keepMode Leave the canvas in its mode.
 */
export function openPage( pageId, { keepMode = false } = {} ) {
	if ( ! keepMode ) {
		setCanvasMode( MODE_EDIT );
	}

	openRoute( PAGES_PATH, { postId: pageId, previewId: pageId } );
}
