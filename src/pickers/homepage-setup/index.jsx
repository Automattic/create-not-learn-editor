/**
 * Set up the homepage the way a workspace expects: a page of its own with
 * the posts on another, or the latest posts first.
 *
 * A guided dialog, one step per screen. Each step says what it does, whether
 * it's needed and why people usually do it, with the sensible choice already
 * made, so most people only press Continue. Finishing saves straight away
 * (`apply.js`), rather than waiting for Save with the rest.
 *
 * Opened from the notice on Home (`src/routes/home/homepage-notice.jsx`).
 * Imported package by package, like the other pickers, so the chat could
 * offer it too.
 */

/**
 * WordPress dependencies
 */
import {
	Button,
	CheckboxControl,
	ExternalLink,
	Icon,
	Modal,
	SelectControl,
	TextControl,
	VisuallyHidden,
} from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import {
	createInterpolateElement,
	useId,
	useRef,
	useState,
} from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { home as homeIcon, page as pageIcon } from '@wordpress/icons';
import { __, sprintf } from '@wordpress/i18n';
import { Badge, Notice, Stack, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { getMenuBlocks } from '../../routes/content/pages/menu-items';
import { settings } from '../../settings';
import { applyHomepageSetup } from './apply';
import { getHomepageSetupPlan } from './plan';

// The same pages, in the same order, as the Pages screen asks for, so they
// come from the same request.
const PAGES_QUERY = {
	context: 'edit',
	order: 'asc',
	orderby: 'menu_order',
	per_page: 100,
	status: 'publish,draft,pending,private,future',
	_fields: 'id,title,status,parent,menu_order,link,modified,slug,template',
};
const NEW_PAGE = 'new';

/**
 * A page's title as plain text.
 *
 * @param {Object} page Page record.
 * @return {string} Title.
 */
function getTitle( page ) {
	const title = page?.title?.raw ?? page?.title?.rendered ?? page?.title;

	return decodeEntities( typeof title === 'string' ? title : '' ) || '';
}

/**
 * A page's title to show, with a stand-in for an untitled one.
 *
 * @param {Object} page Page record.
 * @return {string} Title.
 */
function getLabel( page ) {
	return getTitle( page ) || __( '(no title)' );
}

/**
 * What the site is like now, for the plan.
 *
 * @param {?number} menuId The menu in the site header.
 * @return {Object} `{ isLoading, site, pages, menu }`.
 */
function useSiteNow( menuId ) {
	return useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const site = store.getEntityRecord( 'root', 'site' );
			const pages = store.getEntityRecords(
				'postType',
				'page',
				PAGES_QUERY
			);
			const menu = menuId
				? store.getEntityRecord( 'postType', 'wp_navigation', menuId )
				: null;
			const isLoading = ! site || ! pages || ( !! menuId && ! menu );

			return {
				isLoading,
				menu: menu && {
					blocks: getMenuBlocks(
						menu.content?.raw ?? menu.content ?? ''
					),
					id: menu.id,
					title: decodeEntities(
						menu.title?.raw ?? menu.title?.rendered ?? ''
					),
				},
				pages,
				site,
			};
		},
		[ menuId ]
	);
}

/**
 * An old homepage or posts page, with what the person chose for it.
 *
 * @param {?Object} old    `{ page, isInMenu, leaveMenu, toTrash }`.
 * @param {Object}  chosen `{ leaveMenu, toTrash }`, as changed.
 * @return {?Object} The page's plan.
 */
function withOldPageChoices( old, chosen = {} ) {
	if ( ! old ) {
		return old;
	}

	const toTrash = chosen.toTrash ?? old.toTrash;

	return {
		...old,
		// A page in the trash can't stay in the menu.
		leaveMenu: toTrash || ( chosen.leaveMenu ?? old.leaveMenu ),
		toTrash,
	};
}

/**
 * The plan, with whatever the person changed along the way.
 *
 * @param {Object} plan    Result of `getHomepageSetupPlan`.
 * @param {Object} choices What was changed.
 * @param {Array}  pages   Every page.
 * @return {Object} The plan to carry out.
 */
