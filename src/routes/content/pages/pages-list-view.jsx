/**
 * Every page in the list view the Menus screen uses, so the two read and work
 * the same way: pages in page order, sub-pages under their parents, dragged
 * to reorder them or to put them under another page.
 *
 * Each page is a menu item block in a block editor of its own, which is never
 * saved. A drag becomes page moves, which wait to be saved with the rest of
 * the changes. Each row ends with the page's options and, with a main menu, a
 * switch for whether the page is in it.
 */

/**
 * Internal dependencies
 */
import { PrivateListView } from '../../../list-view';
import { createEditorBlocksFromNavigationBlocks } from '../../navigation-edit/navigation-blocks';
import { getPageTitle } from './data';
import { getHomepageSummary } from './homepage';
import { HOMEPAGE } from './homepage-state';
import { getPageBlockChanges, getPageTreeBlocks } from './page-blocks';
import { AddOptions } from './use-add-menu-item';
import { getStatusBadge } from './page-labels';
import {
	getPageKeyboardTarget,
	getPageMoveChanges,
	filterPageTree,
} from './page-tree';
import {
	__,
	Badge,
	blockEditorStore,
	BlockEditorProvider,
	blocksStore,
	createBlock,
	createContext,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	plusIcon,
	sprintf,
	Spinner,
	SwitchControl,
	Tooltip,
	useCallback,
	useContext,
	useDispatch,
	useEditorAssets,
	useEditorSettings,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useShortcutEventMatch,
} from '../../../wordpress-packages';

/*
 * What every row shares: the menu, the page moves and so on. A context, so the
 * rows, which the list view only redraws when their block changes, follow it.
 */
const RowContext = createContext( null );

const PAGE_ITEM_BLOCKS = [ 'core/navigation-link', 'core/navigation-submenu' ];
const SELECT_BUTTON = '.block-editor-list-view-block-select-button';
const HOME_ICON_PATH =
	'M12 4L4 7.9V20h16V7.9L12 4zm6.5 14.5H14V13h-4v5.5H5.5V8.8L12 5.7l6.5 3.1v9.7z';
const PAGE_ICON_PATH =
	'M15.5 7.5h-7V9h7V7.5Zm-7 3.5h7v1.5h-7V11Zm7 3.5h-7V16h7v-1.5Z M17 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2ZM7 5.5h10a.5.5 0 0 1 .5.5v12a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5Z';

/**
 * Draw a row's icon with another one, as the list view draws icons from the
 * kind of block rather than what it means here. A page with sub-pages is a
 * submenu block, but is still a page; the homepage's page has a house.
 *
 * @param {string} selector Rows to change.
 * @param {string} path     SVG path of the icon.
 * @return {string} CSS.
 */
function getIconRule( selector, path ) {
	const icon = encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${ path }"/></svg>`
	);
	const target = `.cnl-pages-list-view ${ selector } ${ SELECT_BUTTON } > .block-editor-block-icon`;

	return `${ target } svg { visibility: hidden; } ${ target } { background-color: currentColor; mask: url("data:image/svg+xml,${ icon }") center / 24px 24px no-repeat; }`;
}

/**
 * Say that pages can go under pages: each item takes the same items. The block
 * editor works this out as blocks render, but these are only ever a list.
 *
 * @return {null} Nothing.
 */
function PageBlockListSettings() {
	const { updateBlockListSettings } = useDispatch( blockEditorStore );
	const parentClientIds = useSelect( ( select ) => {
		const store = select( blockEditorStore );

		return [
			...store.getBlockOrder().slice( 0, 1 ),
			...PAGE_ITEM_BLOCKS.flatMap( ( name ) =>
				store.getBlocksByName( name )
			),
		].join( ',' );
	}, [] );

	useEffect( () => {
		updateBlockListSettings(
			Object.fromEntries(
				parentClientIds
					.split( ',' )
					.filter( Boolean )
					.map( ( clientId ) => [
						clientId,
						{ allowedBlocks: PAGE_ITEM_BLOCKS },
					] )
			)
		);
	}, [ parentClientIds, updateBlockListSettings ] );

	return null;
}

