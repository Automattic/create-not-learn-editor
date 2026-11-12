/**
 * Keeps the section in a mode in step with the editor: the header or footer
 * core opens, a part asked for from outside, Compose, undo and selection.
 */

/**
 * WordPress dependencies
 */

/**
 * Internal dependencies
 */
import {
	blockEditorStore,
	useEffect,
	useSelect,
} from '../../wordpress-packages';
import { scrollCanvasTo } from '../compose/use-block-rects';
import {
	STORE_NAME as CANVAS_STORE,
	requestOpenPart,
	setOpenPart,
} from '../mode';
import { MODE_CONTENT, MODE_FREEFORM, MODE_DESIGN } from './section-chrome';

// Takes the layer's state and actions it needs, by name.
export function useModeSync( {
	active,
	activePart,
	activeRef,
	editedSection,
	editorRef,
	enterMode,
	exists,
	exitMode,
	findTarget,
	groupedById,
	isComposing,
	isOpen,
	isTextSection,
	parts,
	passesOtherClicks,
	registry,
	selectedId,
	setActive,
	setPickedSection,
	targets,
} ) {
	/*
	 * The header or footer open in Edit content or Freeform, for the editor
	 * extension that opens its blocks. Noted just before core opens it, in
	 * `enterMode` and `enterFreeform`, and cleared here once it closes, however
	 * it does, after core has closed it.
	 */
	const openPartId =
		activePart && active.mode !== MODE_DESIGN ? active.id : null;
	useEffect( () => {
		if ( ! openPartId ) {
			setOpenPart( null );
		}
	}, [ openPartId ] );
	useEffect( () => () => setOpenPart( null ), [] );

	/*
	 * Code outside the canvas asked for the header or footer to be opened,
	 * as Edit header or Edit footer does. Taken up once the part is on this
	 * canvas, in Edit, where it can open.
	 */
	const partRequest = useSelect(
		( select ) => select( CANVAS_STORE ).getPartRequest(),
		[]
	);
	const requestedPartId =
		( partRequest &&
			! isComposing &&
			parts.find(
				( part ) =>
					part.area === partRequest && targets.has( part.clientId )
			)?.clientId ) ||
		null;
	useEffect( () => {
		if ( ! requestedPartId ) {
			return;
		}

		requestOpenPart( null );

		if ( activeRef.current?.id !== requestedPartId ) {
			enterMode( requestedPartId, MODE_CONTENT );
		}

		// Nobody clicked it, so it may be out of sight.
		scrollCanvasTo( editorRef, requestedPartId );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ requestedPartId ] );

	// Compose works on layouts, colours and the page's order: Edit content
	// and Freeform give way to it, the section staying picked.
	useEffect( () => {
		if ( isComposing && activeRef.current?.mode !== undefined ) {
			if ( activeRef.current.mode !== MODE_DESIGN ) {
				exitMode();
			}
		}
	}, [ activeRef, exitMode, isComposing ] );

	// The section went, as on undo or delete: so does its mode.
	useEffect( () => {
		if ( active && ! exists ) {
			setActive( null );
		}
	}, [ active, exists, setActive ] );

	// Core's own Done on a section it opened ends Freeform, the section
	// staying picked, and Edit content on a header or footer.
	useEffect( () => {
		if ( ! active || editedSection === active.id ) {
			return;
		}

		if ( active.mode === MODE_FREEFORM ) {
			exitMode();
		} else if ( activePart && active.mode === MODE_CONTENT ) {
			setActive( null );
		}
	}, [ active, activePart, editedSection, exitMode, setActive ] );

	/*
	 * Nothing outside the section being edited in place stays selected in
	 * core. A section selected while no section is in a mode, as the
	 * picker selects the one it adds, is picked instead, and brought into
	 * view.
	 */
	useEffect( () => {
		if ( ! selectedId ) {
			return;
		}

		const target = findTarget( selectedId );

		// A section's own block, when it holds others, is never selected in
		// core, so core's toolbar for it never shows: its blocks are what is
		// edited. A section that is a single block is that block.
		const isSectionItself =
			selectedId === target &&
			! isTextSection( target ) &&
			registry.select( blockEditorStore ).getBlockOrder( target ).length >
				0;

		if ( isOpen( target ) && ! isSectionItself ) {
			return;
		}

		if ( isOpen( target ) ) {
			registry.dispatch( blockEditorStore ).clearSelectedBlock();
			return;
		}

		if ( ! target && passesOtherClicks ) {
			return;
		}

		registry.dispatch( blockEditorStore ).clearSelectedBlock();

		if ( target && ! activeRef.current ) {
			setPickedSection( target );
			// Once a section just added is drawn.
			window.requestAnimationFrame( () =>
				window.requestAnimationFrame( () =>
					scrollCanvasTo( editorRef, target )
				)
			);
		}
		// `isOpen` reads the latest mode from its ref, set as `active` is, and
		// `isTextSection` the sections, as `groupedById` holds them.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ active, editorRef, findTarget, groupedById, registry, selectedId ] );
}
