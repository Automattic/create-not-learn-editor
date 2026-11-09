/**
 * Moving pages: a new parent or a new place among the pages beside them.
 *
 * A move is saved straight away, with a way to undo it, as the order of pages
 * is the site's structure rather than a draft of one page. The pages show
 * where they went before the save comes back.
 */

/**
 * Internal dependencies
 */
import { getErrorMessage } from '../../../records';
import { getPageTitle } from './data';
import { buildPageTree } from './page-tree';
import {
	__,
	coreDataStore,
	noticesStore,
	sprintf,
	useDispatch,
	useEffect,
	useMemo,
	useState,
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
 * Pages as they stand, moves not yet saved included, and a way to move them.
 *
 * @param {Object}   args             Arguments.
 * @param {number}   args.frontPageId The homepage's page, which leads.
 * @param {Object[]} args.pages       Every page.
 * @return {Object} `{ effectivePages, movePages, tree }`.
 */
export default function usePageOrder( { frontPageId, pages } ) {
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	// Moves shown before the saved pages come back, keyed by page ID.
	const [ overrides, setOverrides ] = useState( {} );
	const effectivePages = useMemo(
		() =>
			pages.map( ( page ) =>
				overrides[ page.id ]
					? { ...page, ...overrides[ page.id ] }
					: page
			),
		[ overrides, pages ]
	);
	const tree = useMemo(
		() => buildPageTree( effectivePages, { frontPageId } ),
		[ effectivePages, frontPageId ]
	);

	// Forget a move once the saved page reflects it.
	useEffect( () => {
		setOverrides( ( current ) => {
			const pending = Object.entries( current ).filter(
				( [ id, override ] ) => {
					const page = pages.find(
						( item ) => Number( item.id ) === Number( id )
					);

					return (
						page &&
						( ( Number( page.parent ) || 0 ) !== override.parent ||
							( Number( page.menu_order ) || 0 ) !==
								override.menu_order )
					);
				}
			);

			return pending.length === Object.keys( current ).length
				? current
				: Object.fromEntries( pending );
		} );
	}, [ pages ] );

	const saveChanges = async ( changes ) => {
		setOverrides( ( current ) => {
			const next = { ...current };

			changes.forEach( ( change ) => {
				next[ change.id ] = {
					menu_order: change.menu_order,
					parent: change.parent,
				};
			} );

			return next;
		} );

		try {
			await Promise.all(
				changes.map( ( change ) =>
					saveEntityRecord(
						'postType',
						'page',
						{
							id: change.id,
							menu_order: change.menu_order,
							parent: change.parent,
						},
						{ throwOnError: true }
					)
				)
			);

			return true;
		} catch ( error ) {
			setOverrides( ( current ) => {
				const next = { ...current };

				changes.forEach( ( change ) => delete next[ change.id ] );

				return next;
			} );
			createErrorNotice( getErrorMessage( error ), { type: 'snackbar' } );

			return false;
		}
	};

	/**
	 * Save some moves, with a way to undo them.
	 *
	 * @param {Object[]} changes `{ id, parent, menu_order }` for each page.
	 */
	const movePages = async ( changes ) => {
		if ( ! changes.length ) {
			return;
		}

		const byId = new Map(
			effectivePages.map( ( page ) => [ Number( page.id ), page ] )
		);
		const previous = changes.map( ( change ) => ( {
			id: change.id,
			menu_order: Number( byId.get( change.id )?.menu_order ) || 0,
			parent: Number( byId.get( change.id )?.parent ) || 0,
		} ) );

		if ( await saveChanges( changes ) ) {
			createSuccessNotice( getMoveMessage( changes, byId ), {
				actions: [
					{
						label: __( 'Undo' ),
						onClick: () => saveChanges( previous ),
					},
				],
				id: 'cnl-page-moved',
				type: 'snackbar',
			} );
		}
	};

	return { effectivePages, movePages, tree };
}