/**
 * A row's options: ways to move it, and to delete it.
 *
 * @param {Object}   props             Component props.
 * @param {Object[]} props.groups      Groups of `{ disabled, isDestructive,
 *                                     label, onClick, reason }`. `reason`
 *                                     says why a disabled option can't be
 *                                     used.
 * @param {Element}  props.icon        The toggle's icon.
 * @param {string}   props.title       What the row is called.
 * @param {Object}   props.toggleProps The list view's props for the toggle.
 * @return {Element|null} The options, or nothing when there are none.
 */
function RowOptions( { groups, icon, title, toggleProps } ) {
	const filled = groups.filter( ( group ) => group.length );

	if ( ! filled.length ) {
		return null;
	}

	return (
		<DropdownMenu
			className="cnl-pages-list-view__options"
			icon={ icon }
			label={ sprintf(
				/* translators: %s: page title. */
				__( 'Options for %s' ),
				title
			) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ toggleProps }
		>
			{ ( { onClose } ) =>
				filled.map( ( group, index ) => (
					<MenuGroup key={ index }>
						{ group.map( ( item ) => (
							<MenuItem
								// Says why an option can't be used, on hover.
								{ ...( item.reason && {
									description: item.reason,
									label: item.label,
									showTooltip: true,
									// Beside the menu, not over its other options.
									tooltipPosition: 'middle right',
								} ) }
								disabled={ item.disabled }
								isDestructive={ item.isDestructive }
								key={ item.label }
								onClick={ () => {
									onClose();
									item.onClick();
								} }
							>
								{ item.label }
							</MenuItem>
						) ) }
					</MenuGroup>
				) )
			}
		</DropdownMenu>
	);
}

/**
 * The end of a page's row: a badge when visitors can't see it yet, its
 * options, and its menu switch.
 *
 * @param {Object}  props             Props from the list view.
 * @param {string}  props.clientId    The row's block.
 * @param {Element} props.icon        The options toggle's icon.
 * @param {Object}  props.toggleProps The list view's props for the toggle.
 * @return {Element|null} The row's end.
 */
function PageRowEnd( { clientId, icon, toggleProps } ) {
	const row = useContext( RowContext );
	const block = useSelect(
		( select ) => select( blockEditorStore ).getBlock( clientId ),
		[ clientId ]
	);

	if ( ! block ) {
		return null;
	}

	const pageId =
		block.name === 'core/home-link' ? 0 : Number( block.attributes.id );
	const isHomepage = ! pageId || pageId === row.homePageId;
	const target = isHomepage ? HOMEPAGE : pageId;
	const page = row.pagesById.get( pageId );
	const title = isHomepage ? __( 'Homepage' ) : getPageTitle( page );
	const badge = isHomepage
		? getHomepageSummary( row.homepage ).badge
		: getStatusBadge( page?.status );
	const menuSwitch = row.menu?.getSwitch( target );

	return (
		<div className="cnl-pages-list-view__row-end">
			{ badge && (
				<Badge
					className="cnl-pages-list-view__status"
					intent={ badge.intent }
				>
					{ badge.label }
				</Badge>
			) }
			<RowOptions
				groups={ [
					// The same as the switch, said in words.
					menuSwitch
						? [
								{
									disabled: menuSwitch.disabled,
									label: menuSwitch.checked
										? __( 'Hide from menu' )
										: __( 'Show in menu' ),
									onClick: () => row.menu.toggle( target ),
									reason: menuSwitch.disabled
										? menuSwitch.note
										: undefined,
								},
							]
						: [],
					pageId ? row.getPageMoves( pageId ) : [],
					row.menu?.getMenuMoves( target ) || [],
					[
						isHomepage
							? {
									disabled: true,
									isDestructive: true,
									label: __( 'Move to Trash' ),
									onClick: () => {},
									reason: pageId
										? __(
												'This page is your homepage. Choose another homepage before moving it to the Trash.'
											)
										: __(
												'Your homepage shows your latest posts, so there’s no page to move to the Trash.'
											),
								}
							: {
									isDestructive: true,
									label: __( 'Move to Trash' ),
									onClick: () => row.onDelete( pageId ),
								},
					],
				] }
				icon={ icon }
				title={ title }
				toggleProps={ toggleProps }
			/>
			{ menuSwitch && (
				<Tooltip.Root>
					<Tooltip.Trigger
						className="cnl-pages-list-view__switch"
						render={ <span /> }
					>
						<SwitchControl
							checked={ menuSwitch.checked }
							disabled={ menuSwitch.disabled }
							hideLabelFromVision
							label={ sprintf(
								/* translators: %s: page title. */
								__( 'Show %s in your menu' ),
								title
							) }
							onCheckedChange={ () => row.menu.toggle( target ) }
						/>
					</Tooltip.Trigger>
					{ /* Says why a switch can't be used, or what it means. */ }
					<Tooltip.Popup>
						{ menuSwitch.note || __( 'Show in your menu' ) }
					</Tooltip.Popup>
				</Tooltip.Root>
			) }
		</div>
	);
}

