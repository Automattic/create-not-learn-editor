/**
 * Titled sections in the sidebar's main menu.
 *
 * Boot lists its top-level menu items one after another. Each item the
 * plugin registers can name a `section` (see `cnl_editor_get_menu_items()`),
 * and a small, all-caps title goes above the first item of each, like
 * CONTENT or DESIGN. Clicking a title folds its section away, or opens it again;
 * what is folded is kept as a preference. Advanced folds again whenever the
 * editor loads, since it is for those who look for it. The screen on show stays listed even in a
 * folded section, so the sidebar never loses track of where you are.
 *
 * A section can show only its first few items, with a "…" item after them
 * that lists the rest when clicked: Content shows Pages and Posts, and a
 * shop's Products, and keeps any other content types behind the "…". They
 * stay listed until the editor is reloaded.
 *
 * Items with no section, like Home, come first, untitled. While the sidebar
 * is a strip of icons, each title is a thin rule and every item shows, as
 * there is nothing to read and nowhere to unfold it. Advanced is the
 * exception: the strip shows it as one "< >" icon, which opens the sidebar
 * on it, or as the icon of its screen on show.
 *
 * Boot's menu isn't ours to render, so the titles are placed between its
 * items, which are matched to boot's registered items by where they link.
 */

/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { dispatch, select, subscribe, useSelect } from '@wordpress/data';
import { Button } from '@wordpress/components';
import {
	createRoot,
	useLayoutEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	chevronDownSmall,
	code,
	help as helpIcon,
	moreHorizontal,
} from '@wordpress/icons';
import { store as preferencesStore } from '@wordpress/preferences';
import { Icon, Tooltip, VisuallyHidden } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { PREFERENCES_SCOPE } from '../../../src/workspaces';

/*
 * The sections, in no particular order: the menu items set it. An item
 * naming a section that isn't here is listed as if it had none.
 * `shownItems` is how many items show before the rest go behind a "…". An
 * item registered with `alwaysShown`, like the shop's Products, is never
 * one of the rest, and isn't counted.
 * `foldsOnLoad` folds the section whenever the editor loads, however it was
 * left. `stripIcon` stands for all of the section's items in the strip of
 * icons, unless one of them is the screen on show, which stands in itself.
 * `help` puts a "?" after the title that says what the section is for.
 * `moreLabel` says what the "…" shows, in place of how many items.
 */
const SECTIONS = {
	content: {
		label: __( 'Content' ),
		shownItems: 2,
		moreLabel: __( 'Show all content types' ),
	},
	site: { label: __( 'Site' ) },
	design: { label: __( 'Design' ) },
	plugins: {
		label: __( 'Plugins' ),
		help: __(
			'Plugins extend what WordPress can do. Each one here leads to its own screens.'
		),
	},
	advanced: { label: __( 'Advanced' ), foldsOnLoad: true, stripIcon: code },
};

const PREFERENCE_NAME = 'foldedMenuSections';

const DEFAULT_FOLDED = { advanced: true };

/*
 * The main menu at the sidebar's top level. Inside a drilldown the title row
 * shows its name, so these are left to boot there.
 */
const ROOT_LIST_SELECTOR =
	'[class*="__sidebar"] .components-h-stack:has(> h1.components-heading:empty) + [role="list"]';

const TITLE_CLASS = 'cnl-menu-section';

const MORE_CLASS = 'cnl-menu-section-more';

/*
 * The "?" and "…" are pointed at to find out what they are, so what they
 * say shows almost at once.
 */
const TOOLTIP_DELAY_MS = 100;

const STAND_IN_CLASS = 'cnl-menu-section-stand-in';

function getFolded( selectFn = select ) {
	return (
		selectFn( preferencesStore ).get(
			PREFERENCES_SCOPE,
			PREFERENCE_NAME
		) || DEFAULT_FOLDED
	);
}

function toggleFolded( id ) {
	const folded = getFolded();

	dispatch( preferencesStore ).set( PREFERENCES_SCOPE, PREFERENCE_NAME, {
		...folded,
		[ id ]: ! folded[ id ],
	} );
}

/**
 * A section's title, which folds the section away or opens it again.
 *
 * @param {Object} props    Props.
 * @param {string} props.id Section id.
 * @return {Element} The title's button.
 */
