/**
 * Set up the homepage the way a workspace expects: a page of its own with
 * the posts on another, or the latest posts first.
 *
 * A guided dialog, one question per screen, each answered by picking one of
 * a few choices, the sensible one already picked, so most people only press
 * Continue. Steps with nothing to choose aren't shown. The last button says
 * what it does, and saves straight away (`apply.js`), rather than waiting for
 * Save with the rest.
 *
 * Opened from the notice on Home (`src/routes/home/homepage-notice.jsx`).
 * Imported package by package, like the other pickers, so it can be used
 * from app init without loading the editor.
 */

/**
 * WordPress dependencies
 */
import {
	Button,
	ExternalLink,
	Modal,
	SelectControl,
	TextControl,
	VisuallyHidden,
} from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useId, useRef, useState } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { __, sprintf } from '@wordpress/i18n';
import { Badge, Notice, Stack, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { getMenuBlocks } from '../../routes/content/pages/menu-items';
import { settings } from '../../settings';
import { applyHomepageSetup } from './apply';
import { getHomepageSetupPlan, isPageInMenu } from './plan';

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
 * Every page but the one offered as the homepage, for anyone who wants
 * another.
 *
 * @param {Object} plan  Result of `getHomepageSetupPlan`.
 * @param {Array}  pages Every page.
 * @return {Object[]} The pages.
 */
function getOtherPages( plan, pages ) {
	const offered = plan.homepage.page?.id;
	const others = pages.filter(
		( page ) => ! offered || Number( page.id ) !== Number( offered )
	);
	const isPublished = ( page ) => page.status === 'publish';

	// Published pages first, as one of those is the likely choice.
	return [
		...others.filter( isPublished ),
		...others.filter( ( page ) => ! isPublished( page ) ),
	];
}

/**
 * The page chosen as the homepage from the other pages: the one picked, or
 * else the first.
 *
 * @param {Object}  plan  Result of `getHomepageSetupPlan`.
 * @param {Array}   pages Every page.
 * @param {?string} id    The page picked, if any.
 * @return {?Object} The page.
 */
function getOtherHomepage( plan, pages, id ) {
	const others = getOtherPages( plan, pages );

	return (
		others.find( ( page ) => String( page.id ) === String( id ) ) ||
		others[ 0 ] ||
		null
	);
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

	const homepage = choices.isOtherHomepage
		? getOtherHomepage( plan, pages, choices.homepageId )
		: plan.homepage.page;
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

// WordPress's own guide to homepages, for anyone who wants to read more.
// Never needed to finish.
const HOMEPAGE_DOCS =
	'https://wordpress.org/documentation/article/create-a-static-front-page/';

/**
 * A step's question, and a line on why it's asked.
 *
 * @param {Object} props
 * @param {string} props.title       The question.
 * @param {string} props.description Why it's asked, in a line.
 * @return {Element} The heading.
 */
function StepHeading( { title, description } ) {
	return (
		<Stack direction="column" gap="xs">
			<Text render={ <h2 /> } variant="heading-lg">
				{ title }
			</Text>
			{ description && (
				<Text
					className="cnl-homepage-setup__description"
					render={ <p /> }
				>
					{ description }
				</Text>
			) }
		</Stack>
	);
}

/**
 * One choice in a group of radio buttons, built as core's RadioControl
 * builds its options, so it looks the same, with room under its label for
 * a line of help and anything that goes with it. The choice most people
 * make says so beside its label, so nobody has to know it already.
 *
 * @param {Object}   props
 * @param {string}   props.id            The input's ID.
 * @param {string}   props.name          The group's name.
 * @param {boolean}  props.checked       Whether it's chosen.
 * @param {string}   props.label         Its label.
 * @param {string}   props.help          A line under the label.
 * @param {boolean}  props.isRecommended Whether it's the usual choice.
 * @param {Function} props.onChange      Called when it's chosen.
 * @param {Element}  props.children      Shown under its label once chosen.
 * @return {Element} The choice.
 */
function RadioOption( {
	id,
	name,
	checked,
	label,
	help,
	isRecommended,
	onChange,
	children,
} ) {
	return (
		<div className="components-radio-control__option">
			<input
				aria-describedby={ help ? `${ id }-help` : undefined }
				checked={ checked }
				className="components-radio-control__input"
				id={ id }
				name={ name }
				onChange={ onChange }
				type="radio"
			/>
			<label
				className="components-radio-control__label cnl-homepage-setup__option-label"
				htmlFor={ id }
			>
				{ label }
				{ isRecommended && (
					<Badge intent="informational">
						{ __( 'Recommended' ) }
					</Badge>
				) }
			</label>
			{ ( help || ( checked && children ) ) && (
				<div className="cnl-homepage-setup__option-detail">
					{ help && (
						<Text
							className="cnl-homepage-setup__option-help"
							id={ `${ id }-help` }
							variant="body-sm"
						>
							{ help }
						</Text>
					) }
					{ checked && children }
				</div>
			) }
		</div>
	);
}

/**
 * The radio buttons a step's question is answered with.
 *
 * @param {Object}  props
 * @param {string}  props.legend   What's being chosen, for screen readers.
 * @param {Element} props.children The choices.
 * @return {Element} The group.
 */
function Choices( { legend, children } ) {
	return (
		<fieldset className="components-radio-control cnl-homepage-setup__choices">
			<VisuallyHidden as="legend">{ legend }</VisuallyHidden>
			{ children }
		</fieldset>
	);
}

/**
 * How a page is listed among the choices: its title, and whether it's
 * published yet.
 *
 * @param {Object} page Page record.
 * @return {string} The label.
 */
function getPageOptionLabel( page ) {
	return page.status === 'publish'
		? getLabel( page )
		: sprintf(
				/* translators: %s: page title. */
				__( '%s (not published yet)' ),
				getLabel( page )
			);
}

function HomepageStep( { defaults, plan, pages, choices, setChoices } ) {
	const id = `cnl-homepage-setup-homepage-${ useId() }`;
	const offered = defaults.homepage.page;
	const others = getOtherPages( defaults, pages );
	const chosen = plan.homepage.page;
	const isOther = !! choices.isOtherHomepage && others.length > 0;
	const choose = ( change ) => setChoices( { ...choices, ...change } );
	const isNowPosts = defaults.site?.show_on_front !== 'page';
	const publishHelp = __( 'Not published yet. It will be published.' );
	let offeredHelp = null;

	if ( ! offered ) {
		offeredHelp = __( 'A blank page, ready for you to fill in.' );
	} else if ( offered.status !== 'publish' ) {
		offeredHelp = publishHelp;
	} else if (
		! isNowPosts &&
		Number( offered.id ) === Number( defaults.site?.page_on_front )
	) {
		offeredHelp = __( 'Your homepage now.' );
	}

	return (
		<>
			<StepHeading
				description={
					isNowPosts
						? __(
								'Visitors will land on this page instead of a list of your posts.'
							)
						: __( 'It’s the first page visitors see.' )
				}
				title={ __( 'Which page should be your homepage?' ) }
			/>
			<Choices legend={ __( 'Your homepage' ) }>
				<RadioOption
					checked={ ! isOther }
					help={ offeredHelp }
					id={ `${ id }-offered` }
					isRecommended={ others.length > 0 }
					label={
						offered
							? sprintf(
									/* translators: %s: page title, like Home. */
									__( '“%s”' ),
									getLabel( offered )
								)
							: sprintf(
									/* translators: %s: page title, like Home. */
									__( 'A new page called “%s”' ),
									defaults.homepage.newTitle
								)
					}
					name={ id }
					onChange={ () => choose( { isOtherHomepage: false } ) }
				/>
				{ others.length > 0 && (
					<RadioOption
						checked={ isOther }
						id={ `${ id }-other` }
						label={
							offered
								? __( 'Another page' )
								: __( 'A page you already have' )
						}
						name={ id }
						onChange={ () => choose( { isOtherHomepage: true } ) }
					>
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							help={
								chosen && chosen.status !== 'publish'
									? publishHelp
									: undefined
							}
							hideLabelFromVision
							label={ __( 'Page for your homepage' ) }
							onChange={ ( value ) =>
								choose( { homepageId: value } )
							}
							options={ others.map( ( page ) => ( {
								label: getPageOptionLabel( page ),
								value: String( page.id ),
							} ) ) }
							value={ chosen ? String( chosen.id ) : '' }
						/>
					</RadioOption>
				) }
			</Choices>
			<Text className="cnl-homepage-setup__doc" variant="body-sm">
				<ExternalLink href={ HOMEPAGE_DOCS }>
					{ __( 'Learn more about homepages' ) }
				</ExternalLink>
			</Text>
		</>
	);
}

function PostsPageStep( { plan, choices, setChoices } ) {
	const { isOn, page, newTitle } = plan.posts;
	const id = `cnl-homepage-setup-posts-${ useId() }`;
	const choose = ( value ) => setChoices( { ...choices, postsOn: value } );

	return (
		<>
			<StepHeading
				description={ __(
					'Give them a page of their own, so visitors can still find them.'
				) }
				title={ __( 'Where should your posts go?' ) }
			/>
			<Choices legend={ __( 'Your posts' ) }>
				<RadioOption
					checked={ isOn }
					help={
						page
							? __( 'Where they are now.' )
							: __( 'What most websites do.' )
					}
					id={ `${ id }-page` }
					isRecommended
					label={
						page
							? sprintf(
									/* translators: %s: page title. */
									__( 'On “%s”' ),
									getLabel( page )
								)
							: __( 'On a new page' )
					}
					name={ id }
					onChange={ () => choose( true ) }
				>
					{ ! page && (
						<TextControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
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
					help={ __( 'You can add a page for them later.' ) }
					id={ `${ id }-none` }
					label={ __( 'I don’t want a blog' ) }
					name={ id }
					onChange={ () => choose( false ) }
				/>
			</Choices>
		</>
	);
}

/**
 * The links finishing would add to a menu of links: Home, when it has no
 * way home yet, and the page for the posts, when it isn't there already.
 *
 * @param {Object} plan The plan to carry out.
 * @return {string[]} The links' names.
 */
function getMenuAdditions( plan ) {
	if ( ! plan.menu || plan.menu.isAutomatic ) {
		return [];
	}

	const postsPage = plan.posts.page;

	return [
		! plan.menu.hasHomeLink && __( 'Home' ),
		plan.posts.isOn &&
			! ( postsPage && isPageInMenu( plan.menu, postsPage.id ) ) &&
			( postsPage ? getLabel( postsPage ) : plan.posts.newTitle ),
	].filter( Boolean );
}

function MenuStep( { plan, menuTitle, choices, setChoices } ) {
	const id = `cnl-homepage-setup-menu-${ useId() }`;
	const additions = getMenuAdditions( plan );
	const choose = ( value ) => setChoices( { ...choices, useMenu: value } );
	const menuName = menuTitle || __( 'your menu' );

	return (
		<>
			<StepHeading
				description={ __(
					'Your menu doesn’t pick up new pages by itself.'
				) }
				title={ __( 'Add them to your menu?' ) }
			/>
			<Choices legend={ __( 'Your menu' ) }>
				<RadioOption
					checked={ plan.useMenu }
					help={ __( 'So visitors can find them.' ) }
					id={ `${ id }-add` }
					isRecommended
					label={
						additions.length > 1
							? sprintf(
									/* translators: 1: page title, like Home. 2: page title, like Blog. 3: menu name. */
									__( 'Add “%1$s” and “%2$s” to “%3$s”' ),
									additions[ 0 ],
									additions[ 1 ],
									menuName
								)
							: sprintf(
									/* translators: 1: page title. 2: menu name. */
									__( 'Add “%1$s” to “%2$s”' ),
									additions[ 0 ],
									menuName
								)
					}
					name={ id }
					onChange={ () => choose( true ) }
				/>
				<RadioOption
					checked={ ! plan.useMenu }
					help={ __( 'You can add them from Menus later.' ) }
					id={ `${ id }-leave` }
					label={ __( 'Leave my menu as it is' ) }
					name={ id }
					onChange={ () => choose( false ) }
				/>
			</Choices>
		</>
	);
}

function LatestPostsStep() {
	return (
		<StepHeading
			description={ __(
				'Your homepage will list your newest posts, so visitors see what you’ve just written as soon as they arrive.'
			) }
			title={ __( 'Show your latest posts first' ) }
		/>
	);
}

/**
 * The old homepage and the old posts page, together: kept or deleted. Kept
 * ones leave the menu, as the homepage takes their place.
 *
 * @param {Object}   props
 * @param {Object}   props.plan       The plan.
 * @param {Object}   props.choices    What's been chosen.
 * @param {Function} props.setChoices Changes it.
 * @return {Element} The step.
 */
function OldPagesStep( { plan, choices, setChoices } ) {
	const id = `cnl-homepage-setup-old-pages-${ useId() }`;
	const olds = [ plan.oldHomepage, plan.oldPostsPage ].filter( Boolean );
	const titles = olds.map( ( old ) => getLabel( old.page ) );
	const toTrash = olds.some( ( old ) => old.toTrash );
	const isAnyInMenu = olds.some( ( old ) => old.isInMenu );
	const choose = ( value ) =>
		setChoices( {
			...choices,
			oldHomepage: { ...choices.oldHomepage, toTrash: value },
			oldPostsPage: { ...choices.oldPostsPage, toTrash: value },
		} );
	const isOne = titles.length === 1;

	return (
		<>
			<StepHeading
				description={
					isOne
						? sprintf(
								/* translators: %s: page title. */
								__(
									'Your homepage will list your latest posts, so “%s” isn’t needed for that any more.'
								),
								titles[ 0 ]
							)
						: sprintf(
								/* translators: 1: page title. 2: page title. */
								__(
									'Your homepage will list your latest posts, so “%1$s” and “%2$s” aren’t needed for that any more.'
								),
								titles[ 0 ],
								titles[ 1 ]
							)
				}
				title={
					isOne
						? __( 'Keep your old page?' )
						: __( 'Keep your old pages?' )
				}
			/>
			<Choices legend={ __( 'Your old pages' ) }>
				<RadioOption
					checked={ ! toTrash }
					help={
						isAnyInMenu
							? __(
									'Nothing is lost. You’ll find them under Pages, out of your menu.'
								)
							: __(
									'Nothing is lost. You’ll find them under Pages.'
								)
					}
					id={ `${ id }-keep` }
					isRecommended
					label={
						isOne
							? sprintf(
									/* translators: %s: page title. */
									__( 'Keep “%s”' ),
									titles[ 0 ]
								)
							: __( 'Keep them' )
					}
					name={ id }
					onChange={ () => choose( false ) }
				/>
				<RadioOption
					checked={ toTrash }
					help={ __(
						'They go to the trash, where you can restore them.'
					) }
					id={ `${ id }-trash` }
					label={
						isOne
							? sprintf(
									/* translators: %s: page title. */
									__( 'Delete “%s”' ),
									titles[ 0 ]
								)
							: __( 'Delete them' )
					}
					name={ id }
					onChange={ () => choose( true ) }
				/>
			</Choices>
		</>
	);
}

/**
 * What the homepage shows, asked first when the dialog is opened to change
 * the homepage rather than to match a workspace.
 *
 * @param {Object}   props
 * @param {string}   props.direction    `page` or `posts`, as chosen.
 * @param {string}   props.recommends   `page` or `posts`, what the
 *                                      workspace expects, if anything.
 * @param {Function} props.setDirection Changes it.
 * @return {Element} The step.
 */
function ShowsStep( { direction, recommends, setDirection } ) {
	const id = `cnl-homepage-setup-shows-${ useId() }`;

	return (
		<>
			<StepHeading
				description={ __( 'It’s the first thing they see.' ) }
				title={ __( 'What should visitors see first?' ) }
			/>
			<Choices legend={ __( 'Your homepage shows' ) }>
				<RadioOption
					checked={ direction === 'page' }
					help={ __(
						'Most websites open on a page that says who they are. Posts go on a page of their own.'
					) }
					id={ `${ id }-page` }
					isRecommended={ recommends === 'page' }
					label={ __( 'A page' ) }
					name={ id }
					onChange={ () => setDirection( 'page' ) }
				/>
				<RadioOption
					checked={ direction === 'posts' }
					help={ __(
						'Most blogs open on their newest posts, newest first.'
					) }
					id={ `${ id }-posts` }
					isRecommended={ recommends === 'posts' }
					label={ __( 'Your latest posts' ) }
					name={ id }
					onChange={ () => setDirection( 'posts' ) }
				/>
			</Choices>
		</>
	);
}

const STEPS = {
	homepage: HomepageStep,
	latest: LatestPostsStep,
	menu: MenuStep,
	oldPages: OldPagesStep,
	posts: PostsPageStep,
	shows: ShowsStep,
};

/**
 * The steps to show: the plan's, after the question of what the homepage
 * shows when the dialog asks it, and without any left with nothing to ask.
 *
 * @param {Object}  plan       The plan to carry out.
 * @param {boolean} isChoosing Whether the dialog asks what the homepage
 *                             shows.
 * @return {string[]} The steps.
 */
function getSteps( plan, isChoosing ) {
	const steps = plan.steps.filter( ( step ) => {
		// Choosing the latest posts already said what they'd do.
		if ( step === 'latest' ) {
			return ! isChoosing;
		}

		// Nothing to add when the menu already has both.
		if ( step === 'menu' ) {
			return getMenuAdditions( plan ).length > 0;
		}

		return true;
	} );

	return isChoosing ? [ 'shows', ...steps ] : steps;
}

/**
 * @param {Object}   props
 * @param {string}   [props.expects]    `page` or `posts`, what the workspace
 *                                      expects the homepage to show. Without
 *                                      it, the first step asks.
 * @param {?number}  props.menuId       The menu in the site header, if any.
 * @param {Function} props.onClose      Called when the dialog closes unfinished.
 * @param {Function} props.onDone       Called with the plan carried out, and the
 *                                      pages used, once it's saved.
 * @param {string}   [props.recommends] `page` or `posts`, what the workspace
 *                                      expects, recommended when the first
 *                                      step asks.
 * @return {Element} The dialog.
 */
export default function HomepageSetup( {
	expects,
	menuId,
	onClose,
	onDone,
	recommends,
} ) {
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
			site: siteNow.site,
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
				<Text render={ <p /> }>{ __( 'Looking at your site…' ) }</Text>
			</Modal>
		);
	}

	const steps = getSteps( plan, isChoosing );
	const stepId = steps[ Math.min( stepIndex, steps.length - 1 ) ];
	const StepBody = STEPS[ stepId ];
	const isLast = stepIndex >= steps.length - 1;

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
			<Stack direction="column" gap="lg">
				<StepBody
					choices={ choices }
					defaults={ { ...basePlan, site: planRef.current.site } }
					direction={ to }
					menuTitle={ siteNow.menu?.title }
					pages={ pages }
					plan={ plan }
					recommends={ recommends }
					setChoices={ setChoices }
					setDirection={ setDirection }
				/>
				{ error && (
					<Notice.Root intent="error">
						<Notice.Description>{ error }</Notice.Description>
					</Notice.Root>
				) }
			</Stack>
			<div className="cnl-homepage-setup__footer">
				{ steps.length > 1 && (
					<Text
						className="cnl-homepage-setup__count"
						variant="body-sm"
					>
						{ sprintf(
							/* translators: 1: this step's number. 2: how many steps. */
							__( 'Step %1$d of %2$d' ),
							stepIndex + 1,
							steps.length
						) }
					</Text>
				) }
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
						{ /* Saves straight away, so it says what it does. */ }
						{ isLast &&
							plan.to === 'posts' &&
							__( 'Show latest posts' ) }
						{ isLast && plan.to === 'page' && __( 'Set homepage' ) }
						{ ! isLast && __( 'Continue' ) }
					</Button>
				</div>
			</div>
		</Modal>
	);
}
