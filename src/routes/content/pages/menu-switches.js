/**
 * The Pages screen's menu switches: one per page, for whether it is in the
 * site's main menu.
 *
 * A menu that updates by itself (a Page List) stays that way: switching a
 * page off leaves it out, rather than turning the menu into links set by hand,
 * and its order is the pages' own order, changed by dragging them. A menu set
 * by hand has links added and taken out, and its order is changed from each
 * page's ⋮. Anything but pages is added on the Menus screen.
 *
 * Every change waits for Save, like any other site edit.
 */

/**
 * Internal dependencies
 */
import {
	getNavigationContentFromEditedRecord,
	getNavigationItemLabel,
	serializeNavigationBlocks,
} from '../../navigation-edit/navigation-blocks';
import { showMenuSetByHandNotice } from '../../navigation-edit/list-view';
import { isPageExcluded } from '../menu-status';
import { getPageTitle } from './data';
import { getHomeLinkContext } from './homepage';
import { HOMEPAGE, isHomeMenuItem } from './homepage-state';
import {
	addItem,
	addItemFirst,
	canHoldItems,
	findItemPath,
	getExcludedPageIds,
	getItemPlace,
	getMenuBlocks,
	hasMoreThanPages,
	hasPageList,
	indentItem,
	isPageItem,
	moveItem,
	outdentItem,
	removeItem,
	setPageExcluded,
} from './menu-items';
import {
	__,
	coreDataStore,
	noticesStore,
	select as selectFromRegistry,
	sprintf,
	useDispatch,
	useMemo,
	useSelect,
} from '../../../wordpress-packages';

const EMPTY_ARRAY = [];

function createPageLink( page ) {
	return {
		attributes: {
			id: Number( page.id ),
			kind: 'post-type',
			label: getPageTitle( page ),
			type: 'page',
			url: page.link || '/',
		},
		innerBlocks: [],
		name: 'core/navigation-link',
	};
}

function createHomeLink() {
	return {
		attributes: { label: __( 'Home' ) },
		innerBlocks: [],
		name: 'core/home-link',
	};
}

/**
 * Take out every item a callback matches.
 *
 * @param {Object[]} blocks Menu blocks.
 * @param {Function} match  Finds the items.
 * @return {Object[]} New blocks.
 */
function removeAll( blocks, match ) {
	let next = blocks;

	while ( findItemPath( next, match ) ) {
		next = removeItem( next, match );
	}

	return next;
}

/**
 * The main menu's switches, and ways to change the menu from the page list.
 *
 * @param {Object}   args          Arguments.
 * @param {Object}   args.homepage Result of `useHomepageState`.
 * @param {number}   args.menuId   The main menu's ID.
 * @param {Object[]} args.pages    Every page.
 * @return {Object} The menu's state, and what each row shows and does.
 */