function SectionTitle( { id } ) {
	const { help, label } = SECTIONS[ id ];
	const isFolded = useSelect(
		( selectFn ) => !! getFolded( selectFn )[ id ],
		[ id ]
	);
	const textRef = useRef();
	const helpStart = useTextEnd( textRef, !! help );

	return (
		<>
			<button
				type="button"
				className={ `${ TITLE_CLASS }__toggle` }
				aria-expanded={ ! isFolded }
				onClick={ () => toggleFolded( id ) }
			>
				<span className={ `${ TITLE_CLASS }__label` }>
					<span ref={ textRef }>{ label }</span>
				</span>
				<Icon
					className={ `${ TITLE_CLASS }__chevron` }
					icon={ chevronDownSmall }
					size={ 24 }
				/>
			</button>
			{ help && (
				<Tooltip.Root>
					<Tooltip.Trigger
						className={ `${ TITLE_CLASS }__help` }
						delay={ TOOLTIP_DELAY_MS }
						render={ <button type="button" /> }
						style={ { insetInlineStart: helpStart } }
					>
						<Icon icon={ helpIcon } />
						<VisuallyHidden>{ help }</VisuallyHidden>
					</Tooltip.Trigger>
					<Tooltip.Popup
						className={ `${ TITLE_CLASS }__help-popup` }
						positioner={ <Tooltip.Positioner side="right" /> }
					>
						{ help }
					</Tooltip.Popup>
				</Tooltip.Root>
			) }
		</>
	);
}

/**
 * Where a title's words end, from the title's start, so its "?" can sit just
 * after them. It can't go in the title's button, which folds the section,
 * so it sits over the button instead.
 *
 * @param {Object}  textRef  The words.
 * @param {boolean} isNeeded Whether to measure.
 * @return {number|undefined} Distance in pixels.
 */
function useTextEnd( textRef, isNeeded ) {
	const [ end, setEnd ] = useState();

	useLayoutEffect( () => {
		const text = textRef.current;
		const title = text?.closest( `.${ TITLE_CLASS }` );

		if ( ! isNeeded || ! title ) {
			return;
		}

		const measure = () => {
			const textBox = text.getBoundingClientRect();

			// The strip of icons hides the words; measure them once back.
			if ( ! textBox.width ) {
				return;
			}

			const titleBox = title.getBoundingClientRect();
			const isRtl = window.getComputedStyle( title ).direction === 'rtl';

			setEnd(
				isRtl
					? titleBox.right - textBox.left
					: textBox.right - titleBox.left
			);
		};
		const observer = new window.ResizeObserver( measure );

		measure();
		observer.observe( text );
		observer.observe( title );

		return () => observer.disconnect();
	}, [ textRef, isNeeded ] );

	return end;
}

function createTitle( id ) {
	const title = document.createElement( 'h2' );
	title.className = TITLE_CLASS;
	title.dataset.cnlMenuSection = id;
	createRoot( title ).render( <SectionTitle id={ id } /> );

	return title;
}

/**
 * The "…" item after a section's first few items, which lists the rest.
 *
 * The button is as wide as the items, so its tooltip is placed beside its
 * dots rather than beside the whole button.
 *
 * @param {Object}     props          Props.
 * @param {number}     props.count    How many items it stands for.
 * @param {?string}    props.label    What it shows, if not how many.
 * @param {() => void} props.onExpand Lists them.
 * @return {Element} The button.
 */
function MoreItems( { count, label, onExpand } ) {
	const buttonRef = useRef();
	const text =
		label ||
		sprintf(
			/* translators: %d: How many more items there are. */
			_n( 'Show %d more item', 'Show %d more items', count ),
			count
		);

	return (
		<Tooltip.Root>
			<Tooltip.Trigger
				delay={ TOOLTIP_DELAY_MS }
				render={
					<Button
						className={ `${ MORE_CLASS }__button` }
						icon={ moreHorizontal }
						label={ text }
						onClick={ onExpand }
						ref={ buttonRef }
						showTooltip={ false }
					/>
				}
			/>
			<Tooltip.Popup
				positioner={
					<Tooltip.Positioner
						anchor={ () =>
							buttonRef.current?.querySelector( 'svg' ) ?? null
						}
						side="right"
					/>
				}
			>
				{ text }
			</Tooltip.Popup>
		</Tooltip.Root>
	);
}

