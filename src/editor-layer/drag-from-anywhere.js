/**
 * Drag a block from anywhere on it, its text included, until you click in to
 * edit it. Pollock's round 4 user test found this was what made moving blocks
 * work for people new to the editor; see the README.
 *
 * Core already drags the selected block by its body (`useBlockProps`), but only
 * while the block itself has focus and its text isn't editable. So a press on
 * a block that isn't being edited takes its text out of editing for the length
 * of the press, makes it draggable, and selects and focuses it. If the pointer
 * moves, core's own handler runs the drag; if it doesn't, the caret goes where
 * the press was, as a click would have put it.
 */

/**
 * Internal dependencies
 */
import { useCanvasDocument } from '../site-canvas/use-canvas-document';
import {
	blockEditorStore,
	dispatch,
	flushSync,
	select,
	useEffect,
} from '../wordpress-packages';

const STYLE_ID = 'cnl-drag-from-anywhere';
const HOVER_CLASS = 'cnl-drag-from-anywhere';
const PRESSED_CLASS = 'cnl-pressed-to-drag';

// What a block keeps its own pointer behaviour for.
const INTERACTIVE =
	'button, input, textarea, select, label, summary, iframe, video, audio, [role="button"]';

// An outline on the block itself, as core draws round a block that drags,
// rather than a pseudo-element: the block's `::before` is its name label and
// its `::after` an agent's change (`includes/block-canvas-styles.php`).
const STYLES = `
.${ HOVER_CLASS }:not(.is-multi-selected):not(.is-selected) {
	outline: 1px solid var(--wp-admin-theme-color);
	outline-offset: -1px;
}
/* Over core's text cursor for editable blocks. */
.${ HOVER_CLASS },
.${ HOVER_CLASS } [contenteditable] {
	cursor: grab !important;
}
.${ PRESSED_CLASS },
.${ PRESSED_CLASS } * {
	cursor: grabbing !important;
	user-select: none;
}
`;

// The canvas iframe is the editor's, in this document.
const DOCUMENT_REF = { current: document };

/**
 * Whether the block is being edited: the caret, or keyboard focus, is in one
 * of its fields. While a text block is selected, the canvas body is the editing
 * host and holds focus (core's `useEditableRoot`), so the caret tells.
 *
 * @param {HTMLElement} node The block's element.
 * @return {boolean} Whether it is being edited.
 */
function isEditing( node ) {
	const { activeElement, defaultView } = node.ownerDocument;
	if (
		activeElement &&
		node.contains( activeElement ) &&
		activeElement.closest( '[data-block]' ) === node &&
		( activeElement.isContentEditable ||
			activeElement.matches( 'input, textarea, select' ) ||
			activeElement !== node )
	) {
		return true;
	}
	if ( ! node.classList.contains( 'is-selected' ) ) {
		return false;
	}
	const anchor = defaultView.getSelection()?.anchorNode;
	const element =
		anchor?.nodeType === anchor?.ELEMENT_NODE
			? anchor
			: anchor?.parentElement;
	return (
		!! element &&
		node.contains( element ) &&
		element.closest( '[data-block]' ) === node &&
		element.isContentEditable
	);
}

/**
 * The block a press or hover is for: the innermost one under the pointer, if
 * it can be moved and nothing in it is selected.
 *
 * @param {EventTarget} target The event's target.
 * @return {?HTMLElement} The block's element.
 */
function getDraggableBlock( target ) {
	const node = target?.closest?.( '[data-block]' );
	if ( ! node || target.closest( INTERACTIVE ) ) {
		return null;
	}
	const { canMoveBlock, hasSelectedInnerBlock, hasMultiSelection } =
		select( blockEditorStore );
	const clientId = node.dataset.block;
	if (
		! canMoveBlock( clientId ) ||
		hasSelectedInnerBlock( clientId, true ) ||
		hasMultiSelection()
	) {
		return null;
	}
	return node;
}

/**
 * Put the caret at a point, if the point is in a field.
 *
 * @param {Document} doc The canvas document.
 * @param {number}   x   Horizontal position in the viewport.
 * @param {number}   y   Vertical position in the viewport.
 */
function placeCaretAtPoint( doc, x, y ) {
	let range = null;
	if ( doc.caretPositionFromPoint ) {
		const point = doc.caretPositionFromPoint( x, y );
		if ( point ) {
			range = doc.createRange();
			range.setStart( point.offsetNode, point.offset );
			range.collapse( true );
		}
	} else if ( doc.caretRangeFromPoint ) {
		range = doc.caretRangeFromPoint( x, y );
	}
	const container = range?.startContainer;
	const element =
		container?.nodeType === container?.ELEMENT_NODE
			? container
			: container?.parentElement;
	const editable = element?.closest( '[contenteditable="true"]' );
	if ( ! editable ) {
		return;
	}
	editable.focus();
	const selection = doc.defaultView.getSelection();
	selection.removeAllRanges();
	selection.addRange( range );
}

/**
 * @param {boolean} isActive Whether the full-screen edit canvas is open.
 */
