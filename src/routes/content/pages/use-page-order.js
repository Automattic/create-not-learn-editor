/**
 * Moving pages: a new parent or a new place among the pages beside them.
 *
 * A move waits to be saved with the rest of the changes, with a way to undo
 * it. The pages come with their changes, so they show where they went at once.
 */

/**
 * Internal dependencies
 */
import { getPageTitle } from './data';
import { buildPageTree } from './page-tree';
import {
	__,
	coreDataStore,
	noticesStore,
	sprintf,
	useDispatch,
	useMemo,
} from '../../../wordpress-packages';

/**
 * What to say about a set of moves: the page that changed parent, or else the
 * one that moved furthest.
 *
 * @param {Object[]} changes `{ id, parent, menu_order }` for each page.
 * @param {Map}      byId    Pages by ID, before the moves.
 * @return {string} Message.
 */
function getMoveMessage( changes, byId ) {
	const reparented = changes.find(
		( change ) =>
			( Number( byId.get( change.id )?.parent ) || 0 ) !== change.parent
	);

	if ( reparented ) {
		const title = getPageTitle( byId.get( reparented.id ) );

		return reparented.parent
			? sprintf(
					/* translators: 1: page title, 2: parent page title. */
					__( 'Moved “%1$s” under “%2$s”.' ),
					title,
					getPageTitle( byId.get( reparented.parent ) )
				)
			: sprintf(
					/* translators: %s: page title. */
					__( 'Moved “%s” out to the top level.' ),
					title
				);
	}

	const furthest = changes.reduce( ( best, change ) => {
		const distance = Math.abs(
			( Number( byId.get( change.id )?.menu_order ) || 0 ) -
				change.menu_order
		);

		return ! best || distance > best.distance
			? { distance, id: change.id }
			: best;
	}, null );

	return sprintf(
		/* translators: %s: page title. */
		__( 'Moved “%s”.' ),
		getPageTitle( byId.get( furthest?.id ) )
	);
}

/**
 * Pages as they stand, changes not yet saved included, and a way to move them.
 *
 * @param {Object}   args             Arguments.
 * @param {number}   args.frontPageId The homepage's page, which leads.
 * @param {Object[]} args.pages       Every page, with its changes.
 * @return {Object} `{ effectivePages, frontPageId, movePages, tree }`.
 */
export default function usePageOrder( { frontPageId, pages } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const tree = useMemo(
		() => buildPageTree( pages, { frontPageId } ),
		[ frontPageId, pages ]
	);

	const applyChanges = ( changes ) =>
		changes.forEach( ( change ) =>
			editEntityRecord( 'postType', 'page', change.id, {
				menu_order: change.menu_order,
				parent: change.parent,
			} )
		);

	/**
	 * Make some moves, to save with the rest, with a way to undo them.
	 *
	 * @param {Object[]} changes `{ id, parent, menu_order }` for each page.
	 */
	const movePages = ( changes ) => {
		if ( ! changes.length ) {
			return;
		}

		const byId = new Map(
			pages.map( ( page ) => [ Number( page.id ), page ] )
		);
		const previous = changes.map( ( change ) => ( {
			id: change.id,
			menu_order: Number( byId.get( change.id )?.menu_order ) || 0,
			parent: Number( byId.get( change.id )?.parent ) || 0,
		} ) );

		applyChanges( changes );
		createSuccessNotice( getMoveMessage( changes, byId ), {
			actions: [
				{
					label: __( 'Undo' ),
					onClick: () => applyChanges( previous ),
				},
			],
			id: 'cnl-page-moved',
			type: 'snackbar',
		} );
	};

	return { effectivePages: pages, frontPageId, movePages, tree };
}