/**
 * A section's one icon in the strip of icons. Clicking it unfolds the
 * section, and app-init's sidebar expands to show it, as it does for any
 * strip item that doesn't open a screen.
 *
 * @param {Object} props    Props.
 * @param {string} props.id Section id.
 * @return {Element} The button.
 */
function SectionStandIn( { id } ) {
	return (
		<button
			type="button"
			className={ `${ STAND_IN_CLASS }__button` }
			aria-label={ SECTIONS[ id ].label }
			onClick={ () => {
				dispatch( preferencesStore ).set(
					PREFERENCES_SCOPE,
					PREFERENCE_NAME,
					{ ...getFolded(), [ id ]: false }
				);
				// Its items take its place once the sidebar has expanded.
				window.requestAnimationFrame( () =>
					window.requestAnimationFrame( () =>
						document
							.querySelector(
								`[data-cnl-menu-section-item="${ id }"] a`
							)
							?.focus()
					)
				);
			} }
		>
			<Icon icon={ SECTIONS[ id ].stripIcon } />
		</button>
	);
}

function createStandIn( id ) {
	const standIn = document.createElement( 'div' );
	standIn.className = STAND_IN_CLASS;
	createRoot( standIn ).render( <SectionStandIn id={ id } /> );

	return standIn;
}

function createMore() {
	const more = document.createElement( 'div' );
	more.className = MORE_CLASS;
	more.root = createRoot( more );

	return more;
}

/**
 * The route a menu item in the DOM links to, like `/types/page`.
 *
 * @param {Element} element One of boot's menu items.
 * @return {?string} The route, or nothing for items that aren't links.
 */
function getLinkedRoute( element ) {
	const href = element.querySelector( 'a[href]' )?.getAttribute( 'href' );

	return href
		? new URL( href, window.location.href ).searchParams.get( 'p' )
		: null;
}

/**
 * Boot marks every item that leads to the screen on show, or to a screen it
 * is under, as current: on Products, at `/shop/products`, WooCommerce's
 * `/shop` too. Only the closest is shown as current; the others are marked
 * outranked, for the stylesheet to draw as any other item.
 *
 * @param {Element} list The main menu.
 */
function markOutranked( list ) {
	const current = [ ...list.children ]
		.filter( ( child ) => child.querySelector( '[aria-current="page"]' ) )
		.map( ( child ) => ( {
			child,
			length: getLinkedRoute( child )?.length ?? 0,
		} ) );
	const closest = Math.max( 0, ...current.map( ( { length } ) => length ) );

	[ ...list.children ].forEach( ( child ) =>
		setData(
			child,
			'cnlOutranked',
			current.some(
				( entry ) => entry.child === child && entry.length < closest
			)
				? ''
				: undefined
		)
	);
}

function setData( element, key, value ) {
	if ( value === undefined ) {
		if ( key in element.dataset ) {
			delete element.dataset[ key ];
		}
	} else if ( element.dataset[ key ] !== value ) {
		element.dataset[ key ] = value;
	}
}

/**
 * Title the sections of the sidebar's main menu, and keep them titled as
 * boot re-renders it and as workspaces move items between sections.
 */
