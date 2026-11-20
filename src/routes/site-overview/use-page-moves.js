/**
 * Moving pages on the Site overview by dragging them: onto another page to
 * put it under it, onto its edge to put it beside it, or onto the homepage
 * to move it to the top level.
 *
 * Every move is an unsaved edit, the same one the Pages screen makes, so it
 * waits for Save with the rest and comes with a way to undo it. The map shows
 * the pages where those edits put them at once.
 */

/**
 * Internal dependencies
 */
import { usePages } from '../content/pages/data';
import usePageOrder from '../content/pages/use-page-order';
import {
	applyPageTree,
	canDropOnPage,
	getDropChanges,
	getDropPosition,
} from './arrange';
import {
	__,
	sprintf,
	useCallback,
	useMemo,
	useRef,
	useState,
} from '../../wordpress-packages';

const DRAG_THRESHOLD = 4;

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
 * @param {Object}   args.siteOverview Site overview from the REST API.
 * @param {Function} args.onDragEnd    Called when a drag ends, so the click
 *                                     that ends it doesn't select a page.
 * @return {Object} The overview to draw, the drag, and a handler for a
 *                  card's pointer press.
 */
export default function usePageMoves( { siteOverview, onDragEnd } ) {
	const { frontPageId, isLoading, pages } = usePages();
	const { movePages, tree } = usePageOrder( { frontPageId, pages } );
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

	// A drag's handlers live for the whole drag, so they read the latest
	// pages from here.
	const latest = useRef();
	latest.current = { frontPageId, movePages, nodesById, tree };

	const getDrop = ( node, clientX, clientY, doc ) => {
		const current = latest.current;
		const card = doc
			.elementFromPoint( clientX, clientY )
			?.closest( '[data-node-id]' );

		if ( ! card ) {
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

	// Stable, so the cards don't all draw again on every change. The drop
	// reads the latest pages through `latest`.
	const onCardPointerDown = useCallback(
		( event, node ) => {
			if ( event.button !== 0 || node.kind !== 'page' ) {
				return;
			}

			// The card is dragged rather than the canvas panned.
			event.stopPropagation();

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
					drop: getDrop(
						node,
						moveEvent.clientX,
						moveEvent.clientY,
						view.document
					),
					nodeId: node.id,
					title: node.title,
					x: moveEvent.clientX,
					y: moveEvent.clientY,
				} );
			}

			function onUp( upEvent ) {
				if ( upEvent.pointerId !== pointerId ) {
					return;
				}

				const target = isDragging
					? getDrop(
							node,
							upEvent.clientX,
							upEvent.clientY,
							view.document
						)
					: null;

				stop();

				if ( target ) {
					const current = latest.current;

					current.movePages(
						getDropChanges(
							current.tree,
							Number( node.postId ),
							target,
							{ frontPageId: current.frontPageId }
						)
					);
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
		},

		[ onDragEnd ]
	);

	return {
		drag: drag && {
			...drag,
			label: getDropLabel( drag.drop, nodesById ),
		},
		onCardPointerDown,
		overview,
	};
}
