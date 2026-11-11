/**
 * The site canvas's mode, shared by every canvas.
 *
 * - Edit, the default: the page in the editor, with every block open to
 *   change.
 * - Browse: the saved site as visitors see it, turned on beside the device.
 * - Compose: the same editor zoomed out, to work on the page's sections.
 *
 * Kept outside any one canvas so the mode carries over from page to page and
 * screen to screen. Nothing is saved, so every visit starts in Edit.
 *
 * The device the canvas shows the page on is kept here too, and whether the
 * canvas is expanded to fill the editor, hiding the sidebar and the screen
 * beside it, for the same reasons. Expanding is
 * the canvas's Edit button; it changes the room the canvas has, not its mode.
 *
 * The section Compose has picked is kept beside it, so code outside the
 * canvas can read it: Compose's pick is its own, not core's block selection.
 * So is the header or footer open in Edit content or Freeform, for the
 * editor extension that opens a template part's blocks: how far they open
 * depends on which. And so is a request from code outside the canvas to open
 * the header or footer as Edit header or Edit footer does, for the canvas to
 * take up, and a request to move to another mode, which the canvas takes
 * up by its own rules, asking about unsaved changes on the way to Browse.
 * And so is the way back from the screen a section's Edit posts
 * leads to, which another route's bundle shows and this canvas takes up on
 * the way back.
 *
 * Kept in a data store, registered once by name, rather than in this module:
 * app init and each route are built separately, each with its own copy of
 * this module, and all of them have to agree on the mode.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * so the editor layer, mounted from app init, can read it without making the
 * editor a static dependency of page boot.
 */

/**
 * WordPress dependencies
 */
import {
	createReduxStore,
	dispatch,
	register,
	select,
	useSelect,
} from '@wordpress/data';

/**
 * Internal dependencies
 */
import { DEFAULT_DEVICE } from './constants';

export const MODE_BROWSE = 'browse';
export const MODE_EDIT = 'edit';
export const MODE_COMPOSE = 'compose';

export const STORE_NAME = 'create-not-learn-editor/canvas-mode';

// How a header or footer is open: Edit content, its words and images only,
// or Freeform, core's full block tools.
export const PART_CONTENT = 'content';
export const PART_FREEFORM = 'freeform';

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer(
				state = {
					mode: MODE_EDIT,
					modeRequest: null,
					device: DEFAULT_DEVICE,
					isExpanded: false,
					openPart: null,
					partRequest: null,
					pickedSection: null,
					postsTrip: null,
					editRoute: null,
				},
				action
			) {
				switch ( action.type ) {
					case 'SET_CANVAS_MODE':
						return { ...state, mode: action.mode };
					case 'SET_MODE_REQUEST':
						return { ...state, modeRequest: action.mode };
					case 'SET_CANVAS_DEVICE':
						return { ...state, device: action.device };
					case 'SET_EXPANDED':
						return { ...state, isExpanded: action.isExpanded };
					case 'SET_OPEN_PART':
						return { ...state, openPart: action.openPart };
					case 'SET_PICKED_SECTION':
						return { ...state, pickedSection: action.clientId };
					case 'SET_PART_REQUEST':
						return { ...state, partRequest: action.area };
					case 'SET_POSTS_TRIP':
						return { ...state, postsTrip: action.trip };
					case 'SET_EDIT_ROUTE':
						return { ...state, editRoute: action.route };
				}

				return state;
			},
			actions: {
				setCanvasMode: ( mode ) => ( {
					mode,
					type: 'SET_CANVAS_MODE',
				} ),
				setModeRequest: ( mode ) => ( {
					mode,
					type: 'SET_MODE_REQUEST',
				} ),
				setCanvasDevice: ( device ) => ( {
					device,
					type: 'SET_CANVAS_DEVICE',
				} ),
				setExpanded: ( isExpanded ) => ( {
					isExpanded,
					type: 'SET_EXPANDED',
				} ),
				setOpenPart: ( openPart ) => ( {
					openPart,
					type: 'SET_OPEN_PART',
				} ),
				setPickedSection: ( clientId ) => ( {
					clientId,
					type: 'SET_PICKED_SECTION',
				} ),
				setPartRequest: ( area ) => ( {
					area,
					type: 'SET_PART_REQUEST',
				} ),
				setPostsTrip: ( trip ) => ( {
					trip,
					type: 'SET_POSTS_TRIP',
				} ),
				setEditRoute: ( route ) => ( {
					route,
					type: 'SET_EDIT_ROUTE',
				} ),
			},
			selectors: {
				getCanvasMode: ( state ) => state.mode,
				getModeRequest: ( state ) => state.modeRequest,
				getCanvasDevice: ( state ) => state.device,
				isExpanded: ( state ) => state.isExpanded,
				getOpenPart: ( state ) => state.openPart,
				getPickedSection: ( state ) => state.pickedSection,
				getPartRequest: ( state ) => state.partRequest,
				getPostsTrip: ( state ) => state.postsTrip,
				getEditRoute: ( state ) => state.editRoute,
			},
		} )
	);
}

/**
 * @return {string} The current mode.
 */
export function getCanvasMode() {
	return select( STORE_NAME ).getCanvasMode();
}

/**
 * Switch every canvas to a mode. Only the canvas decides when a switch may
 * happen, for instance after asking about unsaved changes, so call it from
 * there.
 *
 * @param {string} next `MODE_BROWSE`, `MODE_EDIT` or `MODE_COMPOSE`.
 */
export function setCanvasMode( next ) {
	if ( next !== getCanvasMode() ) {
		dispatch( STORE_NAME ).setCanvasMode( next );
	}
}

