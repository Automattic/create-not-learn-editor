/**
 * Rearranging the Site overview: dragging a page onto another to put it
 * under it or beside it, and dragging pages into the main menu.
 *
 * Every change is an unsaved edit, the same ones the Pages screen makes, so
 * it waits for Save with the rest and comes with a way to undo it. The map
 * shows the pages where those edits put them at once.
 */

/**
 * Internal dependencies
 */
import { usePages } from '../content/pages/data';
import { useHomepageState } from '../content/pages/homepage';
import { HOMEPAGE } from '../content/pages/homepage-state';
import { useMenuSwitches } from '../content/pages/menu-switches';
import usePageOrder from '../content/pages/use-page-order';
import useMainMenu from '../content/use-main-menu';
import {
	applyPageTree,
	canDropOnPage,
	getDropChanges,
	getDropPosition,
} from './arrange';
import { getMenuTrayItems } from './menu-tray';
import {
	__,
	noticesStore,
	sprintf,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '../../wordpress-packages';

const DRAG_THRESHOLD = 4;
const TRAY_SELECTOR = '.cnl-site-overview-menu-tray';
// Top-level pills only: the items in their dropdowns move with them.
const PILL_SELECTOR =
	'.cnl-site-overview-menu-tray__group > .cnl-site-overview-menu-tray__item';

/**
 * What a card stands for in the menu: the homepage, a page, or the page a
 * collection is listed on.
 *
 * @param {Object} node Site overview node.
 * @return {number|string|null} Page ID, `HOMEPAGE`, or null.
 */
export function getMenuTarget( node ) {
	if ( node?.kind === 'home' ) {
		return HOMEPAGE;
	}

	if (
		( node?.kind === 'page' || node?.kind === 'collection' ) &&
		node.postId
	) {
		return Number( node.postId );
	}

	return null;
}

/**
 * What dropping here will do, in words, for the label that follows the
 * pointer.
 *
 * @param {Object} drop      Drop target.
 * @param {Map}    nodesById Overview nodes.
 * @return {string} Label.
 */
function getDropLabel( drop, nodesById ) {
	const title = nodesById.get( drop?.nodeId )?.title || '';

	switch ( drop?.position ) {
		case 'menu':
			return __( 'Add to menu' );
		case 'remove':
			return __( 'Take out of menu' );
		case 'reorder':
			return __( 'Move here in menu' );
		case 'top':
			return __( 'Move to the top level' );
		case 'under':
			/* translators: %s: Page title. */
			return sprintf( __( 'Put under “%s”' ), title );
		case 'before':
			/* translators: %s: Page title. */
			return sprintf( __( 'Move before “%s”' ), title );
		case 'after':
			/* translators: %s: Page title. */
			return sprintf( __( 'Move after “%s”' ), title );
		default:
			return '';
	}
}

/**
 * @param {Object}   args              Arguments.
 * @param {boolean}  args.isArranging  Whether the map is being rearranged.
 * @param {Object}   args.siteOverview Site overview from the REST API.
 * @param {Function} args.onDragEnd    Called when a drag ends, so the click
 *                                     that ends it doesn't select a page.
 * @return {Object} The overview to draw, the menu, and the drag.
 */
export default function useArrange( { isArranging, siteOverview, onDragEnd } ) {
	const { frontPageId, isLoading, pages } = usePages();
	const { movePages, tree } = usePageOrder( { frontPageId, pages } );
	const homepage = useHomepageState();
	const mainMenu = useMainMenu();
	const switches = useMenuSwitches( {
		homepage,
		menuId: mainMenu.menuId,
		pages,
	} );
	const { createInfoNotice } = useDispatch( noticesStore );
	const [ drag, setDrag ] = useState( null );

	const overview = useMemo(
		() =>
			isLoading || ! pages.length
				? siteOverview
				: applyPageTree( siteOverview, tree ),
		[ isLoading, pages.length, siteOverview, tree ]
	);
	const nodesById = useMemo(
		() =>
			new Map(
				( overview?.nodes || [] ).map( ( node ) => [ node.id, node ] )
			),
		[ overview ]
	);
	const menuItems = useMemo(
		() =>
			switches.isReady
				? getMenuTrayItems( {
						blocks: switches.blocks,
						frontPageId,
						getSwitch: switches.getSwitch,
						tree,
					} )
				: [],
		// `getSwitch` is new each render; the blocks and tree are what it reads.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[ switches.isReady, switches.blocks, frontPageId, tree, pages ]
	);
	const menuTargets = useMemo( () => {
		const targets = new Set();
		const visit = ( items ) =>
			items.forEach( ( item ) => {
				targets.add( item.target );
				visit( item.children );
			} );

		visit( menuItems );

		return targets;
	}, [ menuItems ] );

	// Pills can be put in order in a menu set by hand, and in an auto menu,
	// whose order is the pages' own. A menu mixing the two is left to the
	// Menus screen.
	const canReorderMenu =
		switches.isReady &&
		menuItems.length > 1 &&
		( ! switches.listsPages || switches.isAutomatic );

	// The drag's handlers live for the whole drag, so they read the latest
	// pages and menu from here.
	const latest = useRef();
	latest.current = {
		// A page dropped on a menu set by hand goes where it lands. An auto
		// menu keeps page order.
		canPlaceInMenu: switches.isReady && ! switches.listsPages,
		canReorderMenu,
		frontPageId,
		menuItems,
		menuId: mainMenu.menuId,
		menuTargets,
		movePages,
		nodesById,
		switches,
		tree,
	};

	const isDraggable = useCallback(
		( node ) =>
			isArranging &&
			( node.kind === 'page' || getMenuTarget( node ) !== null ),
		[ isArranging ]
	);

	/**
	 * Where among the pills a drop at the pointer lands: before the first pill
	 * the pointer is left of, or above, or else at the end.
	 *
	 * @param {Document} doc     Document.
	 * @param {number}   clientX Pointer.
	 * @param {number}   clientY Pointer.
	 * @return {number} Index, 0 to the number of pills.
	 */
	const getMenuIndex = ( doc, clientX, clientY ) => {
		const pills = [ ...doc.querySelectorAll( PILL_SELECTOR ) ];
		const index = pills.findIndex( ( pill ) => {
			const rect = pill.getBoundingClientRect();

			return (
				clientY < rect.top ||
				( clientY <= rect.bottom &&
					clientX < rect.left + rect.width / 2 )
			);
		} );

		return index === -1 ? pills.length : index;
	};

	const getCardDrop = ( node, clientX, clientY, doc ) => {
		const current = latest.current;
		const element = doc.elementFromPoint( clientX, clientY );

		if ( element?.closest( TRAY_SELECTOR ) ) {
			if ( ! current.menuId || getMenuTarget( node ) === null ) {
				return null;
			}

			return {
				index: current.canPlaceInMenu
					? getMenuIndex( doc, clientX, clientY )
					: undefined,
				position: 'menu',
			};
		}

		const card = element?.closest( '[data-node-id]' );

		if ( ! card || node.kind !== 'page' ) {
			return null;
		}

		const nodeId = card.getAttribute( 'data-node-id' );

		if ( nodeId === 'home' ) {
			return { nodeId, position: 'top' };
		}

		const target = current.nodesById.get( nodeId );

		if (
			target?.kind !== 'page' ||
			! canDropOnPage(
				current.tree,
				Number( node.postId ),
				Number( target.postId )
			)
		) {
			return null;
		}

		const rect = card.getBoundingClientRect();

		return {
			nodeId,
			position: getDropPosition( ( clientX - rect.left ) / rect.width ),
			targetId: Number( target.postId ),
		};
	};

	const dropCard = ( node, target ) => {
		const current = latest.current;

		if ( target.position === 'menu' ) {
			const menuTarget = getMenuTarget( node );
			const state = current.switches.getSwitch( menuTarget );

			if ( current.menuTargets.has( menuTarget ) || state.checked ) {
				createInfoNotice(
					sprintf(
						/* translators: %s: Page title. */
						__( '“%s” is already in your menu.' ),
						node.title
					),
					{ id: 'cnl-site-overview-menu', type: 'snackbar' }
				);
			} else if ( state.disabled ) {
				createInfoNotice( state.note, {
					id: 'cnl-site-overview-menu',
					type: 'snackbar',
				} );
			} else {
				current.switches.toggle( menuTarget, { index: target.index } );
			}

			return;
		}

		current.movePages(
			getDropChanges( current.tree, Number( node.postId ), target, {
				frontPageId: current.frontPageId,
			} )
		);
	};

	/**
	 * Where a dragged pill would go: off the tray takes it out of the menu,
	 * and along the top row puts it in a new place.
	 *
	 * @param {Object}   item    The pill's menu item.
	 * @param {?number}  from    Its place in the top row, if it is in it.
	 * @param {number}   clientX Pointer.
	 * @param {number}   clientY Pointer.
	 * @param {Document} doc     Document.
	 * @return {?Object} Drop, or null.
	 */
	const getPillDrop = ( item, from, clientX, clientY, doc ) => {
		const element = doc.elementFromPoint( clientX, clientY );

		if ( ! element?.closest( TRAY_SELECTOR ) ) {
			return item.target !== null ? { position: 'remove' } : null;
		}

		if ( from === undefined || ! latest.current.canReorderMenu ) {
			return null;
		}

		const index = getMenuIndex( doc, clientX, clientY );

		// Back where it was.
		if ( index === from || index === from + 1 ) {
			return null;
		}

		return { index, position: 'reorder' };
	};

	/**
	 * Move a pill to a new place. An auto menu lists pages in their own
	 * order, so there the page moves among the pages beside it, on the map
	 * too.
	 *
	 * @param {number} from  The pill's place.
	 * @param {number} index Where it lands, counting it in its old place.
	 */
	const dropPill = ( from, index ) => {
		const current = latest.current;
		const items = current.menuItems;
		const item = items[ from ];

		if ( ! current.switches.listsPages ) {
			current.switches.moveTopLevelItem(
				from,
				index > from ? index - 1 : index,
				item.label
			);
			return;
		}

		const isEnd = index >= items.length;
		const target = items[ isEnd ? items.length - 1 : index ];

		current.movePages(
			getDropChanges(
				current.tree,
				item.pageId,
				{
					position: isEnd ? 'after' : 'before',
					targetId: target.pageId,
				},
				{ frontPageId: current.frontPageId }
			)
		);
	};

	/**
	 * Follow a drag from a pointer press until it is let go.
	 *
	 * @param {Event}    event         The press.
	 * @param {Object}   options
	 * @param {Object}   options.drag  What the drag is, kept in its state.
	 * @param {Function} options.find  Returns where the pointer would drop,
	 *                                 or null.
	 * @param {Function} options.place Makes the drop.
	 */
	const followDrag = ( event, { drag: dragged, find, place } ) => {
		const view = event.currentTarget.ownerDocument.defaultView;
		const { clientX: startX, clientY: startY, pointerId } = event;
		let isDragging = false;

		const stop = () => {
			view.removeEventListener( 'pointermove', onMove );
			view.removeEventListener( 'pointerup', onUp );
			view.removeEventListener( 'pointercancel', onCancel );
			view.removeEventListener( 'keydown', onKeyDown, true );
			setDrag( null );

			if ( isDragging ) {
				onDragEnd?.();
			}
		};

		function onMove( moveEvent ) {
			if ( moveEvent.pointerId !== pointerId ) {
				return;
			}

			if (
				! isDragging &&
				Math.hypot(
					moveEvent.clientX - startX,
					moveEvent.clientY - startY
				) < DRAG_THRESHOLD
			) {
				return;
			}

			isDragging = true;
			setDrag( {
				...dragged,
				drop: find(
					moveEvent.clientX,
					moveEvent.clientY,
					view.document
				),
				x: moveEvent.clientX,
				y: moveEvent.clientY,
			} );
		}

		function onUp( upEvent ) {
			if ( upEvent.pointerId !== pointerId ) {
				return;
			}

			const target = isDragging
				? find( upEvent.clientX, upEvent.clientY, view.document )
				: null;

			stop();

			if ( target ) {
				place( target );
			}
		}

		function onCancel( cancelEvent ) {
			if ( cancelEvent.pointerId === pointerId ) {
				stop();
			}
		}

		function onKeyDown( keyEvent ) {
			if ( keyEvent.key === 'Escape' ) {
				keyEvent.preventDefault();
				keyEvent.stopPropagation();
				stop();
			}
		}

		view.addEventListener( 'pointermove', onMove );
		view.addEventListener( 'pointerup', onUp );
		view.addEventListener( 'pointercancel', onCancel );
		view.addEventListener( 'keydown', onKeyDown, true );
	};

	// Stable, so the cards don't all draw again on every change. The drop
	// reads the latest pages and menu through `latest`.
	const onCardPointerDown = useCallback(
		( event, node ) => {
			if (
				event.button !== 0 ||
				! isDraggable( node ) ||
				event.target.closest( '.cnl-site-overview-card__menu-toggle' )
			) {
				return;
			}

			// The card is dragged rather than the canvas panned.
			event.stopPropagation();
			followDrag( event, {
				drag: { nodeId: node.id, title: node.title },
				find: ( x, y, doc ) => getCardDrop( node, x, y, doc ),
				place: ( target ) => dropCard( node, target ),
			} );
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[ isDraggable, onDragEnd ]
	);

	const onPillPointerDown = ( event, item, index ) => {
		// Its × takes it out rather than dragging it.
		if ( event.button !== 0 || event.target.closest( 'button' ) ) {
			return;
		}

		followDrag( event, {
			drag: { pillKey: item.key, title: item.label },
			find: ( x, y, doc ) => getPillDrop( item, index, x, y, doc ),
			place: ( target ) =>
				target.position === 'remove'
					? latest.current.switches.toggle( item.target )
					: dropPill( index, target.index ),
		} );
	};

	// Stable, so the cards don't all draw again on every change.
	const onToggleMenu = useCallback( ( node ) => {
		const target = getMenuTarget( node );

		if ( target !== null ) {
			latest.current.switches.toggle( target );
		}
	}, [] );

	// Leaving Rearrange drops any drag under way.
	useEffect( () => {
		if ( ! isArranging ) {
			setDrag( null );
		}
	}, [ isArranging ] );

	return {
		drag: drag && {
			...drag,
			label: getDropLabel( drag.drop, nodesById ),
		},
		isDraggable,
		/**
		 * Whether a card's page is in the menu, for its switch.
		 *
		 * @param {Object} node Site overview node.
		 * @return {Object} `{ state, note }`, `state` being `on`, `off`,
		 *                  `disabled`, or undefined for no switch.
		 */
		getMenuState: ( node ) => {
			const target = getMenuTarget( node );

			if ( target === null || ! switches.isReady || ! mainMenu.menuId ) {
				return {};
			}

			const state = switches.getSwitch( target );
			let value = state.checked ? 'on' : 'off';

			if ( state.disabled ) {
				value = 'disabled';
			}

			return { note: state.note, state: value };
		},
		menu: {
			canReorder: canReorderMenu,
			hasMenu: Boolean( mainMenu.menuId ),
			insertIndex:
				drag?.drop?.index !== undefined ? drag.drop.index : undefined,
			isAutomatic: switches.isAutomatic,
			items: menuItems,
			menuTitle: mainMenu.menuTitle,
			onPillPointerDown,
			remove: ( target ) => switches.toggle( target ),
		},
		onCardPointerDown,
		onToggleMenu,
		overview,
	};
}
