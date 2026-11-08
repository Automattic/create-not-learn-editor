/**
 * WordPress dependencies
 */
import { Button, Dropdown, MenuGroup, MenuItem } from '@wordpress/components';
import { subscribe, useSelect } from '@wordpress/data';
import {
	createElement as el,
	createRoot,
	useEffect,
	useState,
	useSyncExternalStore,
} from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
	category,
	check,
	chevronUpDown,
	drawerLeft,
	menu as menuIcon,
} from '@wordpress/icons';
import { Icon, Tooltip } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	STORE_NAME as CHAT_STORE,
	chatActions,
	getChat,
} from '../../../src/chat/store';
import {
	getActiveWorkspace,
	getAvailableWorkspaces,
	resetRouteToHome,
	setActiveWorkspace,
} from '../../../src/workspaces';

/*
 * What can be pointed at in the sidebar while it is a strip of icons, the
 * sidebar not being expanded. Matches the rule in `_sidebar.scss`.
 */
const STRIP_ITEM_SELECTOR = `body:not(.cnl-sidebar-is-expanded) #create-not-learn-editor-app [class*="__layout"] > [class*="__sidebar"] :is([class*="__item-wrapper"] > *, .cnl-menu-section-stand-in__button, .cnl-sidebar-workspace__toggle)`;

const EXPANDED_CLASS = 'cnl-sidebar-is-expanded';

const SIDEBAR_SELECTOR =
	'#create-not-learn-editor-app [class*="__layout"] > [class*="__sidebar"]';

/*
 * The parts of the sidebar that keep their place while it expands or folds,
 * which glide to where they sit in the other shape: each item's icon, the
 * menu button and the workspace switcher's icon. Everything
 * else in the sidebar is clipped as it narrows, or revealed as it widens.
 */
const GLIDING_PARTS_SELECTOR = [
	'[class*="__item-wrapper"] > * > * > :first-child',
	'.cnl-sidebar-toggle__button',
	'.cnl-sidebar-workspace__toggle > :first-child',
].join( ', ' );

const TRANSITION_CLASS = 'cnl-sidebar-is-transitioning';

let latestTransition = null;

// Everything named for the latest transition, and any it cut short.
const namedParts = new Set();

/**
 * Whether the sidebar's change of shape can be animated: the browser can run
 * a view transition, motion isn't reduced, and the sidebar is a column
 * rather than a drawer. Not while another view transition runs, like boot's
 * on a change of screen, as starting one would cut that one short.
 *
 * @return {boolean} Whether to animate.
 */
function canAnimateExpansion() {
	if (
		! document.startViewTransition ||
		window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ||
		! window.matchMedia( '(min-width: 782px)' ).matches ||
		document.activeViewTransition
	) {
		return false;
	}

	try {
		return ! document.documentElement.matches( ':active-view-transition' );
	} catch {
		return true;
	}
}

/**
 * Expand the sidebar or fold it to its strip of icons as one view transition.
 *
 * The page is laid out once, in its new shape, and the browser animates
 * pictures of the before and after, so neither the sidebar's menu nor the
 * site beside it is laid out again on every frame. Boot names its stage and
 * canvas for its own transitions, so they slide and widen with it. The
 * sidebar and its gliding parts are named only for this transition, so
 * boot's own transitions are left as they are. See `_sidebar.scss`.
 *
 * @param {() => void} update Changes the sidebar's shape.
 */
function animateExpansion( update ) {
	const sidebar = document.querySelector( SIDEBAR_SELECTOR );

	if ( ! sidebar || ! canAnimateExpansion() ) {
		update();
		return;
	}

	sidebar.style.viewTransitionName = 'cnl-sidebar';
	namedParts.add( sidebar );
	sidebar
		.querySelectorAll( GLIDING_PARTS_SELECTOR )
		.forEach( ( part, index ) => {
			part.style.viewTransitionName = `cnl-sidebar-part-${ index }`;
			namedParts.add( part );
		} );

	const root = document.documentElement;
	root.classList.add( TRANSITION_CLASS );

	const transition = document.startViewTransition( update );
	latestTransition = transition;

	// A transition cut short by the next one rejects `ready`; the change of
	// shape still happens, so that's nothing to report.
	transition.ready.catch( () => {} );

	transition.finished.finally( () => {
		// Starting another transition cuts this one short, and the newer
		// one tidies up after them both.
		if ( transition !== latestTransition ) {
			return;
		}

		latestTransition = null;
		namedParts.forEach( ( element ) => {
			element.style.viewTransitionName = '';
		} );
		namedParts.clear();
		root.classList.remove( TRANSITION_CLASS );
	} );
}

