/**
 * Which of the site's menus an opened page is in, and changing that: a Menus
 * row in its details that names the menu it is in, and a switch for each menu
 * in its pencil.
 *
 * The switches are the Pages list's, so a menu that updates by itself stays
 * that way, a page inside another goes in its dropdown, and every change
 * waits for Save.
 */

/**
 * Internal dependencies
 */
import { cnlEditorStore } from '../../../records';
import {
	buildNavigationLocationsMap,
	TEMPLATE_PARTS_QUERY,
} from '../../navigation/navigation-locations';
import { getNavigationContentFromEditedRecord } from '../../navigation-edit/navigation-blocks';
import { usePages } from './data';
import { useHomepageState } from './homepage';
import { HOMEPAGE } from './homepage-state';
import { getMenuBlocks } from './menu-items';
import { isTargetInMenu, useMenuSwitches } from './menu-switches';
import {
	__,
	coreDataStore,
	decodeEntities,
	Skeleton,
	sprintf,
	Stack,
	Switch,
	Text,
	UiNotice,
	useId,
	useMemo,
	useSelect,
	VisuallyHidden,
} from '../../../wordpress-packages';

const EMPTY_ARRAY = [];

function getMenuName( menu ) {
	const title = menu?.title?.raw || menu?.title?.rendered || '';

	return title ? decodeEntities( title ) : __( 'Untitled menu' );
}

/**
 * Where on the site a menu shows, in a few words.
 *
 * @param {Object[]} places The menu's places, from the locations map.
 * @return {string} Where it shows, or that it doesn't.
 */
function getPlacesText( places ) {
	const areas = [
		...new Set( places.map( ( place ) => place.areaLabel ) ),
	].map( ( area ) => area.toLocaleLowerCase() );

	if ( ! areas.length ) {
		return __( 'This menu is not shown on your site' );
	}

	const list = new Intl.ListFormat(
		document.documentElement.lang || undefined,
		{ type: 'conjunction' }
	).format( areas );

	return sprintf(
		/* translators: %s: where a menu shows, like "header and footer". */
		__( 'Shown in the %s' ),
		list
	);
}

/**
 * Every menu, by name, with where it shows. Menus shown on the site come
 * first, as a page in one that isn't shown won't be seen.
 *
 * @return {Object} `{ isLoading, menus }`, each menu `{ id, isShown, name,
 *                  placesText }`.
 */
export function usePageMenus() {
	const { isLoading, menus, templateParts } = useSelect( ( select ) => {
		const menuStore = select( cnlEditorStore );
		const store = select( coreDataStore );
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
				store.getEntityRecords( ...templatePartArgs ) || EMPTY_ARRAY,
		};
	}, [] );
	const list = useMemo( () => {
		const locations = buildNavigationLocationsMap(
			templateParts,
			menus[ 0 ]?.id
		);
		const all = menus.map( ( menu ) => {
			const places = locations[ menu.id ] || EMPTY_ARRAY;

			return {
				id: Number( menu.id ),
				isShown: places.length > 0,
				name: getMenuName( menu ),
				placesText: getPlacesText( places ),
			};
		} );

		return [
			...all.filter( ( menu ) => menu.isShown ),
			...all.filter( ( menu ) => ! menu.isShown ),
		];
	}, [ menus, templateParts ] );

	return { isLoading, menus: list };
}

/**
 * Shown while the menus load, in place of what they say.
 *
 * @return {Element} A placeholder.
 */
function MenusLoading() {
	return (
		<span className="cnl-page-menus__loading" role="status">
			<Skeleton aria-hidden style={ { height: 16, width: 120 } } />
			<VisuallyHidden>{ __( 'Loading menus' ) }</VisuallyHidden>
		</span>
	);
}

/**
 * The page as the menu switches know it: its ID, or `HOMEPAGE` for the
 * homepage, which menus link to as Home.
 *
 * @param {Object} page     Page record.
 * @param {Object} homepage Result of `useHomepageState`.
 * @return {number|string} The target.
 */
function getTarget( page, homepage ) {
	return homepage.pageId && homepage.pageId === Number( page.id )
		? HOMEPAGE
		: Number( page.id );
}

/**
 * The Menus row's value: the name of the menu the page is in, that it's in
 * several, or that it's in none. A long name is cut short, with all of it in
 * its tooltip. Until every menu has loaded, it can't say which, so it shows
 * that it's loading rather than that the page is in none.
 *
 * @param {Object} props      Component props.
 * @param {Object} props.item Page record.
 * @return {Element} The value.
 */