function withChoices( plan, choices, pages ) {
	if ( plan.to === 'posts' ) {
		return {
			...plan,
			oldHomepage: withOldPageChoices(
				plan.oldHomepage,
				choices.oldHomepage
			),
			oldPostsPage: withOldPageChoices(
				plan.oldPostsPage,
				choices.oldPostsPage
			),
		};
	}

	let homepage = plan.homepage.page;

	if ( choices.homepageId === NEW_PAGE ) {
		homepage = null;
	} else if ( choices.homepageId ) {
		homepage =
			pages.find(
				( page ) => String( page.id ) === String( choices.homepageId )
			) || homepage;
	}

	const postsPage =
		plan.posts.page && plan.posts.page.id === homepage?.id
			? null
			: plan.posts.page;
	const typedTitle = ( choices.postsTitle ?? '' ).trim();

	return {
		...plan,
		homepage: { ...plan.homepage, page: homepage },
		posts: {
			...plan.posts,
			isOn: choices.postsOn ?? plan.posts.isOn,
			newTitle: typedTitle || plan.posts.newTitle,
			page: postsPage,
		},
		useMenu: choices.useMenu ?? plan.useMenu,
	};
}

// WordPress's own guides, for anyone who wants to read more. Never needed
// to finish.
const DOCS = {
	menus: 'https://wordpress.org/documentation/article/navigation-block/',
	reading:
		'https://wordpress.org/documentation/article/settings-reading-screen/',
	staticHomepage:
		'https://wordpress.org/documentation/article/create-a-static-front-page/',
};

/**
 * A quiet link to WordPress's own guide on a step, opening in a new tab.
 *
 * @param {Object}  props
 * @param {string}  props.href     The guide.
 * @param {Element} props.children The link's words.
 * @return {Element} The link.
 */
function DocLink( { href, children } ) {
	return (
		<Text className="cnl-homepage-setup__doc" variant="body-sm">
			<ExternalLink href={ href }>{ children }</ExternalLink>
		</Text>
	);
}

/**
 * A step's heading, with whether it's needed.
 *
 * @param {Object}  props
 * @param {string}  props.title      Heading.
 * @param {boolean} props.isOptional Whether the step can be skipped.
 * @return {Element} The heading.
 */
function StepHeading( { title, isOptional } ) {
	return (
		<Stack align="center" direction="row" gap="sm">
			<Text render={ <h2 /> } variant="heading-md">
				{ title }
			</Text>
			{ isOptional === undefined ? null : (
				<Badge intent={ isOptional ? 'none' : 'informational' }>
					{ isOptional ? __( 'Optional' ) : __( 'Needed' ) }
				</Badge>
			) }
		</Stack>
	);
}

/**
 * Plain text, as a paragraph.
 *
 * @param {Object}  props
 * @param {Element} props.children Text.
 * @return {Element} The paragraph.
 */
function Para( { children } ) {
	return (
		<Text className="cnl-homepage-setup__text" render={ <p /> }>
			{ children }
		</Text>
	);
}

/**
 * The page the homepage will be, as a small card: a page icon, its name and
 * the address it will have, which is the site's own, in full.
 *
 * @param {Object}  props
 * @param {string}  props.title Page title.
 * @param {?Object} props.badge `{ label, intent }`, said beside the name.
 * @param {Element} props.note  Said under the card.
 * @return {Element} The card.
 */
function HomepageCard( { title, badge, note } ) {
	return (
		<>
			<div className="cnl-homepage-setup__page-card">
				<Icon icon={ pageIcon } />
				<Stack direction="column" gap="xs">
					<Stack align="center" direction="row" gap="sm">
						<Text variant="heading-md">{ title }</Text>
						{ badge && (
							<Badge intent={ badge.intent }>
								{ badge.label }
							</Badge>
						) }
					</Stack>
					<Text
						className="cnl-homepage-setup__page-address"
						variant="body-sm"
					>
						{ settings.homeUrl }
					</Text>
				</Stack>
			</div>
			{ note && <Para>{ note }</Para> }
		</>
	);
}