/**
 * @return {string} The current mode, kept up to date.
 */
export function useCanvasMode() {
	return useSelect(
		( selectStore ) => selectStore( STORE_NAME ).getCanvasMode(),
		[]
	);
}

/**
 * Expand the canvas to fill the editor, or put it back beside the sidebar
 * and the screen.
 *
 * @param {boolean} next Whether to expand it.
 */
export function setCanvasExpanded( next ) {
	if ( next !== select( STORE_NAME ).isExpanded() ) {
		dispatch( STORE_NAME ).setExpanded( next );
	}
}

/**
 * @return {boolean} Whether the canvas fills the editor, kept up to date.
 */
export function useIsCanvasExpanded() {
	return useSelect(
		( selectStore ) => selectStore( STORE_NAME ).isExpanded(),
		[]
	);
}

/**
 * Note the section Compose has picked, or that none is.
 *
 * @param {?string} clientId The section's client ID, or null.
 */
export function setPickedSection( clientId ) {
	if ( clientId !== select( STORE_NAME ).getPickedSection() ) {
		dispatch( STORE_NAME ).setPickedSection( clientId );
	}
}

/**
 * Ask the canvas to move to a mode, as its own mode switch does, or stop
 * asking. The canvas takes the request up, and clears it: on the way to
 * Browse it asks about unsaved changes first, and waits for the preview to
 * load, so the mode may change later, or not at all.
 *
 * @param {?string} mode `MODE_BROWSE`, `MODE_EDIT` or `MODE_COMPOSE`, or
 *                       null.
 */
export function requestCanvasMode( mode ) {
	if ( mode !== select( STORE_NAME ).getModeRequest() ) {
		dispatch( STORE_NAME ).setModeRequest( mode );
	}
}

/**
 * @return {string} The device the canvas shows the page on: `desktop`,
 *                  `tablet` or `mobile`.
 */
export function getCanvasDevice() {
	return select( STORE_NAME ).getCanvasDevice();
}

/**
 * Show the page on another device. Compose always shows it on a desktop,
 * and picks this up again on leaving.
 *
 * @param {string} device `desktop`, `tablet` or `mobile`.
 */
export function setCanvasDevice( device ) {
	if ( device !== getCanvasDevice() ) {
		dispatch( STORE_NAME ).setCanvasDevice( device );
	}
}

/**
 * @return {string} The device the canvas shows the page on, kept up to date.
 */
export function useCanvasDevice() {
	return useSelect(
		( selectStore ) => selectStore( STORE_NAME ).getCanvasDevice(),
		[]
	);
}

/**
 * Ask the canvas to open the header or footer, as Edit header or Edit
 * footer does, or stop asking. The canvas takes the request up, and clears
 * it, once it is in Edit or Compose with that part on it.
 *
 * @param {?string} area `header` or `footer`, or null.
 */
export function requestOpenPart( area ) {
	if ( area !== select( STORE_NAME ).getPartRequest() ) {
		dispatch( STORE_NAME ).setPartRequest( area );
	}
}

/**
 * Note the header or footer open in Edit content or Freeform, or that none
 * is. Set before core opens it, so its blocks open the right way from the
 * start.
 *
 * @param {?string} clientId The part's client ID, or null.
 * @param {?string} how      `PART_CONTENT` or `PART_FREEFORM`.
 */
export function setOpenPart( clientId, how = null ) {
	const current = select( STORE_NAME ).getOpenPart();
	const next = clientId && how ? { clientId, how } : null;

	if ( current?.clientId !== next?.clientId || current?.how !== next?.how ) {
		dispatch( STORE_NAME ).setOpenPart( next );
	}
}

/**
 * How a header or footer is open, kept up to date.
 *
 * @param {string} clientId The part's client ID.
 * @return {?string} `PART_CONTENT` or `PART_FREEFORM`, or null while the
 *                   section layer hasn't opened it, as when core's own tools
 *                   do.
 */
export function useOpenPart( clientId ) {
	return useSelect(
		( selectStore ) => {
			const openPart = selectStore( STORE_NAME ).getOpenPart();

			return openPart?.clientId === clientId ? openPart.how : null;
		},
		[ clientId ]
	);
}

/**
 * Note where a section's Edit posts was clicked, so the posts' screen can
 * lead back there and the canvas can pick the section again, or forget it.
 *
 * @param {?Object} trip `{ entity, label, postType, sectionIndex, to }`:
 *                       the page's editor entity, as `postType:postId`, its
 *                       name, the post type whose screen it led to, where
 *                       the section is on the page, top first, and the route
 *                       back. Null to forget it.
 */
export function setPostsTrip( trip ) {
	dispatch( STORE_NAME ).setPostsTrip( trip );
}

/**
 * @return {?Object} The way back from the posts' screen, kept up to date.
 *                   See `setPostsTrip`.
 */
export function usePostsTrip() {
	return useSelect(
		( selectStore ) => selectStore( STORE_NAME ).getPostsTrip(),
		[]
	);
}

/**
 * Note where the full-screen editor opens what the canvas shows, so the top
 * bar's Options menu can offer it, or forget it when the canvas goes.
 *
 * @param {?Object} route `{ to, search }`, as `getEditRoute()` gives it.
 */
export function setCanvasEditRoute( route ) {
	dispatch( STORE_NAME ).setEditRoute( route );
}

/**
 * @return {?Object} Where the full-screen editor opens what the canvas
 *                   shows, or null with no canvas or nothing to open.
 */
export function useCanvasEditRoute() {
	return useSelect(
		( selectStore ) => selectStore( STORE_NAME ).getEditRoute(),
		[]
	);
}