export function useMenuSwitches( { homepage, menuId, pages } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const edited = useSelect(
		( select ) => {
			const store = select( coreDataStore );

			if (
				! menuId ||
				! store.getEntityRecord( 'postType', 'wp_navigation', menuId )
			) {
				return null;
			}

			const record = store.getEditedEntityRecord(
				'postType',
				'wp_navigation',
				menuId
			);

			return { blocks: record?.blocks, content: record?.content };
		},
		[ menuId ]
	);
	const content = useMemo(
		() => ( edited ? getNavigationContentFromEditedRecord( edited ) : '' ),
		[ edited ]
	);
	const blocks = useMemo( () => getMenuBlocks( content ), [ content ] );
	const isAutomatic = hasPageList( blocks );
	const excludedIds = useMemo(
		() => getExcludedPageIds( blocks ),
		[ blocks ]
	);
	const pagesById = useMemo(
		() => new Map( pages.map( ( page ) => [ Number( page.id ), page ] ) ),
		[ pages ]
	);
	const homeContext = useMemo(
		() => getHomeLinkContext( homepage ),
		[ homepage ]
	);
	const homePageId = homepage.pageId || 0;

	const getMatch = ( target ) =>
		target === HOMEPAGE
			? ( block ) => isHomeMenuItem( block, homeContext )
			: ( block ) => isPageItem( block, target );

	const isOn = ( target ) => {
		const id = target === HOMEPAGE ? homePageId : Number( target );

		if ( findItemPath( blocks, getMatch( target ) ) ) {
			return true;
		}

		return (
			isAutomatic &&
			Boolean( id ) &&
			! isPageExcluded( pagesById.get( id ), excludedIds, pages )
		);
	};

	/**
	 * Make a change to the menu, to save with the rest, with a way to undo it.
	 *
	 * @param {Object[]} next      New blocks.
	 * @param {string}   [message] What changed, to say so.
	 */
	const apply = ( next, message ) => {
		const previousContent = getNavigationContentFromEditedRecord(
			selectFromRegistry( coreDataStore ).getEditedEntityRecord(
				'postType',
				'wp_navigation',
				menuId
			)
		);
		const nextContent = serializeNavigationBlocks( next );

		if ( nextContent === previousContent ) {
			return;
		}

		editEntityRecord( 'postType', 'wp_navigation', menuId, {
			blocks: undefined,
			content: nextContent,
			selection: undefined,
		} );

		if ( ! message ) {
			return;
		}

		showMenuSetByHandNotice( {
			createSuccessNotice,
			editEntityRecord,
			message,
			navigationId: menuId,
			previousContent,
		} );
	};

	const getTitle = ( target ) =>
		target === HOMEPAGE
			? __( 'Homepage' )
			: getPageTitle( pagesById.get( Number( target ) ) );

	/**
	 * What a row's switch shows, and a note to say more when it's needed.
	 *
	 * @param {number|string} target Page ID, or `HOMEPAGE`.
	 * @return {Object} `{ checked, disabled, note }`.
	 */
	const getSwitch = ( target ) => {
		const id = target === HOMEPAGE ? homePageId : Number( target );
		const page = pagesById.get( id );

		// Left out with a page above it: it can't be in the menu on its own.
		if (
			isAutomatic &&
			page &&
			! excludedIds.has( id ) &&
			isPageExcluded( page, excludedIds, pages ) &&
			! findItemPath( blocks, getMatch( target ) )
		) {
			const parent = pagesById.get( Number( page.parent ) );

			return {
				checked: false,
				disabled: true,
				note: sprintf(
					/* translators: %s: parent page title. */
					__( 'Out of the menu with %s' ),
					getPageTitle( parent )
				),
			};
		}

		const checked = isOn( target );
		const isDraft = page && page.status !== 'publish';
		let note = '';

		if ( checked && isDraft ) {
			note = __( 'In your menu once published' );
		} else if ( checked && ! isAutomatic ) {
			const place = getItemPlace( blocks, getMatch( target ) );

			if ( place?.parent ) {
				note = sprintf(
					/* translators: %s: menu item label. */
					__( 'In the %s dropdown' ),
					getNavigationItemLabel( place.parent )
				);
			}
		}

		return { checked, disabled: false, note };
	};

	const toggle = ( target ) => {
		const id = target === HOMEPAGE ? homePageId : Number( target );
		const title = getTitle( target );

		if ( isOn( target ) ) {
			let next = removeAll( blocks, getMatch( target ) );

			if ( isAutomatic && id ) {
				next = setPageExcluded( next, id, true );
			}

			apply(
				next,
				sprintf(
					/* translators: %s: page title. */
					__( '“%s” is no longer in your menu.' ),
					title
				)
			);

			return;
		}

		// A menu that updates by itself takes the page back.
		if ( isAutomatic && id ) {
			apply(
				setPageExcluded( blocks, id, false ),
				sprintf(
					/* translators: %s: page title. */
					__( '“%s” is back in your menu.' ),
					title
				)
			);

			return;
		}

		// The homepage goes in as a Home link, first, whatever it shows.
		if ( target === HOMEPAGE ) {
			apply(
				addItemFirst( blocks, createHomeLink() ),
				__( 'Your homepage is in your menu.' )
			);

			return;
		}

		// A sub-page goes in its parent's dropdown, when its parent is at the
		// top of the menu.
		const page = pagesById.get( id );
		const parentId = Number( page?.parent ) || 0;
		const parentPlace = parentId
			? getItemPlace( blocks, ( block ) => isPageItem( block, parentId ) )
			: null;
		const under = parentPlace?.depth === 0 ? parentId : 0;
		const next = addItem(
			blocks,
			createPageLink( page ),
			under ? ( block ) => isPageItem( block, under ) : null
		);

		apply(
			next,
			under
				? sprintf(
						/* translators: 1: page title, 2: parent page title. */
						__( '“%1$s” added to the %2$s dropdown.' ),
						title,
						getPageTitle( pagesById.get( under ) )
					)
				: sprintf(
						/* translators: %s: page title. */
						__( '“%s” added to the end of your menu.' ),
						title
					)
		);
	};

	/**
	 * Ways to move a row's item within a menu set by hand, for its ⋮.
	 *
	 * @param {number|string} target Page ID, or `HOMEPAGE`.
	 * @return {Object[]} `{ disabled, label, onClick }` for each.
	 */
	const getMenuMoves = ( target ) => {
		if ( isAutomatic ) {
			return EMPTY_ARRAY;
		}

		const match = getMatch( target );
		const place = getItemPlace( blocks, match );

		if ( ! place ) {
			return EMPTY_ARRAY;
		}

		const title = getTitle( target );
		const moves = [
			{
				disabled: ! place.previous,
				label: __( 'Move earlier in menu' ),
				onClick: () =>
					apply(
						moveItem( blocks, match, -1 ),
						sprintf(
							/* translators: %s: page title. */
							__( 'Moved “%s” earlier in your menu.' ),
							title
						)
					),
			},
			{
				disabled: ! place.next,
				label: __( 'Move later in menu' ),
				onClick: () =>
					apply(
						moveItem( blocks, match, 1 ),
						sprintf(
							/* translators: %s: page title. */
							__( 'Moved “%s” later in your menu.' ),
							title
						)
					),
			},
		];

		if ( place.previous && canHoldItems( place.previous ) ) {
			const label = getNavigationItemLabel( place.previous );

			moves.push( {
				label: sprintf(
					/* translators: %s: menu item label. */
					__( 'Move into the %s dropdown' ),
					label
				),
				onClick: () =>
					apply(
						indentItem( blocks, match ),
						sprintf(
							/* translators: 1: page title, 2: menu item label. */
							__(
								'Moved “%1$s” into the %2$s dropdown. Its address hasn’t changed.'
							),
							title,
							label
						)
					),
			} );
		}

		if ( place.parent ) {
			moves.push( {
				label: sprintf(
					/* translators: %s: menu item label. */
					__( 'Move out of the %s dropdown' ),
					getNavigationItemLabel( place.parent )
				),
				onClick: () =>
					apply(
						outdentItem( blocks, match ),
						sprintf(
							/* translators: %s: page title. */
							__( 'Moved “%s” out of the dropdown.' ),
							title
						)
					),
			} );
		}

		return moves;
	};

	// A page moved to the Trash leaves a menu set by hand with it. A menu that
	// updates by itself drops it on its own.
	const removePage = ( pageId ) => {
		if ( ! isAutomatic ) {
			apply( removeAll( blocks, getMatch( pageId ) ) );
		}
	};

	return {
		getMenuMoves,
		getSwitch,
		hasMoreThanPages: hasMoreThanPages( blocks ),
		isAutomatic,
		isReady: Boolean( edited ),
		removePage,
		toggle,
	};
}