function HomepageStep( { plan, pages, choices, setChoices } ) {
	const [ isPicking, setIsPicking ] = useState( false );
	const page = plan.homepage.page;

	return (
		<>
			<StepHeading
				isOptional={ false }
				title={ __( 'Choose your homepage' ) }
			/>
			<Para>
				{ __(
					'This is the page visitors land on first. Many websites open on a page that says who they are and what they do, with posts on their own pages (e.g. /blog).'
				) }
			</Para>
			<Para>
				{ createInterpolateElement(
					page
						? __(
								'WordPress will set the following page as your homepage. You can edit it later under <home /> in the sidebar.'
							)
						: __(
								'WordPress will create the following page for you and set it as your homepage. You can edit it later under <home /> in the sidebar.'
							),
					{ home: <SidebarHome /> }
				) }
			</Para>
			{ page ? (
				<HomepageCard
					badge={
						page.status !== 'publish' && {
							intent: 'draft',
							label: __( 'Not published yet' ),
						}
					}
					note={
						page.status !== 'publish' &&
						__(
							'It will be published, as visitors need to see it.'
						)
					}
					title={ getLabel( page ) }
				/>
			) : (
				<HomepageCard
					badge={ { intent: 'none', label: __( 'New page' ) } }
					title={ plan.homepage.newTitle }
				/>
			) }
			{ isPicking ? (
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Page for your homepage' ) }
					onChange={ ( value ) =>
						setChoices( { ...choices, homepageId: value } )
					}
					options={ [
						{
							label: sprintf(
								/* translators: %s: page title, like Home. */
								__( 'A new page called “%s”' ),
								plan.homepage.newTitle
							),
							value: NEW_PAGE,
						},
						...pages.map( ( item ) => ( {
							label:
								item.status === 'publish'
									? getLabel( item )
									: sprintf(
											/* translators: %s: page title. */
											__( '%s (not published yet)' ),
											getLabel( item )
										),
							value: String( item.id ),
						} ) ),
					] }
					value={ page ? String( page.id ) : NEW_PAGE }
				/>
			) : (
				<div>
					<Button
						onClick={ () => setIsPicking( true ) }
						variant="link"
					>
						{ page
							? __( 'Use a different page' )
							: __( 'Use a page you already have' ) }
					</Button>
				</div>
			) }
			<DocLink href={ DOCS.staticHomepage }>
				{ __( 'Learn more about homepages' ) }
			</DocLink>
		</>
	);
}

/**
 * One choice in a group of radio buttons, built as core's RadioControl
 * builds its options, so it looks the same, with room under its label for
 * what goes with it.
 *
 * @param {Object}   props
 * @param {string}   props.id       The input's ID.
 * @param {string}   props.name     The group's name.
 * @param {boolean}  props.checked  Whether it's chosen.
 * @param {string}   props.label    Its label.
 * @param {Function} props.onChange Called when it's chosen.
 * @param {Element}  props.children Shown under its label.
 * @return {Element} The choice.
 */
function RadioOption( { id, name, checked, label, onChange, children } ) {
	return (
		<div className="components-radio-control__option">
			<input
				checked={ checked }
				className="components-radio-control__input"
				id={ id }
				name={ name }
				onChange={ onChange }
				type="radio"
			/>
			<label className="components-radio-control__label" htmlFor={ id }>
				{ label }
			</label>
			{ children && (
				<div className="cnl-homepage-setup__option-detail">
					{ children }
				</div>
			) }
		</div>
	);
}

