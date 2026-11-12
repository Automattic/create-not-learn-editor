/**
 * The layer's side effects on the editor and the window: classes, the
 * spotlight, Escape and outside clicks, measuring, wheel and highlighting.
 */

/**
 * WordPress dependencies
 */

/**
 * Internal dependencies
 */
import { GLOBAL_CANVAS_CSS } from '../../global-scope';
import { useEffect } from '../../wordpress-packages';
import { getCanvasFrame, scrollCanvasTo } from '../compose/use-block-rects';
import { useEditorSpotlight } from '../part-spotlight';
import { useCanvasStyles } from '../use-canvas-styles';
import { MODE_CONTENT, MODE_DESIGN } from './section-chrome';
import { INSET } from './placement';
import {
	GLOBAL_STYLE_ID,
	INLINE_ADD_SETTLE_MS,
	FRESH_MS,
} from './layer-constants';

// Takes the layer's state and actions it needs, by name.
export function useLayerEffects( {
	active,
	activePart,
	activeRowRef,
	canvasDocument,
	chromeNode,
	drag,
	editorRef,
	escapeMode,
	exitMode,
	focusId,
	freshId,
	host,
	inlineAdd,
	inlineAddNode,
	isComposing,
	layerRef,
	lockedIds,
	onExitCompose,
	pickedSection,
	sectionIds,
	setActiveRowId,
	setChromeSize,
	setFreshId,
	setInlineAdd,
	setInlineAddHeight,
	setPickedSection,
} ) {
	// Working on the words in a section locked to its content, its "+"
	// beside an empty line is hidden, as it can only add another.
	const isEditingLockedSection =
		active?.mode === MODE_CONTENT && lockedIds.includes( active.id );

	useEffect( () => {
		const editor = editorRef.current;

		if ( ! isEditingLockedSection || ! editor ) {
			return undefined;
		}

		editor.classList.add( 'is-editing-locked-section' );

		return () => editor.classList.remove( 'is-editing-locked-section' );
	}, [ editorRef, isEditingLockedSection ] );

	/*
	 * A header or footer in a mode is put in the spotlight, the rest of the
	 * page faded and dimmed, as on the Header and Footer screens, so it looks
	 * the same however it is reached. A canvas about one part, like those
	 * screens', keeps it in the spotlight itself.
	 */
	useEditorSpotlight( {
		area: activePart?.area,
		canvasDocument,
		clientId: activePart && ! focusId ? active.id : null,
	} );

	// Core's own inserter between blocks would offer a second way to add
	// in the same gap, so it is hidden while the picker is open.
	useEffect( () => {
		const editor = editorRef.current;

		if ( ! inlineAdd || ! editor ) {
			return undefined;
		}

		editor.classList.add( 'is-adding-section-inline' );

		return () => editor.classList.remove( 'is-adding-section-inline' );
	}, [ editorRef, inlineAdd ] );

	// Dragging a section, or the sections going, closes the gap.
	useEffect( () => {
		if ( inlineAdd && ( drag || ! sectionIds.length ) ) {
			setInlineAdd( null );
		}
	}, [ drag, inlineAdd, sectionIds.length, setInlineAdd ] );

	// A header or footer's blocks are picked out in purple while it is open.
	useCanvasStyles( GLOBAL_STYLE_ID, activePart ? GLOBAL_CANVAS_CSS : null );

	// Composing, Escape with nothing picked leaves for Edit, from wherever
	// focus is, but not from a dialog or popover's own Escape.
	useEffect( () => {
		if ( ! isComposing || pickedSection || active ) {
			return undefined;
		}

		const onKeyDown = ( event ) => {
			if (
				event.key !== 'Escape' ||
				event.defaultPrevented ||
				event.target.closest?.(
					'.components-modal__frame, .components-popover, [role="dialog"]'
				)
			) {
				return;
			}

			onExitCompose();
		};

		window.addEventListener( 'keydown', onKeyDown );

		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ active, isComposing, onExitCompose, pickedSection ] );

	/*
	 * Escape leaves Edit content or Edit design from wherever focus was left,
	 * as when the button that opened the mode went and took focus with it,
	 * the section staying picked, or steps back a level, as `escapeMode` does.
	 * Not from a dialog or popover's own Escape.
	 */
	const isInMode = Boolean( active );

	useEffect( () => {
		if ( ! isInMode ) {
			return undefined;
		}

		const onKeyDown = ( event ) => {
			if (
				event.key !== 'Escape' ||
				event.defaultPrevented ||
				event.target.closest?.(
					'.components-modal__frame, .components-popover, [role="dialog"]'
				)
			) {
				return;
			}

			event.preventDefault();
			escapeMode();
		};

		window.addEventListener( 'keydown', onKeyDown );

		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ escapeMode, isInMode ] );

	/*
	 * Edit design has nothing to confirm, so a click anywhere off its bar
	 * leaves it, its changes kept: on the page, as for every mode, and
	 * anywhere else in the editor too. Not from a popover, like a tooltip.
	 */
	const isDesigning = active?.mode === MODE_DESIGN;

	useEffect( () => {
		if ( ! isDesigning ) {
			return undefined;
		}

		const doc = layerRef.current?.ownerDocument;
		const onPointerDown = ( event ) => {
			if (
				layerRef.current?.contains( event.target ) ||
				event.target.closest?.( '.components-popover' )
			) {
				return;
			}

			exitMode();
		};

		doc?.addEventListener( 'pointerdown', onPointerDown );

		return () => doc?.removeEventListener( 'pointerdown', onPointerDown );
	}, [ exitMode, isDesigning, layerRef ] );

	// Escape un-picks the section from wherever focus was left, as on the
	// page after Done, but not from a dialog or popover's own Escape.
	useEffect( () => {
		if ( ! pickedSection || active ) {
			return undefined;
		}

		const onKeyDown = ( event ) => {
			if (
				event.key !== 'Escape' ||
				event.defaultPrevented ||
				event.target.closest?.(
					'.components-modal__frame, .components-popover, [role="dialog"]'
				)
			) {
				return;
			}

			// The row of cards open closes first.
			if ( activeRowRef.current ) {
				setActiveRowId( null );
			} else {
				setPickedSection( null );
			}
		};

		window.addEventListener( 'keydown', onKeyDown );

		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [
		active,
		activeRowRef,
		pickedSection,
		setActiveRowId,
		setPickedSection,
	] );

	// The size of the panel or bar on the section in a mode, to place it and
	// steer the bins around it. Watched from whenever it mounts, as it does
	// again once a section that was swapped for another is measured.
	useEffect( () => {
		if ( ! chromeNode ) {
			setChromeSize( null );
			return undefined;
		}

		const observer = new window.ResizeObserver( () =>
			setChromeSize( {
				height: chromeNode.offsetHeight,
				width: chromeNode.offsetWidth,
			} )
		);

		observer.observe( chromeNode );

		return () => observer.disconnect();
	}, [ chromeNode, setChromeSize ] );

	// The height of the picker for adding a section in place, for the gap
	// it sits in.
	useEffect( () => {
		if ( ! inlineAddNode ) {
			setInlineAddHeight( null );
			return undefined;
		}

		const observer = new window.ResizeObserver( () =>
			setInlineAddHeight( inlineAddNode.offsetHeight )
		);

		observer.observe( inlineAddNode );

		return () => observer.disconnect();
	}, [ inlineAddNode, setInlineAddHeight ] );

	// Once its gap has opened, the picker for adding a section in place is
	// scrolled into view, if it isn't, keeping its top in view first.
	useEffect( () => {
		if ( ! inlineAddNode ) {
			return undefined;
		}

		const timer = window.setTimeout( () => {
			const iframe = getCanvasFrame( editorRef.current );

			if ( ! iframe || ! inlineAddNode.isConnected ) {
				return;
			}

			const box = inlineAddNode.getBoundingClientRect();
			const view = iframe.getBoundingClientRect();
			const above = box.top - view.top - INSET;
			const below = box.bottom - view.bottom + INSET;
			let delta = 0;

			if ( above < 0 ) {
				delta = above;
			} else if ( below > 0 ) {
				delta = Math.min( below, above );
			}

			if ( delta ) {
				const reduceMotion = window.matchMedia(
					'(prefers-reduced-motion: reduce)'
				).matches;

				iframe.contentWindow?.scrollBy( {
					behavior: reduceMotion ? 'auto' : 'smooth',
					top: delta,
				} );
			}
		}, INLINE_ADD_SETTLE_MS );

		return () => window.clearTimeout( timer );
	}, [ editorRef, inlineAddNode ] );

	// Scrolling over the layer scrolls the canvas under it.
	useEffect( () => {
		const layer = layerRef.current;

		if ( ! layer ) {
			return undefined;
		}

		const onWheel = ( event ) => {
			const view = getCanvasFrame( editorRef.current )?.contentWindow;

			const bar = event.target.closest( '.cnl-section-modes__design' );

			if (
				! view ||
				event.target.closest( '.components-popover' ) ||
				( bar && bar.scrollHeight > bar.clientHeight )
			) {
				return;
			}

			event.preventDefault();
			view.scrollBy( { left: 0, top: event.deltaY } );
		};

		layer.addEventListener( 'wheel', onWheel, { passive: false } );

		return () => layer.removeEventListener( 'wheel', onWheel );
	}, [ editorRef, host, layerRef ] );

	// A new item is highlighted a moment, and scrolled to.
	useEffect( () => {
		if ( ! freshId ) {
			return undefined;
		}

		const timer = window.setTimeout( () => setFreshId( null ), FRESH_MS );

		scrollCanvasTo( editorRef, freshId );

		return () => window.clearTimeout( timer );
	}, [ editorRef, freshId, setFreshId ] );
}
