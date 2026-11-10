/**
 * The Pages screen's list: every page, in page order, in the same list view
 * as the Menus screen, with a switch on each for whether it is in the site's
 * main menu.
 *
 * The menu stays one that updates by itself for as long as it can: pages can
 * be switched off, moved and added without it ever becoming a list of links
 * set by hand. Only adding something that isn't a page does that, from the
 * screen's Add menu (`use-add-menu-item.jsx`).
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import ScreenLinks from '../../../screen-links';
import useMainMenu from '../use-main-menu';
import { usePages } from './data';
import { parseTarget, useHomepageState } from './homepage';
import { HOMEPAGE } from './homepage-state';
import { useMenuSwitches } from './menu-switches';
import { countPageTree } from './page-tree';
import { LIST_PATH, usePageTrash } from './page-tree-list';
import PagesListView from './pages-list-view';
import { SYSTEM_PAGES_CONTENT } from './system-pages';
import usePageOrder from './use-page-order';
import {
	__,
	compassIcon,
	EmptyState,
	pageIcon,
	pagesIcon,
	SearchControl,
	Skeleton,
	Stack,
	UiButton,
	useMemo,
	useState,
} from '../../../wordpress-packages';

/*
 * Pages a site has, sub-pages included, before the list gets a search box:
 * about as many as fit in the panel before it scrolls.
 */
const SEARCH_THRESHOLD = 20;

function ListSkeleton() {
	return (
		<Stack
			aria-hidden
			className="cnl-pages-list cnl-pages-list--loading"
			direction="column"
			gap="md"
		>
			{ [ 62, 48, 70, 40, 56 ].map( ( width, index ) => (
				<Skeleton
					key={ index }
					style={ { height: 16, width: `${ width }%` } }
				/>
			) ) }
		</Stack>
	);
}

/**
 * The line under "Manage all menus", saying what other menus the site has.
 *
 * @param {string[]} otherMenuAreas Where other menus show.
 * @return {string} Description.
 */
function getOtherMenusDescription( otherMenuAreas ) {
	if ( ! otherMenuAreas.length ) {
		return __( 'Add a menu for your footer, or anywhere else.' );
	}

	if ( otherMenuAreas.length === 1 && otherMenuAreas[ 0 ] === 'footer' ) {
		return __(
			'Your footer has a menu too. Change it, and any others, here.'
		);
	}

	return __( 'Your site has other menus too. Change them here.' );
}

/**
 * Every page, with a switch on each for the site's main menu when there is
 * one.
 *
 * @param {Object}   props               Component props.
 * @param {boolean}  props.canCreate     Whether the user can add pages.
 * @param {Function} props.onAddMenuItem Starts adding something that isn't
 *                                       a page to the menu, if there is one.
 * @param {Function} props.onAddPage     Opens the add page flow, given where
 *                                       the new page goes: 'menu', or
 *                                       nothing to ask.
 * @return {Element} The list.
 */
export default function PagesList( { canCreate, onAddMenuItem, onAddPage } ) {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const mainMenu = useMainMenu();
	const { menuId } = mainMenu;
	const { frontPageId, isLoading, pages } = usePages();
	const homepage = useHomepageState();
	const pageOrder = usePageOrder( { frontPageId, pages } );
	const switches = useMenuSwitches( {
		homepage,
		menuId,
		pages: pageOrder.effectivePages,
	} );
	const menu = menuId && switches.isReady ? switches : null;
	const [ search, setSearch ] = useState( '' );
	// The canvas shows the homepage until something else is picked.
	let previewedId = parseTarget( searchParams.previewId ) || HOMEPAGE;

	if ( previewedId === homepage.pageId ) {
		previewedId = HOMEPAGE;
	}

	const trash = usePageTrash( {
		pages: pageOrder.effectivePages,
		previewedId,
	} );
	const pageCount = useMemo(
		() => countPageTree( pageOrder.tree ),
		[ pageOrder.tree ]
	);
	const showPage = ( target ) =>
		navigate( {
			search: { ...searchParams, previewId: target },
			to: LIST_PATH,
		} );

	if (
		( isLoading && ! pages.length ) ||
		mainMenu.isLoading ||
		( menuId && ! switches.isReady )
	) {
		return <ListSkeleton />;
	}

	if ( ! pages.length ) {
		return (
			<EmptyState.Root className="cnl-pages-list__empty">
				<EmptyState.Icon icon={ pageIcon } />
				<EmptyState.Title>{ __( 'No pages yet' ) }</EmptyState.Title>
				<EmptyState.Description>
					{ __( 'Add your first page to start building your site.' ) }
				</EmptyState.Description>
				{ canCreate && (
					<EmptyState.Actions>
						<UiButton onClick={ () => onAddPage() }>
							{ __( 'Add page' ) }
						</UiButton>
					</EmptyState.Actions>
				) }
			</EmptyState.Root>
		);
	}

	return (
		<div className="cnl-pages-list">
			<div className="cnl-pages-list__group">
				{ pageCount > SEARCH_THRESHOLD && (
					<SearchControl
						__nextHasNoMarginBottom
						label={ __( 'Find a page' ) }
						onChange={ setSearch }
						placeholder={ __( 'Find a page' ) }
						value={ search }
					/>
				) }
				<PagesListView
					homepage={ homepage }
					menu={ menu }
					onAddMenuItem={ menu ? onAddMenuItem : undefined }
					onAddPage={ canCreate ? () => onAddPage() : undefined }
					onDelete={ ( pageId ) =>
						trash.requestDelete(
							pageId,
							menu ? () => menu.removePage( pageId ) : undefined
						)
					}
					onPreview={ ( target ) => showPage( target ) }
					pageOrder={ pageOrder }
					previewedId={ previewedId }
					search={ search }
				/>
			</div>
			<ScreenLinks
				label={ __( 'More options' ) }
				links={ [
					menuId &&
						menu?.hasMoreThanPages && {
							description: __(
								'Your menu has links too. Change them here.'
							),
							icon: compassIcon,
							title: __( 'Everything in your menu' ),
							to: `/navigation/edit/${ encodeURIComponent(
								menuId
							) }`,
						},
					// Pages that are templates in WordPress, a step down.
					{
						description: __(
							'Change pages your site makes for itself, like the 404 page.'
						),
						icon: pagesIcon,
						search: { content: SYSTEM_PAGES_CONTENT },
						title: __( 'System pages' ),
						to: LIST_PATH,
					},
					menuId && {
						description: getOtherMenusDescription(
							mainMenu.otherMenuAreas
						),
						icon: compassIcon,
						title: __( 'Manage all menus' ),
						to: '/navigation',
					},
				].filter( Boolean ) }
			/>
			{ trash.modal }
		</div>
	);
}