function PostsPageStep( { plan, choices, setChoices } ) {
	const { isOn, page, newTitle } = plan.posts;
	const id = `cnl-homepage-setup-posts-${ useId() }`;
	const choose = ( value ) => setChoices( { ...choices, postsOn: value } );

	return (
		<>
			<StepHeading
				isOptional
				title={ __( 'Where will you put your posts?' ) }
			/>
			<Para>
				{ __(
					'Your posts move off the homepage, so they need a page of their own, or visitors can’t find them.'
				) }
			</Para>
			<fieldset className="components-radio-control cnl-homepage-setup__choices">
				<VisuallyHidden as="legend">
					{ __( 'Your posts' ) }
				</VisuallyHidden>
				<RadioOption
					checked={ isOn }
					id={ `${ id }-page` }
					label={
						page
							? sprintf(
									/* translators: %s: page title. */
									__( 'Keep them on “%s”' ),
									getLabel( page )
								)
							: __( 'Create a page for posts' )
					}
					name={ id }
					onChange={ () => choose( true ) }
				>
					{ isOn && ! page && (
						<TextControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							help={ __( 'You can rename it later.' ) }
							hideLabelFromVision
							label={ __( 'Page name' ) }
							onChange={ ( value ) =>
								setChoices( { ...choices, postsTitle: value } )
							}
							value={ choices.postsTitle ?? newTitle }
						/>
					) }
				</RadioOption>
				<RadioOption
					checked={ ! isOn }
					id={ `${ id }-none` }
					label={ __( 'I don’t want a blog' ) }
					name={ id }
					onChange={ () => choose( false ) }
				>
					<Text
						className="cnl-homepage-setup__option-help"
						variant="body-sm"
					>
						{ __(
							'Your posts stay on your site, but no page lists them. You can change this later.'
						) }
					</Text>
				</RadioOption>
			</fieldset>
			<DocLink href={ DOCS.staticHomepage }>
				{ __( 'Learn more about a page for your posts' ) }
			</DocLink>
		</>
	);
}

function MenuStep( { plan, menuTitle, choices, setChoices } ) {
	return (
		<>
			<StepHeading isOptional title={ __( 'Add them to your menu' ) } />
			<Para>
				{ __(
					'Your menu lists its links by hand, so new pages don’t join it by themselves. Adding them helps visitors find their way home, and to your posts.'
				) }
			</Para>
			<CheckboxControl
				__nextHasNoMarginBottom
				checked={ plan.useMenu }
				label={ sprintf(
					/* translators: %s: menu name. */
					__( 'Add them to “%s”' ),
					menuTitle || __( 'your menu' )
				) }
				onChange={ ( value ) =>
					setChoices( { ...choices, useMenu: value } )
				}
			/>
			<DocLink href={ DOCS.menus }>
				{ __( 'Learn more about menus' ) }
			</DocLink>
		</>
	);
}

function LatestPostsStep() {
	return (
		<>
			<StepHeading
				isOptional={ false }
				title={ __( 'Show your latest posts first' ) }
			/>
			<Para>
				{ __(
					'Your homepage will list your newest posts, newest first, so visitors see what you’ve just written as soon as they arrive. Most blogs open this way.'
				) }
			</Para>
			<DocLink href={ DOCS.reading }>
				{ __( 'Learn more about what your homepage shows' ) }
			</DocLink>
		</>
	);
}

/**
 * A page that's done its job, the old homepage or the old posts page: keep
 * it as a page of its own, or delete it, and whether it stays in the menu.
 *
 * @param {Object}   props
 * @param {string}   props.name       Which page: `oldHomepage` or
 *                                    `oldPostsPage`.
 * @param {string}   props.heading    The step's heading.
 * @param {string}   props.intro      Why it's being asked.
 * @param {string}   props.keepHelp   What keeping it means.
 * @param {string}   props.menuHelp   Why it should leave the menu.
 * @param {Object}   props.plan       The plan.
 * @param {Object}   props.choices    What's been chosen.
 * @param {Function} props.setChoices Changes it.
 * @return {Element} The step.
 */