/*
 * Whether the sidebar is expanded rather than a strip of icons. Shown as a
 * class on <body>, which the strip's rule keys off, once the change of shape
 * is under way. It starts as a strip and only expands when toggled open, or
 * to show a section of the menu, until another screen is picked.
 */
const expansion = {
	listeners: new Set(),
	isExpanded: document.body.classList.contains( EXPANDED_CLASS ),
	get: () => expansion.isExpanded,
	set( isExpanded ) {
		if ( isExpanded === expansion.isExpanded ) {
			return;
		}

		expansion.isExpanded = isExpanded;

		// Shows the latest shape asked for, should it change again before
		// the transition gets to it.
		animateExpansion( () => {
			document.body.classList.toggle(
				EXPANDED_CLASS,
				expansion.isExpanded
			);
			expansion.listeners.forEach( ( listener ) => listener() );
		} );
	},
	subscribe( listener ) {
		expansion.listeners.add( listener );
		return () => expansion.listeners.delete( listener );
	},
};

/**
 * Expand the sidebar from its strip of icons, or fold it back: a menu button
 * at the top of the sidebar, in the corner below the admin bar. Once the
 * sidebar is expanded it shows the sidebar itself, as the way to close it.
 *
 * @return {Element} The toggle.
 */
function SidebarToggle() {
	const isExpanded = useSyncExternalStore(
		expansion.subscribe,
		expansion.get
	);

	return el( Button, {
		__next40pxDefaultSize: true,
		'aria-expanded': isExpanded,
		className: 'cnl-sidebar-toggle__button',
		icon: isExpanded ? drawerLeft : menuIcon,
		label: isExpanded ? __( 'Collapse sidebar' ) : __( 'Expand sidebar' ),
		onClick: () => expansion.set( ! isExpanded ),
		showTooltip: true,
		tooltipPosition: 'middle right',
	} );
}

/**
 * Name the icon pointed at, or focused, in the sidebar's strip of icons.
 *
 * Boot's menu items aren't ours to wrap in a tooltip, so one tooltip follows
 * whichever item is under the pointer or has focus. The menu button and
 * boot's Back button already show their own.
 *
 * @return {?Element} The tooltip.
 */
function StripTooltip() {
	const [ item, setItem ] = useState( null );

	useEffect( () => {
		const follow = ( event ) => {
			setItem(
				window.matchMedia( '(min-width: 782px)' ).matches
					? event.target.closest?.( STRIP_ITEM_SELECTOR ) || null
					: null
			);
		};
		const hide = () => setItem( null );

		document.addEventListener( 'pointerover', follow );
		document.addEventListener( 'focusin', follow );
		document.addEventListener( 'click', hide );

		return () => {
			document.removeEventListener( 'pointerover', follow );
			document.removeEventListener( 'focusin', follow );
			document.removeEventListener( 'click', hide );
		};
	}, [] );

	if ( ! item ) {
		return null;
	}

	return el(
		Tooltip.Root,
		{ open: true },
		el(
			Tooltip.Popup,
			{
				positioner: el( Tooltip.Positioner, {
					anchor: item,
					side: 'right',
				} ),
			},
			item.getAttribute( 'aria-label' ) || item.textContent.trim()
		)
	);
}

/**
 * The screen on show, which is the route's path. Other search parameters
 * move around within a screen.
 *
 * @return {string} Route path. No route at all is home.
 */
function getRoutePath() {
	return new URL( window.location.href ).searchParams.get( 'p' ) ?? '/';
}

/*
 * Set while a change of route only follows the sidebar, as when going Back
 * to its top level, so the sidebar stays expanded through it.
 */
let isFollowingSidebar = false;

