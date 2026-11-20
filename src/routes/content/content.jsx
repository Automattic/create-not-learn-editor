import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { withScreenKey } from '../../screen-key';
import { getCurrentEditorPath } from '../static/screens';
import { withUiTheme } from '../../theme';
import { usePostsTrip } from '../../site-canvas/mode';
import { getTemplateDisplayDescription } from '../../records';
import { EMPTY_ARRAY } from './page-layouts';
import { requestDistractionFreeEntry } from '../../editor-layer/distraction-free';
import { getActiveWorkspace } from '../../workspaces/presets';
import useMainMenu from './use-main-menu';
import { PageDetailStage } from './pages/stage';
import { parseTarget, useHomepageState } from './pages/homepage';
import { getPageTitle } from './pages/data';
import { HOMEPAGE } from './pages/homepage-state';
import HomepageStage from './pages/homepage-stage';
import PagesList from './pages/pages-list';
import useAddMenuItem, { AddOptions } from './pages/use-add-menu-item';
import AddPageFlow from './add-page-flow';
import Canvas from './canvas';
import { PostListDataViewsLayout } from './content-fields';
import PostTimeline from './post-timeline-view';
import { getPostViewEmpty, getPostViews } from './post-views';
import { TIMELINE_LAYOUT } from './post-timeline';
import useContentList from './use-content-list';
import { EMPTY_TAB_ICONS, getTemplateIcon, TabLabel } from './tab-label';
import PostKindPicker from '../../pickers/post-kinds';
import { isAskingPostKind } from '../../post-kinds-base';
import { getTemplateTitle, isTemplateTab } from './helpers';
import { getSystemPage, SYSTEM_PAGES_CONTENT } from './pages/system-pages';
import PagesTable from './pages-table';
import useContentRecords, { LISTED_STATUSES } from './use-content-records';
import { useDataViews } from '../../use-dataviews';
import {
	Breadcrumbs,
	Button,
	checkIcon,
	coreDataStore,
	createInterpolateElement,
	searchIcon,
	DropdownMenu,
	EmptyState,
	Icon,
	MenuGroup,
	MenuItem,
	Spinner,
	Tabs,
	ToggleGroupControl,
	ToggleGroupControlOption,
	__,
	layoutIcon,
	moreVerticalIcon,
	pageIcon,
	postListIcon,
	Page,
	sprintf,
	useEffect,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

function Stage() {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const postsTrip = usePostsTrip();
	// The page whose Edit layout opened Layouts, to lead back to.
	const layoutFor = parseTarget( searchParams.layoutFor );
	const layoutForTitle = useSelect(
		( select ) => {
			if ( ! layoutFor || layoutFor === HOMEPAGE ) {
				return layoutFor ? __( 'Homepage' ) : '';
			}

			return getPageTitle(
				select( coreDataStore ).getEditedEntityRecord(
					'postType',
					'page',
					layoutFor
				)
			);
		},
		[ layoutFor ]
	);
	// Where a page being added goes: in the menu, out of it, or the user picks.
	const [ addingPage, setAddingPage ] = useState( null );
	const [ isPickingPostKind, setIsPickingPostKind ] = useState( false );
	const {
		activeTab,
		statusView,
		contentView,
		error,
		isLoading,
		posts,
		previewTemplates,
		selectedTemplateId,
		setContentView,
		templates,
		type,
	} = useContentRecords();
	const mainMenu = useMainMenu();
	const homepage = useHomepageState();
	// Pages adds to the main menu too: anything but a page goes on Menus.
	const menuItemAdder = useAddMenuItem( mainMenu.menuId );
	const {
		contentActions,
		contentFields,
		contentLayouts,
		frontPageId,
		postsPageId,
	} = useContentList( {
		menuPages: mainMenu.menuPages,
		navigate,
		posts,
		statusView,
		type,
	} );
	const isPages = type?.name === 'page';
	// Posts are listed, worded and written as the workspace says.
	const workspace = useSelect( getActiveWorkspace, [] );
	const isAskingKind = useSelect(
		( select ) => isAskingPostKind( select, workspace ),
		[ workspace ]
	);
	const postsSettings = type?.name === 'post' ? workspace.posts : null;
	// Pages lists its pages in menu groups; every other type in DataViews.
	const dataViews = useDataViews( !! type && ! isPages );
	const isPosts = type?.name === 'post';
	const isTimeline = isPosts && contentView.type === TIMELINE_LAYOUT;
	const previewTemplatesKey = useMemo(
		() =>
			previewTemplates
				.map( ( template ) => `${ template.id }:${ template.slug }` )
				.join( '|' ),
		[ previewTemplates ]
	);

	// Asked to add one from outside the list, like the admin bar's New > Page.
	const isAddRequested = !! searchParams.add && !! type;
	useEffect( () => {
		if ( ! isAddRequested ) {
			return;
		}

		navigate( {
			replace: true,
			search: { ...searchParams, add: undefined },
		} );

		if ( type.name === 'page' ) {
			setAddingPage( {} );
		} else if ( type.name === 'post' && isAskingKind ) {
			setIsPickingPostKind( true );
		} else {
			navigate( { to: `/types/${ type.name }/new` } );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isAddRequested ] );

	if ( ! type ) {
		return null;
	}

	const listPath = `/types/${ type.name }/list/${ statusView?.slug || 'all' }`;
	const showTemplates = isTemplateTab( activeTab );
	const isSystemPages = activeTab === SYSTEM_PAGES_CONTENT;
	const drilled =
		isPages && ! showTemplates ? parseTarget( searchParams.postId ) : 0;

	// The homepage's page opens as the homepage, however it was reached.
	if ( drilled === HOMEPAGE || ( drilled && drilled === homepage.pageId ) ) {
		return (
			<>
				<HomepageStage />
				{ addingPage && (
					<AddPageFlow
						mainMenu={ mainMenu }
						menuPlacement={ addingPage.menuPlacement }
						onClose={ () => setAddingPage( null ) }
						templates={ templates }
					/>
				) }
			</>
		);
	}

	if ( drilled ) {
		return <PageDetailStage key={ drilled } pageId={ drilled } />;
	}
	const onChangeContentView = ( nextView ) => {
		setContentView( nextView );
		navigate( {
			search: {
				...searchParams,
				content: undefined,
				page:
					nextView.page && nextView.page > 1
						? nextView.page
						: undefined,
				search: nextView.search || undefined,
			},
			to: listPath,
		} );
	};
	const selectPost = ( postId ) =>
		navigate( {
			search: {
				...searchParams,
				postIds: postId ? [ String( postId ) ] : undefined,
			},
			to: listPath,
		} );
	const openEditor = ( postId ) => {
		requestDistractionFreeEntry();
		navigate( {
			to: `/types/${ type.name }/edit/${ postId }`,
		} );
	};
	const selectTemplate = ( templateId ) =>
		navigate( {
			search: {
				...searchParams,
				content: isSystemPages ? SYSTEM_PAGES_CONTENT : 'templates',
				postIds: templateId ? [ String( templateId ) ] : undefined,
				templateId: undefined,
				templateIds: undefined,
			},
			to: listPath,
		} );
	const handleContentTabChange = ( nextTab ) => {
		navigate( {
			search: {
				...searchParams,
				content: [ 'all', 'templates' ].includes( nextTab )
					? nextTab
					: undefined,
				page: undefined,
				postId: undefined,
				postIds: undefined,
				search: undefined,
				templateId: undefined,
				templateIds: undefined,
			},
			to: listPath,
		} );
	};
	const manageHomepage = () =>
		navigate( {
			search: { postId: HOMEPAGE, previewId: HOMEPAGE },
			to: listPath,
		} );
	const totalPages = Math.max(
		1,
		Math.ceil( posts.length / ( contentView.perPage || 20 ) )
	);
	const addLabel =
		postsSettings?.addLabel ||
		sprintf(
			/* translators: %s: post type singular label. */
			__( 'Add %s' ),
			( type.singular || type.name ).toLowerCase()
		);
	const openCreateFlow = ( menuPlacement ) => {
		if ( type.name === 'page' ) {
			setAddingPage( {
				menuPlacement:
					typeof menuPlacement === 'string'
						? menuPlacement
						: undefined,
			} );
			return;
		}

		if ( ! type.blockEditor ) {
			if ( type.newUrl ) {
				window.open( type.newUrl, '_blank', 'noopener,noreferrer' );
			}
			return;
		}

		// Asked what kind of post it is first, unless they'd rather not be.
		if ( type.name === 'post' && isAskingKind ) {
			setIsPickingPostKind( true );
			return;
		}

		if ( type.name === 'post' && workspace.writeInFocus ) {
			requestDistractionFreeEntry();
		}

		navigate( {
			to: `/types/${ type.name }/new`,
		} );
	};
	// Pages can add to the main menu too, so Add page is a menu while it is an
	// auto menu, or might be: it doesn't change under the pointer as the menu
	// loads. A menu set by hand is changed on the Menus screen.
	const canAddToMenu = Boolean( mainMenu.menuId && mainMenu.isAutoMenu );
	const hasAddMenu =
		type.name === 'page' && ( mainMenu.isLoading || canAddToMenu );
	const pageActions = (
		<div className="routes-post-list__page-actions">
			{ type.canCreate && hasAddMenu && (
				<DropdownMenu
					icon={ null }
					label={ addLabel }
					popoverProps={ { placement: 'bottom-end' } }
					text={ addLabel }
					toggleProps={ {
						__next40pxDefaultSize: true,
						showTooltip: false,
						variant: 'primary',
					} }
				>
					{ ( { onClose } ) => (
						<AddOptions
							onAddMenuItem={
								canAddToMenu
									? menuItemAdder.addMenuItem
									: undefined
							}
							onAddPage={ openCreateFlow }
							onClose={ onClose }
						/>
					) }
				</DropdownMenu>
			) }
			{ type.canCreate && ! hasAddMenu && (
				<Button
					__next40pxDefaultSize
					onClick={ openCreateFlow }
					variant="primary"
				>
					{ addLabel }
				</Button>
			) }
			{ type.name === 'page' && (
				<DropdownMenu
					className="routes-post-list__more-options"
					icon={ moreVerticalIcon }
					label={ __( 'Page options' ) }
					popoverProps={ { placement: 'bottom-end' } }
					toggleProps={ {
						__next40pxDefaultSize: true,
						variant: 'tertiary',
					} }
				>
					{ ( { onClose } ) => (
						<MenuGroup>
							<MenuItem
								onClick={ () => {
									handleContentTabChange( 'all' );
									onClose();
								} }
							>
								{ __( 'Manage pages' ) }
							</MenuItem>
							<MenuItem
								onClick={ () => {
									handleContentTabChange( 'templates' );
									onClose();
								} }
							>
								{ __( 'Manage layouts' ) }
							</MenuItem>
							<MenuItem
								onClick={ () => {
									manageHomepage();
									onClose();
								} }
							>
								{ __( 'Manage homepage' ) }
							</MenuItem>
						</MenuGroup>
					) }
				</DropdownMenu>
			) }
		</div>
	);
	// A status says what it would hold, not to write a first post.
	const tabEmpty =
		statusView && getPostViewEmpty( statusView, contentView.search );
	let emptyIcon = type.name === 'page' ? pageIcon : postListIcon;

	if ( tabEmpty ) {
		emptyIcon = contentView.search
			? searchIcon
			: EMPTY_TAB_ICONS[ statusView.slug ] || emptyIcon;
	}

	const contentEmpty = tabEmpty ? (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ emptyIcon } />
				<EmptyState.Title>{ tabEmpty.title }</EmptyState.Title>
				<EmptyState.Description>
					{ tabEmpty.description }
				</EmptyState.Description>
				{ tabEmpty.canWrite && type.canCreate && (
					<EmptyState.Actions>
						<Button
							__next40pxDefaultSize
							onClick={ openCreateFlow }
							variant="primary"
						>
							{ addLabel }
						</Button>
					</EmptyState.Actions>
				) }
			</EmptyState.Root>
		</div>
	) : (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon
					icon={ type.name === 'page' ? pageIcon : postListIcon }
				/>
				<EmptyState.Title>
					{ sprintf(
						/* translators: %s: post type plural label. */
						__( 'No %s yet' ),
						( type.label || type.name ).toLowerCase()
					) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ sprintf(
						/* translators: %s: post type singular label. */
						__(
							'Create your first %s to start adding content here.'
						),
						( type.singular || type.name ).toLowerCase()
					) }
				</EmptyState.Description>
				{ type.canCreate && (
					<EmptyState.Actions>
						<Button
							__next40pxDefaultSize
							onClick={ openCreateFlow }
							variant="primary"
						>
							{ addLabel }
						</Button>
					</EmptyState.Actions>
				) }
			</EmptyState.Root>
		</div>
	);
	const templateEmpty = isSystemPages ? (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ pageIcon } />
				<EmptyState.Title>{ __( 'No system pages' ) }</EmptyState.Title>
				<EmptyState.Description>
					{ __(
						'Your theme leaves these to WordPress, so there is nothing of its own to change here.'
					) }
				</EmptyState.Description>
			</EmptyState.Root>
		</div>
	) : (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ layoutIcon } />
				<EmptyState.Title>
					{ __( 'No templates found' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ sprintf(
						/* translators: %s: post type label. */
						__( 'No templates are currently available for %s.' ),
						( type.label || type.name ).toLowerCase()
					) }
				</EmptyState.Description>
			</EmptyState.Root>
		</div>
	);

	const isPagesTable = isPages && searchParams.content === 'all';
	let pagesList = null;

	if ( isPages ) {
		pagesList = isPagesTable ? (
			<PagesTable listPath={ listPath } mainMenu={ mainMenu } />
		) : (
			<PagesList
				canCreate={ type.canCreate }
				onAddMenuItem={
					canAddToMenu ? menuItemAdder.addMenuItem : undefined
				}
				onAddPage={ openCreateFlow }
			/>
		);
	}

	let contentList = pagesList;

	if ( ! isPages && ! dataViews ) {
		contentList = (
			<div className="cnl-editor-spinner">
				<Spinner />
			</div>
		);
	} else if ( ! isPages ) {
		const { DataViews } = dataViews;
		const onClickItem = ( item ) => {
			if ( item.status === 'trash' ) {
				return;
			}

			if ( type.blockEditor ) {
				openEditor( item.id );
			} else {
				selectPost( item.id );
			}
		};

		contentList = (
			<DataViews
				actions={ contentActions }
				data={ posts }
				defaultLayouts={ contentLayouts }
				empty={ contentEmpty }
				fields={ contentFields }
				getItemId={ ( item ) => String( item.id ) }
				isLoading={ isLoading }
				key={ `${ previewTemplatesKey }|${ frontPageId }|${ postsPageId }|${
					mainMenu.menuPages ? 'menu' : 'no-menu'
				}` }
				onChangeSelection={ () => {} }
				onChangeView={ onChangeContentView }
				onClickItem={ onClickItem }
				paginationInfo={ {
					totalItems: posts.length,
					totalPages,
				} }
				selection={ EMPTY_ARRAY }
				view={ contentView }
			>
				<PostListDataViewsLayout
					layout={
						isTimeline && (
							<PostTimeline
								actions={ contentActions }
								empty={ contentEmpty }
								onClickItem={ onClickItem }
								search={ contentView.search }
								statuses={
									statusView?.statuses || LISTED_STATUSES
								}
								type={ type }
								view={ contentView }
								withLinks={ !! statusView }
							/>
						)
					}
				/>
			</DataViews>
		);
	}

	// Pages has no tabs: its layouts open from the options menu, as a step
	// down from Pages with a way back.
	const isLayoutsStep = showTemplates && isPages && ! isSystemPages;
	// Layouts, system pages and the table of all pages are steps down from
	// Pages.
	let subScreenLabel = null;

	if ( isLayoutsStep ) {
		subScreenLabel = __( 'Layouts' );
	} else if ( isSystemPages && isPages ) {
		subScreenLabel = __( 'System pages' );
	} else if ( isPagesTable ) {
		subScreenLabel = __( 'All pages' );
	}

	const title = type.menuName || type.label;
	// Opened from a section's Edit posts, the list leads back to its page.
	const siteCrumbs =
		postsTrip?.postType === type.name
			? [ { label: postsTrip.label, to: postsTrip.to } ]
			: [];
	const pageHeader = subScreenLabel
		? {
				ariaLabel: subScreenLabel,
				breadcrumbs: (
					<Breadcrumbs
						items={ [
							...siteCrumbs,
							{ label: title, to: listPath },
							...( isLayoutsStep && layoutFor
								? [
										{
											label: layoutForTitle,
											to: `${ listPath }?${ new URLSearchParams(
												{
													postId: layoutFor,
													previewId: layoutFor,
												}
											) }`,
										},
									]
								: [] ),
							{ label: subScreenLabel },
						] }
					/>
				),
				className: 'cnl-editor-stage cnl-editor-content-page',
			}
		: {
				actions: pageActions,
				ariaLabel: title,
				breadcrumbs:
					siteCrumbs.length > 0 ? (
						<Breadcrumbs
							items={ [ ...siteCrumbs, { label: title } ] }
						/>
					) : undefined,
				className: 'cnl-editor-stage cnl-editor-content-page',
				subTitle:
					( type.name === 'page' &&
						( canAddToMenu
							? __(
									'Every page on your site. Pick one to see it, and switch it on to show it in your menu.'
								)
							: __(
									'Every page on your site. Pick one to see it.'
								) ) ) ||
					postsSettings?.description ||
					type.description ||
					sprintf(
						/* translators: %s: post type label. */
						__( 'Browse, preview, and edit %s.' ),
						( type.label || type.name ).toLowerCase()
					),
				title: siteCrumbs.length > 0 ? undefined : title,
			};

	return (
		<Page { ...pageHeader } hasPadding={ false } headingLevel={ 2 }>
			{ ! isPages && (
				<div className="routes-post-list__tabs-wrapper">
					<Tabs.Root
						onValueChange={ handleContentTabChange }
						value={ showTemplates ? 'templates' : 'content' }
					>
						<Tabs.List>
							<Tabs.Tab value="content">
								<TabLabel
									icon={ type.menuIcon }
									label={ type.menuName || type.label }
								/>
							</Tabs.Tab>
							<Tabs.Tab value="templates">
								<TabLabel
									icon="dashicons-layout"
									label={ __( 'Layouts' ) }
								/>
							</Tabs.Tab>
						</Tabs.List>
					</Tabs.Root>
				</div>
			) }
			{ statusView && ! showTemplates && (
				<div className="routes-post-list__statuses">
					<ToggleGroupControl
						__next40pxDefaultSize
						hideLabelFromVision
						isBlock
						label={ __( 'Show posts' ) }
						onChange={ ( slug ) =>
							navigate( {
								to: `/types/${ type.name }/list/${ slug }`,
							} )
						}
						value={ statusView.slug }
					>
						{ getPostViews().map( ( view ) => (
							<ToggleGroupControlOption
								key={ view.slug }
								label={ view.title }
								value={ view.slug }
							/>
						) ) }
					</ToggleGroupControl>
				</div>
			) }
			{ isSystemPages && (
				<p className="cnl-editor-stage__description">
					{ __(
						'Your site makes these pages for itself, so they aren’t in your list of pages. WordPress calls these templates. Pick one to see it, and change how it looks.'
					) }
				</p>
			) }
			{ showTemplates && ! isSystemPages && (
				<p className="cnl-editor-stage__description">
					{ sprintf(
						/* translators: %s: post type label. */
						__(
							'Layouts decide how your %s are arranged, like where the title and image go. WordPress calls these templates. Changing a layout changes every page that uses it.'
						),
						( type.label || type.name ).toLowerCase()
					) }
				</p>
			) }
			{ error && <div className="cnl-editor-empty">{ error }</div> }
			{ showTemplates ? (
				<div className="routes-post-list__templates">
					{ isLoading && (
						<div className="cnl-editor-spinner">
							<Spinner />
						</div>
					) }
					{ ! isLoading && templates.length > 0 && (
						// Drawn as the homepage's choices are: picking a
						// layout shows it on the canvas.
						<ul
							aria-label={ __( 'Layouts' ) }
							className="cnl-homepage-shows__options"
							role="list"
						>
							{ templates.map( ( template ) => {
								const isSelected =
									String( selectedTemplateId ) ===
									String( template.id );
								const systemPage = isSystemPages
									? getSystemPage( template )
									: null;
								const description =
									systemPage?.description ||
									getTemplateDisplayDescription( template );

								return (
									<li key={ template.id }>
										<button
											aria-pressed={ isSelected }
											className="cnl-homepage-shows__option"
											onClick={ () =>
												selectTemplate( template.id )
											}
											type="button"
										>
											<Icon
												className="cnl-homepage-shows__icon"
												icon={
													systemPage?.icon ||
													getTemplateIcon( template )
												}
											/>
											<span className="cnl-homepage-shows__text">
												<span className="cnl-homepage-shows__label">
													{ systemPage?.title ||
														getTemplateTitle(
															template
														) }
												</span>
												{ description && (
													<span className="cnl-homepage-shows__description">
														{ description }
													</span>
												) }
											</span>
											{ isSelected && (
												<Icon
													className="cnl-homepage-shows__check"
													icon={ checkIcon }
													size={ 20 }
												/>
											) }
										</button>
									</li>
								);
							} ) }
						</ul>
					) }
					{ ! isLoading && templates.length === 0 && templateEmpty }
				</div>
			) : (
				contentList
			) }
			{ showTemplates && templates.length > 0 && (
				<p className="routes-post-list__template-footer">
					{ createInterpolateElement(
						isSystemPages
							? __(
									'For more advanced control <a>view all layouts</a>'
								)
							: sprintf(
									/* translators: %s: post type singular label, like "Post". */
									__(
										'For more advanced control <a>view all %s layouts</a>'
									),
									type.singular || type.name
								),
						{
							a: (
								<Button
									onClick={ () =>
										navigate( { to: '/templates' } )
									}
									variant="link"
								/>
							),
						}
					) }
				</p>
			) }
			{ isPickingPostKind && (
				<PostKindPicker
					isFocusedOpen={ workspace.writeInFocus }
					onClose={ () => setIsPickingPostKind( false ) }
				/>
			) }
			{ addingPage && type.name === 'page' && (
				<AddPageFlow
					mainMenu={ mainMenu }
					menuPlacement={ addingPage.menuPlacement }
					onClose={ () => setAddingPage( null ) }
					templates={ templates }
				/>
			) }
			{ menuItemAdder.modal }
		</Page>
	);
}

export const stage = withUiTheme( Stage );
// A content type's own address and its lists had a module each.
export const canvas = withScreenKey(
	withCanvasRecovery( withUiTheme( Canvas ) ),
	() => ( /\/list\//.test( getCurrentEditorPath() ) ? 'list' : 'type' )
);