export function mountMenuSections() {
	dispatch( preferencesStore ).setDefaults( PREFERENCES_SCOPE, {
		[ PREFERENCE_NAME ]: DEFAULT_FOLDED,
	} );

	const left = getFolded();
	const toFold = Object.keys( SECTIONS ).filter(
		( id ) => SECTIONS[ id ].foldsOnLoad && ! left[ id ]
	);
	if ( toFold.length ) {
		dispatch( preferencesStore ).set( PREFERENCES_SCOPE, PREFERENCE_NAME, {
			...left,
			...Object.fromEntries( toFold.map( ( id ) => [ id, true ] ) ),
		} );
	}

	const titles = {};
	const mores = {};
	const standIns = {};

	// Sections whose "…" has been clicked, so all their items show.
	const expanded = new Set();

	let isScheduled = false;
	const place = () => {
		isScheduled = false;

		const list = document.querySelector( ROOT_LIST_SELECTOR );

		if ( ! list ) {
			return;
		}

		const itemByRoute = new Map(
			select( bootStore )
				.getMenuItems()
				.filter( ( item ) => ! item.parent )
				.map( ( item ) => [ item.to, item ] )
		);
		const folded = getFolded();

		/*
		 * Where each title goes: before the first item of its section. A
		 * section split by another only gets a title the first time. And
		 * where each "…" goes: before the first item it hides.
		 */
		const placements = [];
		const overflows = {};
		const counts = {};
		let previous;
		[ ...list.children ].forEach( ( child ) => {
			if (
				child.classList.contains( TITLE_CLASS ) ||
				child.classList.contains( MORE_CLASS ) ||
				child.classList.contains( STAND_IN_CLASS )
			) {
				return;
			}

			const item = itemByRoute.get( getLinkedRoute( child ) );
			const section = SECTIONS[ item?.section ]
				? item.section
				: undefined;

			setData( child, 'cnlMenuSectionItem', section );
			setData(
				child,
				'cnlStandsIn',
				SECTIONS[ section ]?.stripIcon ? '' : undefined
			);
			setData(
				child,
				'cnlFolded',
				section && folded[ section ] ? '' : undefined
			);

			if ( ! item?.alwaysShown ) {
				counts[ section ] = ( counts[ section ] || 0 ) + 1;
			}
			const isOverflow =
				!! section &&
				! item?.alwaysShown &&
				! expanded.has( section ) &&
				counts[ section ] >
					( SECTIONS[ section ].shownItems ?? Infinity );
			setData( child, 'cnlOverflow', isOverflow ? '' : undefined );

			if ( isOverflow ) {
				overflows[ section ] = overflows[ section ] || {
					before: child,
					count: 0,
				};
				overflows[ section ].count++;
			}

			if (
				section &&
				section !== previous &&
				! placements.some( ( placement ) => placement.id === section )
			) {
				placements.push( { id: section, before: child } );
			}
			previous = section;
		} );

		markOutranked( list );

		const isPlaced = ( id ) =>
			placements.some( ( placement ) => placement.id === id );

		Object.entries( titles ).forEach( ( [ id, title ] ) => {
			if ( ! isPlaced( id ) ) {
				title.remove();
			}
		} );

		Object.entries( standIns ).forEach( ( [ id, standIn ] ) => {
			if ( ! isPlaced( id ) ) {
				standIn.remove();
			}
		} );

		placements.forEach( ( { id, before }, index ) => {
			titles[ id ] = titles[ id ] || createTitle( id );

			// The section's strip icon goes between its title and items.
			let first = before;
			if ( SECTIONS[ id ].stripIcon ) {
				standIns[ id ] = standIns[ id ] || createStandIn( id );
				if ( before.previousElementSibling !== standIns[ id ] ) {
					before.before( standIns[ id ] );
				}
				first = standIns[ id ];
			}

			if ( first.previousElementSibling !== titles[ id ] ) {
				first.before( titles[ id ] );
			}

			setData(
				titles[ id ],
				'cnlLast',
				index === placements.length - 1 ? '' : undefined
			);
		} );

		Object.entries( mores ).forEach( ( [ id, more ] ) => {
			if ( ! overflows[ id ] ) {
				more.remove();
			}
		} );

		Object.entries( overflows ).forEach( ( [ id, { before, count } ] ) => {
			// Rendered again whenever the count changes, which also catches
			// boot rendering a new list.
			const more = ( mores[ id ] = mores[ id ] || createMore() );

			if ( before.previousElementSibling !== more ) {
				before.before( more );
			}

			setData( more, 'cnlMenuSectionItem', id );
			setData( more, 'cnlFolded', folded[ id ] ? '' : undefined );

			if ( more.count !== count ) {
				more.count = count;
				more.root.render(
					<MoreItems
						count={ count }
						label={ SECTIONS[ id ].moreLabel }
						onExpand={ () => {
							const first = list.querySelector(
								`[data-cnl-overflow][data-cnl-menu-section-item="${ id }"]`
							);
							expanded.add( id );
							place();
							// Keep focus in the list, on the first item shown.
							first?.querySelector( 'a' )?.focus();
						} }
					/>
				);
			}
		} );
	};

	const schedule = () => {
		if ( ! isScheduled ) {
			isScheduled = true;
			window.requestAnimationFrame( place );
		}
	};

	new window.MutationObserver( schedule ).observe( document.body, {
		childList: true,
		subtree: true,
	} );
	subscribe( schedule, preferencesStore );
	subscribe( schedule, bootStore );

	place();
}