/**
 * Clicking an item in the sidebar's strip of icons that doesn't open a
 * screen expands the sidebar to show what it stands for: Advanced's one icon
 * (`menu-sections.jsx`), or a drilldown another plugin registers. Picking a screen leaves it as a strip.
 */
function expandOnStripDrilldown() {
	document.addEventListener( 'click', ( event ) => {
		if ( ! event.target.closest?.( STRIP_ITEM_SELECTOR ) ) {
			return;
		}

		const path = getRoutePath();
		window.requestAnimationFrame( () => {
			if ( getRoutePath() === path ) {
				expansion.set( true );
			}
		} );
	} );
}

/**
 * The sidebar and the chat take turns: opening the chat folds the sidebar to
 * its strip of icons, and expanding the sidebar again, or clicking anything
 * in it, closes the chat.
 */
function shareRoomWithChat() {
	let wasOpen = getChat().isOpen();

	subscribe( () => {
		const isOpen = getChat().isOpen();

		if ( isOpen && ! wasOpen ) {
			expansion.set( false );
		}

		wasOpen = isOpen;
	}, CHAT_STORE );

	expansion.subscribe( () => {
		if ( expansion.get() && getChat().isOpen() ) {
			chatActions().setOpen( false );
		}
	} );

	// Using the sidebar at all is going back to working without the chat.
	document.addEventListener(
		'click',
		( event ) => {
			if (
				getChat().isOpen() &&
				event.target.closest?.(
					'#create-not-learn-editor-app [class*="__layout"] > [class*="__sidebar"]'
				)
			) {
				chatActions().setOpen( false );
			}
		},
		// Before the strip's own handling, which may then expand the sidebar.
		true
	);
}

/**
 * Switch between workspaces: a quiet button showing the active workspace,
 * opening a menu of all of them above it.
 *
 * @return {Element} The workspace switcher.
 */
function WorkspaceSwitcher() {
	const workspace = useSelect(
		( select ) => getActiveWorkspace( select ),
		[]
	);

	return el( Dropdown, {
		popoverProps: { placement: 'top-start' },
		renderToggle: ( { isOpen, onToggle } ) =>
			el(
				Button,
				{
					size: 'compact',
					className: 'cnl-sidebar-workspace__toggle',
					onClick: onToggle,
					'aria-expanded': isOpen,
					'aria-haspopup': 'true',
					// The visible text is only the workspace's name.
					'aria-label': sprintf(
						/* translators: %s: The active workspace's name. */
						__( 'Workspace: %s' ),
						workspace.label
					),
				},
				el( Icon, { icon: category, size: 16 } ),
				el(
					'span',
					{ className: 'cnl-sidebar-workspace__value' },
					workspace.label
				),
				el( Icon, { icon: chevronUpDown, size: 16 } )
			),
		renderContent: ( { onClose } ) =>
			el(
				MenuGroup,
				{ label: __( 'Workspace' ) },
				getAvailableWorkspaces().map( ( { id, label, icon } ) =>
					el(
						MenuItem,
						{
							key: id,
							role: 'menuitemradio',
							isSelected: id === workspace.id,
							icon,
							iconPosition: 'left',
							suffix:
								id === workspace.id &&
								el( Icon, { icon: check } ),
							className: 'cnl-sidebar-workspace__option',
							onClick: () => {
								if ( id !== workspace.id ) {
									resetRouteToHome();
								}
								setActiveWorkspace( id );
								onClose();
							},
						},
						label
					)
				)
			),
	} );
}

function createWelcome( name ) {
	const welcome = document.createElement( 'p' );
	welcome.className = 'cnl-sidebar-welcome';
	welcome.textContent = name
		? sprintf(
				/* translators: %s: The current user's first name or nickname. */
				__( 'Welcome, %s' ),
				name
			)
		: __( 'Welcome' );

	return welcome;
}

function mountStripTooltip() {
	const container = document.createElement( 'div' );
	document.body.append( container );
	createRoot( container ).render( el( StripTooltip ) );
}

/**
 * The sidebar's top row: the greeting, then the menu button at the far end.
 *
 * @param {string} name The user's first name or nickname, if any.
 * @return {Element} The row.
 */