/**
 * The + at the end of the list, as on the Menus screen, offering what the
 * screen's Add button does.
 *
 * @param {Object}   props                          Props from the list view.
 * @param {string}   props.descriptionId            Describes where it adds.
 * @param {Object}   props.forwardedRef             The list view's ref for it.
 * @param {number}   props.blockCount               Unused, from the list view.
 * @param {string}   props.clientId                 Unused, from the list view.
 * @param {number}   props.nestingLevel             Unused, from the list view.
 * @param {Function} props.setInsertedBlockClientId Unused, from the list view.
 * @return {Element} The + and its options.
 */
function PagesAppender( {
	blockCount,
	clientId,
	descriptionId,
	forwardedRef,
	nestingLevel,
	setInsertedBlockClientId,
	...props
} ) {
	const { onAddMenuItem, onAddPage } = useContext( RowContext );

	return (
		<DropdownMenu
			icon={ plusIcon }
			label={ __( 'Add' ) }
			popoverProps={ { placement: 'bottom-start' } }
			toggleProps={ {
				...props,
				'aria-describedby': descriptionId,
				__next40pxDefaultSize: true,
				className: [
					typeof props.className === 'string' ? props.className : '',
					'block-editor-inserter__toggle',
					'routes-navigation-edit-list-view__appender',
				]
					.filter( Boolean )
					.join( ' ' ),
				ref: forwardedRef,
			} }
		>
			{ ( { onClose } ) => (
				<AddOptions
					onAddMenuItem={ onAddMenuItem }
					onAddPage={ onAddPage }
					onClose={ onClose }
				/>
			) }
		</DropdownMenu>
	);
}

function renderPagesAppender( { ref, ...props } ) {
	return <PagesAppender { ...props } forwardedRef={ ref } />;
}

/**
 * Every page, in the Menus screen's list view.
 *
 * @param {Object}   props                 Component props.
 * @param {Object}   props.homepage        Result of `useHomepageState`.
 * @param {Object}   [props.menu]          Result of `useMenuSwitches`.
 * @param {Function} [props.onAddMenuItem] Starts adding something that
 *                                         isn't a page to the menu.
 * @param {Function} [props.onAddPage]     Starts a page.
 * @param {Function} props.onDelete        Asks to delete a page, given its ID.
 * @param {Function} props.onPreview       Shows a page, or `HOMEPAGE`.
 * @param {Object}   props.pageOrder       Result of `usePageOrder`.
 * @param {number}   props.previewedId     The page on show, or `HOMEPAGE`.
 * @param {string}   props.search          Only list pages matching this.
 * @return {Element} The list.
 */
