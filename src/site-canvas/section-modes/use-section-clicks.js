/**
 * How clicks, double clicks and Escape on the canvas pick a section and go
 * into it a level at a time.
 */

/**
 * WordPress dependencies
 */

/**
 * Internal dependencies
 */
import { blockEditorStore, useEffect } from '../../wordpress-packages';
import { getCanvasFrame } from '../compose/use-block-rects';
import { MODE_CONTENT, MODE_DESIGN } from './section-chrome';
import { useCanvasGuard } from './use-canvas-events';
import { getBlockAtPoint } from './placement';
import { FOCUS_FRAMES } from './layer-constants';

// Takes the layer's state and actions it needs, by name.
export function useSectionClicks( {
	activeRef,
	activeRowRef,
	canvasDocument,
	editorRef,
	enterMode,
	escapeMode,
	exitMode,
	findTarget,
	inlineAdd,
	isComposing,
	leaveCompose,
	onExitCompose,
	partsById,
	passesOtherClicks,
	pickedRef,
	pickedSection,
	registry,
	rowsRef,
	setActiveRowId,
	setInlineAdd,
	setPickedSection,
} ) {
	// Select a block, or the nearest one around it that can be, and put the
	// caret in it if it has text.
	const selectSoon = ( clientId ) => {
		const store = registry.select( blockEditorStore );
		let target = clientId;

		while ( target && store.getBlockEditingMode( target ) === 'disabled' ) {
			target = store.getBlockRootClientId( target );
		}

		if ( target ) {
			registry.dispatch( blockEditorStore ).selectBlock( target, 0 );
			focusSoon( target );
		}
	};

	/*
	 * Put the caret at a point on the page, or select the block there when
	 * it has no text, like a picture. Tried again for a few frames while
	 * core opens a header or footer, whose blocks can't be picked until it
	 * has.
	 */
	const placeCaret = ( doc, x, y, blockId, frames = 0 ) => {
		const editable = doc
			.elementFromPoint( x, y )
			?.closest( '[contenteditable="true"]' );

		if ( editable ) {
			const range = doc.caretRangeFromPoint?.( x, y );
			const selection = doc.defaultView.getSelection();

			editable.focus();

			if ( range && selection ) {
				selection.removeAllRanges();
				selection.addRange( range );
			}

			return;
		}

		const store = registry.select( blockEditorStore );
		const isReady =
			! blockId || store.getBlockEditingMode( blockId ) !== 'disabled';

		if ( ! isReady && frames < FOCUS_FRAMES ) {
			window.requestAnimationFrame( () =>
				placeCaret( doc, x, y, blockId, frames + 1 )
			);
			return;
		}

		// No text there: the nearest block that can be picked.
		let clientId = blockId;

		while (
			clientId &&
			store.getBlockEditingMode( clientId ) === 'disabled'
		) {
			clientId = store.getBlockRootClientId( clientId );
		}

		if ( clientId ) {
			registry.dispatch( blockEditorStore ).selectBlock( clientId );
		}
	};

	const isOpen = ( target ) =>
		Boolean(
			activeRef.current &&
			activeRef.current.mode !== MODE_DESIGN &&
			target === activeRef.current.id
		);

	// The row of cards a block is in, or is, in the section picked.
	const getRowOf = ( blockId ) => {
		const rowIds = rowsRef.current.map( ( row ) => row.clientId );
		let clientId = blockId;

		while ( clientId ) {
			if ( rowIds.includes( clientId ) ) {
				return clientId;
			}

			clientId = registry
				.select( blockEditorStore )
				.getBlockRootClientId( clientId );
		}

		return null;
	};

	/*
	 * Clicks reach a section whose blocks are open, but a click on a row of
	 * cards other than the one open opens that row first, as the second
	 * level in.
	 */
	const allowsClick = ( target, blockId ) => {
		if ( ! target && passesOtherClicks ) {
			return true;
		}

		if ( ! isOpen( target ) ) {
			return false;
		}

		if ( activeRef.current.mode !== MODE_CONTENT || partsById[ target ] ) {
			return true;
		}

		const row = getRowOf( blockId );

		return ! row || row === activeRowRef.current;
	};

	// Put the caret at the point clicked, once the section takes clicks.
	const openAt = ( target, event, blockId ) => {
		const doc = event.target.ownerDocument;
		const { clientX: x, clientY: y } = event;

		if ( activeRef.current?.mode !== MODE_CONTENT ) {
			enterMode( target, MODE_CONTENT );
		}

		window.requestAnimationFrame( () =>
			window.requestAnimationFrame( () =>
				placeCaret( doc, x, y, blockId )
			)
		);
	};

	// A click on the blocks outside the template parts, which reaches
	// them, leaves any part open or picked, as a click elsewhere does on a
	// page.
	useEffect( () => {
		if ( ! passesOtherClicks || ! canvasDocument ) {
			return undefined;
		}

		const onPointerDown = ( event ) => {
			const block = event.target.closest?.( '[data-block]' );

			if ( block && findTarget( block.dataset.block ) ) {
				return;
			}

			if ( activeRef.current ) {
				exitMode();
			}

			setPickedSection( null );
		};

		canvasDocument.addEventListener( 'pointerdown', onPointerDown, true );

		return () =>
			canvasDocument.removeEventListener(
				'pointerdown',
				onPointerDown,
				true
			);
	}, [
		activeRef,
		canvasDocument,
		exitMode,
		findTarget,
		passesOtherClicks,
		setPickedSection,
	] );

	useCanvasGuard( {
		allows: allowsClick,
		canvasDocument,
		findTarget,
		isActive: true,
		/*
		 * A click on a section picks it. On the section picked, it goes a
		 * level in: to the row of cards it lands on, then to the block. A
		 * click anywhere else picks what it lands on, or nothing, leaving
		 * any mode.
		 */
		onBlocked: ( target, event ) => {
			const current = activeRef.current;
			const held =
				current?.mode === MODE_CONTENT
					? current.id
					: ! current && pickedRef.current;

			setInlineAdd( null );

			if (
				target &&
				target === held &&
				! partsById[ target ] &&
				! isComposing
			) {
				const blockId =
					event.target.closest?.( '[data-block]' )?.dataset.block;
				const row = getRowOf( blockId );

				if ( row && row !== activeRowRef.current ) {
					if ( current ) {
						exitMode();
					}

					setActiveRowId( row );
					return;
				}

				if ( ! row ) {
					setActiveRowId( null );
				}

				openAt( target, event, blockId );
				return;
			}

			if ( current ) {
				exitMode();
			}

			setActiveRowId( null );
			setPickedSection( target );
		},
		// A double click goes straight to the block, with the caret where it
		// landed, or the block there selected, like a picture. Not on a
		// header or footer, which is opened on purpose.
		onDoubleClick: ( target, event ) => {
			const doc = event.target.ownerDocument;
			const { clientX: x, clientY: y } = event;
			const blockId =
				event.target.closest( '[data-block]' )?.dataset.block;

			// Composing, the point moves as the page zooms in, so the block
			// under it now is selected once it has.
			if ( isComposing ) {
				const innerId = getBlockAtPoint( doc, x, y ) || blockId;

				leaveCompose( () => {
					enterMode( target, MODE_CONTENT );

					window.requestAnimationFrame( () =>
						window.requestAnimationFrame( () =>
							selectSoon( innerId )
						)
					);
				} );
				return;
			}

			if ( partsById[ target ] ) {
				return;
			}

			setActiveRowId( getRowOf( blockId ) );
			enterMode( target, MODE_CONTENT );

			// Once the section takes clicks, and core has opened it.
			window.requestAnimationFrame( () =>
				window.requestAnimationFrame( () =>
					placeCaret( doc, x, y, blockId )
				)
			);
		},
		// Escape leaves Edit content or Edit design, the section staying
		// picked, and steps back from a design choice to the choices.
		onEscape: ( event ) => {
			const current = activeRef.current;

			if ( inlineAdd ) {
				event.preventDefault();
				setInlineAdd( null );
				return;
			}

			if ( ! current ) {
				if ( activeRowRef.current ) {
					event.preventDefault();
					setActiveRowId( null );
				} else if ( pickedSection ) {
					event.preventDefault();
					setPickedSection( null );
				} else if ( isComposing ) {
					event.preventDefault();
					onExitCompose();
				}

				return;
			}

			event.preventDefault();
			event.stopPropagation();
			// Out of the text too, or core selects its block again.
			event.target.ownerDocument.activeElement?.blur();

			escapeMode();
		},
	} );

	/*
	 * Put the caret in a new block as soon as it is drawn, so typing straight
	 * away lands in it rather than scrolling the page. Kept there for a
	 * moment, as the section's lock redraws it, unless the selection moves
	 * on first.
	 */
	const focusSoon = ( clientId ) => {
		let frames = 0;
		const focus = () => {
			const doc = getCanvasFrame( editorRef.current )?.contentDocument;
			const block = doc?.getElementById( `block-${ clientId }` );
			// The text itself, which in a button sits inside the block.
			const node = block?.matches( '[contenteditable="true"]' )
				? block
				: block?.querySelector( '[contenteditable="true"]' ) || block;
			const isSelected =
				registry
					.select( blockEditorStore )
					.getSelectedBlockClientId() === clientId;

			if ( ! isSelected ) {
				return;
			}

			if ( node && doc.activeElement !== node ) {
				node.focus();
			}

			if ( ++frames < FOCUS_FRAMES ) {
				window.requestAnimationFrame( focus );
			}
		};

		window.requestAnimationFrame( focus );
	};

	return { isOpen, getRowOf, focusSoon };
}