function OldPageStep( {
	name,
	heading,
	intro,
	keepHelp,
	menuHelp,
	plan,
	choices,
	setChoices,
} ) {
	const { page, isInMenu, leaveMenu, toTrash } = plan[ name ];
	const id = `cnl-homepage-setup-${ name }-${ useId() }`;
	const title = getLabel( page );
	const choose = ( change ) =>
		setChoices( {
			...choices,
			[ name ]: { ...choices[ name ], ...change },
		} );

	return (
		<>
			<StepHeading isOptional title={ heading } />
			<Para>{ intro }</Para>
			<fieldset className="components-radio-control cnl-homepage-setup__choices">
				<VisuallyHidden as="legend">{ heading }</VisuallyHidden>
				<RadioOption
					checked={ ! toTrash }
					id={ `${ id }-keep` }
					label={ sprintf(
						/* translators: %s: page title. */
						__( 'Keep my old “%s” page' ),
						title
					) }
					name={ id }
					onChange={ () => choose( { toTrash: false } ) }
				>
					<Text
						className="cnl-homepage-setup__option-help"
						variant="body-sm"
					>
						{ keepHelp }
					</Text>
				</RadioOption>
				<RadioOption
					checked={ toTrash }
					id={ `${ id }-trash` }
					label={ sprintf(
						/* translators: %s: page title. */
						__( 'Delete my old “%s” page' ),
						title
					) }
					name={ id }
					onChange={ () => choose( { toTrash: true } ) }
				>
					<Text
						className="cnl-homepage-setup__option-help"
						variant="body-sm"
					>
						{ __(
							'It goes to the trash, so you can bring it back for a while.'
						) }
					</Text>
				</RadioOption>
			</fieldset>
			{ isInMenu && (
				<CheckboxControl
					__nextHasNoMarginBottom
					checked={ leaveMenu }
					disabled={ toTrash }
					help={
						toTrash
							? __( 'A deleted page leaves your menu too.' )
							: menuHelp
					}
					label={ __( 'Remove it from my menu' ) }
					onChange={ ( value ) => choose( { leaveMenu: value } ) }
				/>
			) }
		</>
	);
}

function OldHomepageStep( props ) {
	const title = getLabel( props.plan.oldHomepage.page );

	return (
		<OldPageStep
			{ ...props }
			heading={ __( 'Your old homepage' ) }
			intro={ sprintf(
				/* translators: %s: page title. */
				__(
					'“%s” won’t be your homepage any more. Keep it as a page of its own, or delete it.'
				),
				title
			) }
			keepHelp={ __( 'You can still find it under Pages.' ) }
			menuHelp={ __(
				'Your menu already takes visitors home, so a second link for this page would be confusing.'
			) }
			name="oldHomepage"
		/>
	);
}

function OldPostsPageStep( props ) {
	const title = getLabel( props.plan.oldPostsPage.page );

	return (
		<OldPageStep
			{ ...props }
			heading={ __( 'Your old posts page' ) }
			intro={ sprintf(
				/* translators: %s: page title. */
				__(
					'Your posts will be on your homepage now, so “%s” won’t list them any more. Keep it as a page of its own, or delete it.'
				),
				title
			) }
			keepHelp={ __(
				'You can still find it under Pages, but it won’t list your posts.'
			) }
			menuHelp={ __(
				'Your homepage lists your posts now, so a link to this page would lead visitors to the same thing.'
			) }
			name="oldPostsPage"
		/>
	);
}

/**
 * What happens to an old homepage or posts page, in plain words.
 *
 * @param {?Object} old The page's plan.
 * @return {?string} The change, if any.
 */
function getOldPageChange( old ) {
	if ( old?.toTrash ) {
		return sprintf(
			/* translators: %s: page title. */
			__( '“%s” will go to the trash.' ),
			getLabel( old.page )
		);
	}

	if ( old?.leaveMenu ) {
		return sprintf(
			/* translators: %s: page title. */
			__( '“%s” will leave your menu.' ),
			getLabel( old.page )
		);
	}

	return null;
}

/**
 * What finishing will do, in plain words.
 *
 * @param {Object} plan The plan to carry out.
 * @return {string[]} One line per change.
 */
function getChanges( plan ) {
	if ( plan.to === 'posts' ) {
		return [
			__( 'Your homepage will list your latest posts.' ),
			...[ plan.oldHomepage, plan.oldPostsPage ].map( getOldPageChange ),
		].filter( Boolean );
	}

	const postsTitle = plan.posts.page
		? getLabel( plan.posts.page )
		: plan.posts.newTitle;

	return [
		plan.homepage.page
			? sprintf(
					/* translators: %s: page title. */
					__( 'Your homepage will show “%s”.' ),
					getLabel( plan.homepage.page )
				)
			: sprintf(
					/* translators: %s: page title, like Home. */
					__( 'A new page, “%s”, will become your homepage.' ),
					plan.homepage.newTitle
				),
		plan.posts.isOn &&
			sprintf(
				/* translators: %s: page title, like Blog. */
				__( 'Your posts will be listed on “%s”.' ),
				postsTitle
			),
		! plan.posts.isOn &&
			__( 'No page will list your posts. You can change this later.' ),
		plan.useMenu && __( 'Both pages will join your menu.' ),
	].filter( Boolean );
}