function createSidebarHeader( name ) {
	const toggle = document.createElement( 'div' );
	toggle.className = 'cnl-sidebar-toggle';
	createRoot( toggle ).render( el( SidebarToggle ) );

	const header = document.createElement( 'div' );
	header.className = 'cnl-sidebar-header';
	header.append( createWelcome( name ), toggle );

	return header;
}

/**
 * Going back to the sidebar's top level takes the stage back to its top level
 * too, the "Your site" hub, so the two never disagree about where you are.
 *
 * Boot's sidebar moves between its levels without changing the route, so its
 * Back button is watched instead. Its levels can nest, so the route only
 * changes once the top level, which has no title, is the one on show.
 */
function returnHomeWithSidebar() {
	document.addEventListener( 'click', ( event ) => {
		if (
			! event.target.closest?.(
				'[class*="__sidebar"] [class*="__title-icon"] button'
			)
		) {
			return;
		}

		window.requestAnimationFrame( () => {
			const isTopLevel = document.querySelector(
				'[class*="__sidebar"] [class*="__title-icon"] h1:empty'
			);
			if ( isTopLevel && getRoutePath() !== '/' ) {
				isFollowingSidebar = true;
				resetRouteToHome();
			}
		} );
	} );
}

function createWorkspaceSwitcher() {
	const container = document.createElement( 'div' );
	container.className = 'cnl-sidebar-workspace';
	createRoot( container ).render( el( WorkspaceSwitcher ) );

	return container;
}

/**
 * Add the plugin's own pieces to boot's sidebar.
 *
 * - A top row in place of boot's Dashboard link, which `_sidebar.scss`
 *   hides, as the admin bar above leads to the Dashboard. It holds a
 *   greeting, hidden inside menu sections by CSS, and a menu button to
 *   expand the sidebar from its strip of icons and fold it back. The sidebar
 *   starts as a strip, so the first thing anyone sees is the screen itself,
 *   and folds back whenever another screen is picked.
 * - A workspace switcher in its own section below the menu, outside boot's
 *   navigation screens so it stays put when drilling in and out.
 * - A tooltip naming each icon while the sidebar is a strip of icons.
 * - Going back to the sidebar's top level takes the stage home too.
 * - Clicking an icon in the strip that opens a menu section expands the
 *   sidebar to show it.
 * - Opening the chat folds the sidebar to its strip, and expanding or
 *   clicking anything in the sidebar closes the chat.
 *
 * Boot's sidebar has no slot for extra content, so these are placed relative
 * to boot's own Dashboard link and the menu that follows it. The sidebar can remount, on narrow screens for
 * example, so they are put back whenever they go missing.
 *
 * @param {Object} options          Options.
 * @param {string} options.userName The user's first name or nickname, if any.
 */
export function enhanceSidebar( { userName } = {} ) {
	const header = createSidebarHeader( userName );
	const workspaceSwitcher = createWorkspaceSwitcher();

	mountStripTooltip();
	returnHomeWithSidebar();
	expandOnStripDrilldown();
	shareRoomWithChat();

	let routePath = getRoutePath();

	let isScheduled = false;
	const place = () => {
		isScheduled = false;

		const backButton = document.querySelector(
			'[class*="__sidebar"] [class*="__back-button"]'
		);

		if ( ! backButton ) {
			return;
		}

		if ( backButton.previousElementSibling !== header ) {
			backButton.before( header );
		}

		// Picking another screen folds the sidebar to its strip of icons.
		if ( getRoutePath() !== routePath ) {
			routePath = getRoutePath();
			if ( ! isFollowingSidebar ) {
				expansion.set( false );
			}
			isFollowingSidebar = false;
		}

		const menu = backButton.parentElement.querySelector(
			':scope > [class*="__content"]'
		);

		if ( menu && menu.nextElementSibling !== workspaceSwitcher ) {
			menu.after( workspaceSwitcher );
		}
	};

	new window.MutationObserver( () => {
		if ( ! isScheduled ) {
			isScheduled = true;
			window.requestAnimationFrame( place );
		}
	} ).observe( document.body, { childList: true, subtree: true } );

	place();
}
