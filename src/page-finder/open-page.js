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
 * Open a page on the Pages screen, in Edit, as the command palette does.
 *
 * @param {number|string} pageId Page ID, or `HOMEPAGE`.
 */
export function openPage( pageId ) {
	setCanvasMode( MODE_EDIT );
	openRoute( PAGES_PATH, { postId: pageId, previewId: pageId } );
}