export default function PagesListView( {
	homepage,
	menu,
	onAddMenuItem,
	onAddPage,
	onDelete,
	onPreview,
	pageOrder,
	previewedId,
	search,
} ) {
	const { effectivePages, frontPageId, movePages, tree } = pageOrder;
	const homePageId = homepage.pageId || 0;
	const needle = search.trim().toLowerCase();
	const isSearching = Boolean( needle );
	const pagesById = useMemo(
		() =>
			new Map(
				effectivePages.map( ( page ) => [ Number( page.id ), page ] )
			),
		[ effectivePages ]
	);
	const blocks = useMemo( () => {
		const shown = isSearching
			? filterPageTree( tree, search, getPageTitle )
			: tree;

		return getPageTreeBlocks( shown, {
			getTitle: getPageTitle,
			hasHomeLink:
				! homePageId &&
				( ! isSearching ||
					__( 'Homepage' ).toLowerCase().includes( needle ) ),
			homeId: homePageId,
			homeName: __( 'Homepage' ),
			// Pages can't be moved while only some are listed.
			isLocked: isSearching,
		} );
	}, [ homePageId, isSearching, needle, search, tree ] );
	// Rebuilt only when what is listed changes, so a page keeps its row.
	const blocksKey = JSON.stringify( blocks );
	const { isReady: settingsReady, editorSettings } = useEditorSettings( {} );
	const { isReady: assetsReady } = useEditorAssets();
	// Blocks can only be made once their types are registered, which the
	// editor's assets do.
	const hasBlockTypes = useSelect(
		( select ) =>
			[ 'core/navigation', 'core/home-link', ...PAGE_ITEM_BLOCKS ].every(
				( name ) => !! select( blocksStore ).getBlockType( name )
			),
		[]
	);
	const isReady = settingsReady && assetsReady && hasBlockTypes;
	// Pages sit in a Navigation block, as menu items only go inside one. It
	// is never rendered, so it does nothing a Navigation block would do.
	const menuBlock = useMemo(
		() => ( isReady ? createBlock( 'core/navigation' ) : null ),
		[ isReady ]
	);
	const value = useMemo(
		() =>
			menuBlock && [
				{
					...menuBlock,
					innerBlocks: createEditorBlocksFromNavigationBlocks(
						JSON.parse( blocksKey )
					),
				},
			],
		[ blocksKey, menuBlock ]
	);
	const settings = useMemo(
		() => ( { ...editorSettings, hasFixedToolbar: false } ),
		[ editorSettings ]
	);
	const onChange = useCallback(
		( nextValue ) =>
			movePages(
				getPageBlockChanges( nextValue[ 0 ]?.innerBlocks || [], tree, {
					frontPageId,
				} )
			),
		[ frontPageId, movePages, tree ]
	);

	// Move up and down among the pages beside it, which in an auto menu moves
	// it there too.
	const getPageMoves = ( pageId ) => {
		if ( isSearching ) {
			return [];
		}

		const up = getPageKeyboardTarget( tree, pageId, 'ArrowUp' );
		const down = getPageKeyboardTarget( tree, pageId, 'ArrowDown' );

		return [
			{
				disabled: ! up,
				label: __( 'Move up' ),
				onClick: () =>
					movePages(
						getPageMoveChanges( tree, pageId, up, { frontPageId } )
					),
			},
			{
				disabled: ! down,
				label: __( 'Move down' ),
				onClick: () =>
					movePages(
						getPageMoveChanges( tree, pageId, down, {
							frontPageId,
						} )
					),
			},
		];
	};
	const row = {
		getPageMoves,
		homePageId,
		homepage,
		menu,
		onAddMenuItem,
		onAddPage,
		onDelete,
		pagesById,
	};

	if ( ! value ) {
		return (
			<div className="routes-navigation-edit-list-view__loading">
				<Spinner />
			</div>
		);
	}

	return (
		<BlockEditorProvider
			onChange={ onChange }
			onInput={ onChange }
			settings={ settings }
			value={ value }
		>
			<PageBlockListSettings />
			<RowContext.Provider value={ row }>
				<PagesListViewContent
					hasAppender={
						! isSearching && Boolean( onAddMenuItem || onAddPage )
					}
					homePageId={ homePageId }
					onPreview={ onPreview }
					previewedId={ previewedId }
				/>
			</RowContext.Provider>
		</BlockEditorProvider>
	);
}