export function PageMenusView( { item } ) {
	const { isLoading: isLoadingMenus, menus } = usePageMenus();
	const homepage = useHomepageState();
	const { isLoading: isLoadingPages, pages } = usePages();
	const contents = useSelect(
		( select ) => {
			const store = select( coreDataStore );

			// Each menu's content, unsaved changes included: `null` while it
			// loads, and empty if it couldn't be loaded.
			return menus.map( ( { id } ) => {
				const args = [ 'postType', 'wp_navigation', id ];

				if ( store.getEntityRecord( ...args ) ) {
					return getNavigationContentFromEditedRecord(
						store.getEditedEntityRecord( ...args )
					);
				}

				return store.hasFinishedResolution( 'getEntityRecord', args )
					? ''
					: null;
			} );
		},
		[ menus ]
	);

	if (
		isLoadingMenus ||
		isLoadingPages ||
		homepage.isLoading ||
		contents.some( ( content ) => typeof content !== 'string' )
	) {
		return <MenusLoading />;
	}

	const target = getTarget( item, homepage );
	const inMenus = menus.filter( ( menu, index ) =>
		isTargetInMenu( getMenuBlocks( contents[ index ] ), target, {
			homepage,
			pages,
		} )
	);
	let text = __( 'Not in a menu' );

	if ( inMenus.length === 1 ) {
		text = inMenus[ 0 ].name;
	} else if ( inMenus.length > 1 ) {
		text = __( 'Shown in multiple menus' );
	}

	return (
		<span className="cnl-page-menus__value" title={ text }>
			{ text }
		</span>
	);
}

/**
 * One menu's switch for the page: the menu's name and where it shows, with the
 * switch at the end, as on the Pages list.
 *
 * @param {Object}        props          Component props.
 * @param {Object}        props.homepage Result of `useHomepageState`.
 * @param {Object}        props.menu     From `usePageMenus`.
 * @param {Object[]}      props.pages    Every page.
 * @param {number|string} props.target   Page ID, or `HOMEPAGE`.
 * @return {?Element} The switch, once the menu has loaded.
 */
function PageMenuSwitch( { homepage, menu, pages, target } ) {
	const switches = useMenuSwitches( { homepage, menuId: menu.id, pages } );
	const nameId = useId();
	const descriptionId = useId();

	if ( ! switches.isReady ) {
		return null;
	}

	const { checked, disabled, isWaitingToPublish, note } =
		switches.getSwitch( target );
	// The warning above the switches says a draft waits to be published.
	const description = ( ! isWaitingToPublish && note ) || menu.placesText;

	return (
		<li className="cnl-page-menus__item">
			<span className="cnl-page-menus__text">
				<span className="cnl-page-menus__name" id={ nameId }>
					{ menu.name }
				</span>
				<span
					className="cnl-page-menus__description"
					id={ descriptionId }
				>
					{ description }
				</span>
			</span>
			<Switch
				aria-describedby={ descriptionId }
				aria-labelledby={ nameId }
				checked={ checked }
				className="cnl-page-menus__switch"
				disabled={ disabled }
				onCheckedChange={ () => switches.toggle( target ) }
			/>
		</li>
	);
}

/**
 * The Menus row's pencil: a switch for each menu, by name, under a warning
 * when the page isn't published, as no menu shows it until it is.
 *
 * @param {Object} props      Component props.
 * @param {Object} props.data Page record.
 * @return {Element} The switches.
 */
export function PageMenusEdit( { data } ) {
	const { isLoading, menus } = usePageMenus();
	const homepage = useHomepageState();
	const { pages } = usePages();
	const target = getTarget( data, homepage );

	if ( isLoading ) {
		return <MenusLoading />;
	}

	if ( ! menus.length ) {
		return (
			<Text variant="body-sm">
				{ __( 'Your site doesn’t have a menu yet.' ) }
			</Text>
		);
	}

	return (
		<Stack direction="column" gap="lg">
			{ data.status !== 'publish' && (
				<UiNotice.Root intent="warning">
					<UiNotice.Description>
						{ __(
							'This page won’t show in your menus until it’s published.'
						) }
					</UiNotice.Description>
				</UiNotice.Root>
			) }
			<ul aria-label={ __( 'Menus' ) } className="cnl-page-menus">
				{ menus.map( ( menu ) => (
					<PageMenuSwitch
						homepage={ homepage }
						key={ menu.id }
						menu={ menu }
						pages={ pages }
						target={ target }
					/>
				) ) }
			</ul>
		</Stack>
	);
}