/**
 * "Home" as the sidebar shows it, its icon on black, so it's clear where to
 * go to change the homepage again.
 *
 * @return {Element} The sidebar's Home, inline.
 */
function SidebarHome() {
	return (
		<span className="cnl-homepage-setup__sidebar-home">
			<span className="cnl-homepage-setup__sidebar-home-icon">
				<Icon icon={ homeIcon } size={ 16 } />
			</span>
			{ __( 'Home' ) }
		</span>
	);
}

function ReviewStep( { plan } ) {
	return (
		<>
			<StepHeading title={ __( 'Ready to switch?' ) } />
			<Para>{ __( 'This is what will change:' ) }</Para>
			<ul className="cnl-homepage-setup__changes">
				{ getChanges( plan ).map( ( change ) => (
					<li key={ change }>{ change }</li>
				) ) }
			</ul>
			<Para>
				{ createInterpolateElement(
					__(
						'It’s saved as soon as you finish. You can change it whenever you like from <home /> in the sidebar.'
					),
					{ home: <SidebarHome /> }
				) }
			</Para>
		</>
	);
}

/**
 * What the homepage shows, asked first when the dialog is opened to change
 * the homepage rather than to match a workspace.
 *
 * @param {Object}   props
 * @param {string}   props.direction    `page` or `posts`, as chosen.
 * @param {Function} props.setDirection Changes it.
 * @return {Element} The step.
 */
function ShowsStep( { direction, setDirection } ) {
	const id = `cnl-homepage-setup-shows-${ useId() }`;

	return (
		<>
			<StepHeading
				isOptional={ false }
				title={ __( 'What should visitors see first?' ) }
			/>
			<fieldset className="components-radio-control cnl-homepage-setup__choices">
				<VisuallyHidden as="legend">
					{ __( 'Your homepage shows' ) }
				</VisuallyHidden>
				<RadioOption
					checked={ direction === 'page' }
					id={ `${ id }-page` }
					label={ __( 'A page' ) }
					name={ id }
					onChange={ () => setDirection( 'page' ) }
				>
					<Text
						className="cnl-homepage-setup__option-help"
						variant="body-sm"
					>
						{ __(
							'A page of its own, with your posts on another page.'
						) }
					</Text>
				</RadioOption>
				<RadioOption
					checked={ direction === 'posts' }
					id={ `${ id }-posts` }
					label={ __( 'Your latest posts' ) }
					name={ id }
					onChange={ () => setDirection( 'posts' ) }
				>
					<Text
						className="cnl-homepage-setup__option-help"
						variant="body-sm"
					>
						{ __( 'Your newest posts, newest first.' ) }
					</Text>
				</RadioOption>
			</fieldset>
			<DocLink href={ DOCS.reading }>
				{ __( 'Learn more about what your homepage shows' ) }
			</DocLink>
		</>
	);
}

const STEPS = {
	homepage: HomepageStep,
	menu: MenuStep,
	oldHomepage: OldHomepageStep,
	oldPostsPage: OldPostsPageStep,
	posts: PostsPageStep,
	review: ReviewStep,
	shows: ShowsStep,
};

/**
 * @param {Object}   props
 * @param {string}   [props.expects] `page` or `posts`, what the workspace
 *                                   expects the homepage to show. Without
 *                                   it, the first step asks.
 * @param {?number}  props.menuId    The menu in the site header, if any.
 * @param {Function} props.onClose   Called when the dialog closes unfinished.
 * @param {Function} props.onDone    Called with the plan carried out, and the
 *                                   pages used, once it's saved.
 * @return {Element} The dialog.
 */