export function useDragFromAnywhere( isActive ) {
	const canvasDocument = useCanvasDocument( DOCUMENT_REF, isActive );
	const doc = isActive ? canvasDocument : null;

	useEffect( () => {
		if ( ! doc ) {
			return;
		}

		const style = doc.createElement( 'style' );
		style.id = STYLE_ID;
		style.textContent = STYLES;
		doc.getElementById( STYLE_ID )?.remove();
		doc.head.appendChild( style );

		let hovered = null;
		// The press under way, while there is one.
		let press = null;

		function setHovered( node ) {
			if ( node === hovered ) {
				return;
			}
			hovered?.classList.remove( HOVER_CLASS );
			hovered = node;
			hovered?.classList.add( HOVER_CLASS );
		}

		function onMouseOver( event ) {
			if ( press || event.buttons ) {
				return;
			}
			const node = getDraggableBlock( event.target );
			setHovered( node && ! isEditing( node ) ? node : null );
		}

		// A click into a block makes it editable, so its outline goes.
		function onSelectionChange() {
			if ( hovered && isEditing( hovered ) ) {
				setHovered( null );
			}
		}

		// Takes the fields under the press out of editing, so the browser
		// drags the block rather than placing a caret or selecting text.
		function takeOutOfEditing() {
			for ( const element of press.editables ) {
				element.contentEditable = 'false';
			}
		}

		function restore() {
			if ( ! press ) {
				return;
			}
			const { node, editables, hadDraggable, hadTabIndex } = press;
			for ( const element of editables ) {
				element.contentEditable = 'true';
			}
			if ( hadDraggable === null ) {
				node.removeAttribute( 'draggable' );
			} else {
				node.setAttribute( 'draggable', hadDraggable );
			}
			if ( hadTabIndex === null ) {
				node.removeAttribute( 'tabindex' );
			}
			node.classList.remove( PRESSED_CLASS );
			press = null;
		}

		function onMouseDown( event ) {
			if (
				event.button !== 0 ||
				event.shiftKey ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey
			) {
				return;
			}
			// A double click needs no check of its own: the first click put
			// the caret in the block, so the second is left to the browser.
			const node = getDraggableBlock( event.target );
			if ( ! node || isEditing( node ) ) {
				return;
			}

			press = {
				node,
				x: event.clientX,
				y: event.clientY,
				hasDragged: false,
				hadDraggable: node.getAttribute( 'draggable' ),
				hadTabIndex: node.getAttribute( 'tabindex' ),
				editables: [
					// The canvas body, while it is the editing host.
					node.parentElement?.closest( '[contenteditable="true"]' ),
					node.matches( '[contenteditable="true"]' ) ? node : null,
					...node.querySelectorAll( '[contenteditable="true"]' ),
				].filter(
					( element, index, all ) =>
						element && all.indexOf( element ) === index
				),
			};
			takeOutOfEditing();
			// Rich text unsets `draggable`, and with its text out of editing
			// leaves no `tabindex`, on a block that is itself the field, such
			// as a Paragraph.
			node.setAttribute( 'draggable', 'true' );
			if ( press.hadTabIndex === null ) {
				node.setAttribute( 'tabindex', '-1' );
			}
			node.classList.add( PRESSED_CLASS );
			setHovered( null );

			// Core's drag needs the block selected and focused. Selecting with
			// no initial position doesn't move the caret. Render the selection
			// now, so core's drag handlers are attached before a fast drag
			// starts.
			flushSync( () =>
				dispatch( blockEditorStore ).selectBlock(
					node.dataset.block,
					null
				)
			);
			node.focus( { preventScroll: true } );
		}

		// Before core's own handler on the block: selecting the block can
		// make the canvas body the editing host again, and the press may
		// have moved focus.
		function onDragStart() {
			if ( ! press ) {
				return;
			}
			press.hasDragged = true;
			takeOutOfEditing();
			press.node.focus( { preventScroll: true } );
		}

		function onMouseUp() {
			if ( ! press ) {
				return;
			}
			const { hasDragged, x, y } = press;
			restore();
			if ( ! hasDragged ) {
				placeCaretAtPoint( doc, x, y );
			}
		}

		doc.addEventListener( 'mouseover', onMouseOver );
		doc.addEventListener( 'selectionchange', onSelectionChange );
		doc.addEventListener( 'mousedown', onMouseDown, true );
		doc.addEventListener( 'dragstart', onDragStart, true );
		doc.addEventListener( 'mouseup', onMouseUp );
		doc.addEventListener( 'dragend', restore );

		return () => {
			restore();
			setHovered( null );
			style.remove();
			doc.removeEventListener( 'mouseover', onMouseOver );
			doc.removeEventListener( 'selectionchange', onSelectionChange );
			doc.removeEventListener( 'mousedown', onMouseDown, true );
			doc.removeEventListener( 'dragstart', onDragStart, true );
			doc.removeEventListener( 'mouseup', onMouseUp );
			doc.removeEventListener( 'dragend', restore );
		};
	}, [ doc ] );
}