function PagesListViewContent( {
	hasAppender,
	homePageId,
	onPreview,
	previewedId,
} ) {
	const { clearSelectedBlock, selectBlock } = useDispatch( blockEditorStore );
	const { getSelectedBlockClientId } = useSelect( blockEditorStore );
	const isShortcut = useShortcutEventMatch();
	const rootClientId = useSelect(
		( select ) => select( blockEditorStore ).getBlockOrder()[ 0 ] || '',
		[]
	);
	// The list view also selects rows for its own reasons, like after one is
	// moved, so only a click or Enter on a row shows its page.
	const activatedAt = useRef( 0 );
	const { previewedClientId, iconStyles } = useSelect(
		( select ) => {
			const store = select( blockEditorStore );
			const items = PAGE_ITEM_BLOCKS.flatMap( ( name ) =>
				store.getBlocksByName( name )
			);
			const getId = ( clientId ) =>
				Number( store.getBlockAttributes( clientId )?.id );
			const homeClientId =
				items.find(
					( clientId ) => getId( clientId ) === homePageId
				) || store.getBlocksByName( 'core/home-link' )[ 0 ];
			const rules = store
				.getBlocksByName( 'core/navigation-submenu' )
				.filter( ( clientId ) => clientId !== homeClientId )
				.map( ( clientId ) =>
					getIconRule(
						`[data-block="${ clientId }"]`,
						PAGE_ICON_PATH
					)
				);

			if ( homeClientId && homePageId ) {
				rules.push(
					getIconRule(
						`[data-block="${ homeClientId }"]`,
						HOME_ICON_PATH
					)
				);
			}

			return {
				iconStyles: rules.join( '\n' ),
				previewedClientId:
					previewedId === HOMEPAGE
						? homeClientId
						: items.find(
								( clientId ) =>
									getId( clientId ) === previewedId
							),
			};
		},
		[ homePageId, previewedId ]
	);

	// Mark the page on show as the picked row, however it got there.
	useEffect( () => {
		const selectedClientId = getSelectedBlockClientId();

		if ( previewedClientId && selectedClientId !== previewedClientId ) {
			selectBlock( previewedClientId, null );
		} else if ( ! previewedClientId && selectedClientId ) {
			clearSelectedBlock();
		}
	}, [
		clearSelectedBlock,
		getSelectedBlockClientId,
		previewedClientId,
		selectBlock,
	] );

	const showPage = ( block ) => {
		if ( Date.now() - activatedAt.current >= 500 ) {
			return;
		}

		const pageId =
			block?.name === 'core/home-link'
				? 0
				: Number( block?.attributes?.id );

		onPreview( ! pageId || pageId === homePageId ? HOMEPAGE : pageId );
	};
	const markActivated = ( event ) => {
		if (
			event.target.closest?.( SELECT_BUTTON ) &&
			( event.type === 'click' || event.key === 'Enter' )
		) {
			activatedAt.current = Date.now();
		}
	};
	/*
	 * A page only leaves the list by Move to Trash, which asks first. A row
	 * removes its block on Backspace, Delete, the remove shortcut or Cut, and
	 * skips any of them already handled, so they are marked handled here.
	 * Without this, the page would vanish from the list, though not from the
	 * site, and the pages after it would be renumbered.
	 */
	const keepPages = ( event ) => {
		if (
			event.target.closest?.( '[role=row]' ) &&
			( event.type === 'cut' ||
				event.key === 'Backspace' ||
				event.key === 'Delete' ||
				isShortcut( 'core/block-editor/remove', event ) )
		) {
			event.preventDefault();
		}
	};

	return (
		// The rows handle the keyboard; this listens in, and keeps them from
		// removing pages.

		<div
			className="routes-navigation-edit-list-view cnl-pages-list-view"
			onClickCapture={ markActivated }
			onCutCapture={ keepPages }
			onKeyDownCapture={ ( event ) => {
				keepPages( event );
				markActivated( event );
			} }
		>
			{ iconStyles && <style>{ iconStyles }</style> }
			<PrivateListView
				blockSettingsMenu={ PageRowEnd }
				description={ __( 'Every page on your site.' ) }
				isExpanded
				onSelect={ showPage }
				renderAppender={ hasAppender ? renderPagesAppender : undefined }
				rootClientId={ rootClientId }
				showAppender={ hasAppender }
			/>
		</div>
	);
}