export default function HomepageSetup( { expects, menuId, onClose, onDone } ) {
	const siteNow = useSiteNow( menuId );
	const [ choices, setChoices ] = useState( {} );
	const [ direction, setDirection ] = useState( null );
	const [ stepIndex, setStepIndex ] = useState( 0 );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ error, setError ] = useState( '' );
	const pages = siteNow.pages;
	const isChoosing = ! expects;
	// Worked out once, both ways, from the site as it was when the dialog
	// opened. Finishing changes the site, and the steps mustn't change
	// under it.
	const planRef = useRef( null );

	if ( ! planRef.current && ! siteNow.isLoading ) {
		const getPlan = ( to ) =>
			getHomepageSetupPlan( {
				expects: to,
				getTitle,
				homeUrl: settings.homeUrl,
				labels: { home: __( 'Home' ), posts: __( 'Blog' ) },
				menu: siteNow.menu,
				pages,
				site: siteNow.site,
			} );

		planRef.current = {
			// What the homepage shows now, which the first step starts on.
			current:
				siteNow.site.show_on_front === 'page' &&
				Number( siteNow.site.page_on_front )
					? 'page'
					: 'posts',
			page: getPlan( 'page' ),
			posts: getPlan( 'posts' ),
		};
	}

	const to = expects || direction || planRef.current?.current;
	const basePlan = planRef.current?.[ to ];
	const plan = basePlan && withChoices( basePlan, choices, pages );
	// The same wherever it's opened from, whichever way it's going.
	const title = __( 'Configure site homepage' );

	if ( ! plan ) {
		return (
			<Modal
				className="cnl-homepage-setup"
				onRequestClose={ onClose }
				size="medium"
				title={ title }
			>
				<Para>{ __( 'Looking at your site…' ) }</Para>
			</Modal>
		);
	}

	const steps = isChoosing ? [ 'shows', ...plan.steps ] : plan.steps;
	const stepId = steps[ stepIndex ];
	const StepBody =
		stepId === 'posts' && plan.to === 'posts'
			? LatestPostsStep
			: STEPS[ stepId ];
	const isLast = stepIndex === steps.length - 1;

	const finish = async () => {
		setIsSaving( true );
		setError( '' );

		try {
			const result = await applyHomepageSetup( plan, {
				homeLabel: __( 'Home' ),
			} );

			onDone( { plan, ...result } );
		} catch ( failure ) {
			setError(
				failure?.message ||
					__(
						'Your homepage couldn’t be changed, so it’s as it was. Check your connection, then try again.'
					)
			);
			setIsSaving( false );
		}
	};

	return (
		<Modal
			className="cnl-homepage-setup"
			focusOnMount="firstContentElement"
			onRequestClose={ isSaving ? () => {} : onClose }
			size="medium"
			title={ title }
		>
			<Stack direction="column" gap="md">
				<StepBody
					choices={ choices }
					direction={ to }
					setDirection={ setDirection }
					menuTitle={ siteNow.menu?.title }
					pages={ pages }
					plan={ plan }
					setChoices={ setChoices }
				/>
				{ error && (
					<Notice.Root intent="error">
						<Notice.Description>{ error }</Notice.Description>
					</Notice.Root>
				) }
			</Stack>
			<div className="cnl-homepage-setup__footer">
				<Text className="cnl-homepage-setup__count" variant="body-sm">
					{ sprintf(
						/* translators: 1: this step's number. 2: how many steps. */
						__( 'Step %1$d of %2$d' ),
						stepIndex + 1,
						steps.length
					) }
				</Text>
				<div className="cnl-homepage-setup__actions">
					{ stepIndex > 0 && (
						<Button
							__next40pxDefaultSize
							disabled={ isSaving }
							onClick={ () => setStepIndex( stepIndex - 1 ) }
							variant="tertiary"
						>
							{ __( 'Back' ) }
						</Button>
					) }
					<Button
						__next40pxDefaultSize
						accessibleWhenDisabled
						disabled={ isSaving }
						isBusy={ isSaving }
						onClick={ () =>
							isLast ? finish() : setStepIndex( stepIndex + 1 )
						}
						variant="primary"
					>
						{ isLast ? __( 'Finish' ) : __( 'Continue' ) }
					</Button>
				</div>
			</div>
		</Modal>
	);
}
