/**
 * Internal dependencies
 */
import { cnlEditorStore } from '../../records';
import {
	buildNavigationLocationsMap,
	getMainMenu,
	TEMPLATE_PARTS_QUERY,
} from '../navigation/navigation-locations';
import {
	appendNavigationBlocksToContent,
	createNavigationLinkBlockFromPage,
	getNavigationContentFromEditedRecord,
	isAutoMenuContent,
	serializeNavigationBlocks,
} from '../navigation-edit/navigation-blocks';
import { getMenuPages } from './menu-status';
import {
	getExcludedPageIds,
	getMenuBlocks,
	hasPageList,
	setPageExcluded,
} from './pages/menu-items';
import {
	coreDataStore,
	resolveSelect,
	select,
	useDispatch,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];

function getMenuTitleText( menu ) {
	return menu?.title?.raw || menu?.title?.rendered || '';
}

/**
 * A menu's content as it stands, unsaved changes included.
 *
 * @param {number} menuId Menu ID.
 * @return {Promise<string>} Serialized menu content.
 */
export async function getEditedMenuContent( menuId ) {
	await resolveSelect( coreDataStore ).getEntityRecord(
		'postType',
		'wp_navigation',
		menuId
	);

	return getNavigationContentFromEditedRecord(
		select( coreDataStore ).getEditedEntityRecord(
			'postType',
			'wp_navigation',
			menuId
		)
	);
}

/**
 * The menu in the site header, and which pages it links to, counting changes
 * that haven't been saved yet. Also where on the site it shows, and where the
 * site's other menus show.
 *
 * @return {Object} Main menu details.
 */
export default function useMainMenu() {
	const { isLoading, menus, templateParts } = useSelect(
		( selectFromStore ) => {
			const menuStore = selectFromStore( cnlEditorStore );
			const store = selectFromStore( coreDataStore );
			const templatePartArgs = [
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY,
			];

			return {
				isLoading:
					! menuStore.hasFinishedResolution( 'getNavigationMenus' ) ||
					! store.hasFinishedResolution(
						'getEntityRecords',
						templatePartArgs
					),
				menus: menuStore.getNavigationMenus() || EMPTY_ARRAY,
				templateParts:
					store.getEntityRecords( ...templatePartArgs ) ||
					EMPTY_ARRAY,
			};
		},
		[]
	);
	const menu = useMemo(
		() => getMainMenu( menus, templateParts ),
		[ menus, templateParts ]
	);
	const menuId = menu?.id;
	// Where on the site each menu shows, to tell the main menu apart from
	// the others, which are managed on the Menus screen.
	const { menuArea, otherMenuAreas } = useMemo( () => {
		const locations = buildNavigationLocationsMap(
			templateParts,
			menus[ 0 ]?.id
		);
		const others = new Set();

		Object.entries( locations ).forEach( ( [ id, places ] ) => {
			if ( Number( id ) !== menuId ) {
				places.forEach( ( place ) => others.add( place.area ) );
			}
		} );

		return {
			menuArea: locations[ menuId ]?.[ 0 ]?.area || '',
			otherMenuAreas: [ ...others ],
		};
	}, [ menuId, menus, templateParts ] );
	// The edited menu's content and blocks, by reference. Its content can be a
	// function that serialises its blocks, so it is worked out below only when
	// they change, rather than on every change to any store.
	const edited = useSelect(
		( selectFromStore ) => {
			if ( ! menuId ) {
				return null;
			}

			const store = selectFromStore( coreDataStore );

			if (
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
	const editedBlocks = edited?.blocks;
	const editedContent = edited?.content;
	const hasEditedRecord = !! edited;
	const menuContent = useMemo( () => {
		if ( ! menuId ) {
			return null;
		}

		if ( ! hasEditedRecord ) {
			return menu.content?.raw ?? menu.content ?? '';
		}

		return getNavigationContentFromEditedRecord( {
			blocks: editedBlocks,
			content: editedContent,
		} );
	}, [ editedBlocks, editedContent, hasEditedRecord, menu, menuId ] );
	const menuPages = useMemo(
		() =>
			typeof menuContent === 'string'
				? getMenuPages( menuContent )
				: null,
		[ menuContent ]
	);

	return {
		// A lone Page List, which the Pages screen changes. A menu set by hand
		// is changed on the Menus screen.
		isAutoMenu:
			typeof menuContent === 'string' && isAutoMenuContent( menuContent ),
		isLoading,
		menuArea,
		menuId,
		menuPages,
		menuTitle: getMenuTitleText( menu ),
		otherMenuAreas,
	};
}

/**
 * Add a link to a page at the end of a menu, as a change to review and save
 * with the rest. A menu that lists every page picks the page up by itself, so
 * there it only stops leaving the page out, if it was.
 *
 * @return {Function} Callback taking the menu ID and the page record.
 */
export function useAddPageToMenu() {
	const { editEntityRecord } = useDispatch( coreDataStore );

	return async ( menuId, page ) => {
		const content = await getEditedMenuContent( menuId );
		const blocks = getMenuBlocks( content );

		if ( hasPageList( blocks ) ) {
			if ( getExcludedPageIds( blocks ).has( Number( page.id ) ) ) {
				editEntityRecord( 'postType', 'wp_navigation', menuId, {
					blocks: undefined,
					content: serializeNavigationBlocks(
						setPageExcluded( blocks, page.id, false )
					),
					selection: undefined,
				} );
			}

			return;
		}

		editEntityRecord( 'postType', 'wp_navigation', menuId, {
			blocks: undefined,
			content: appendNavigationBlocksToContent( content, [
				createNavigationLinkBlockFromPage( page ),
			] ),
			selection: undefined,
		} );
	};
}

/**
 * Keep pages out of a menu that lists every page, by having it leave them
 * out, as a change to review and save with the rest. The menu still updates
 * itself. A menu of links doesn't take new pages, so it is left as it is.
 *
 * @return {Function} Callback taking the menu ID and the page IDs to leave out.
 */
export function useKeepPagesOutOfMenu() {
	const { editEntityRecord } = useDispatch( coreDataStore );

	return async ( menuId, pageIds ) => {
		const content = await getEditedMenuContent( menuId );
		const blocks = getMenuBlocks( content );

		if ( ! hasPageList( blocks ) ) {
			return;
		}

		editEntityRecord( 'postType', 'wp_navigation', menuId, {
			blocks: undefined,
			content: serializeNavigationBlocks(
				pageIds.reduce(
					( next, pageId ) => setPageExcluded( next, pageId, true ),
					blocks
				)
			),
			selection: undefined,
		} );
	};
}
