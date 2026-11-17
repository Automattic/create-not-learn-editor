/**
 * A section in Edit is worked on with core's own block toolbar: while it is
 * picked, its block is selected in core, and the toolbar's Layout, Colour
 * and Width ask for that design choice, which opens in a bar over the
 * section. See `src/block-toolbar/section-controls.jsx`.
 */

/**
 * Internal dependencies
 */
import { blockEditorStore, useEffect } from '../../wordpress-packages';
import { requestSectionDesign, useDesignRequest } from '../mode';
import { MODE_DESIGN } from './section-chrome';

// Takes the layer's state and actions it needs, by name.
export function useSectionToolbar( {
	active,
	enterMode,
	focusId,
	isComposing,
	isTextSection,
	pickedSection,
	registry,
	sectionIds,
	setActive,
} ) {
	/*
	 * Not a run of text, which has no block of its own, nor zoomed out,
	 * where core's toolbar is hidden, nor on a canvas about one part.
	 */
	const usesToolbar = ( clientId ) =>
		Boolean( clientId ) &&
		! isComposing &&
		! focusId &&
		sectionIds.includes( clientId ) &&
		! isTextSection( clientId );
	const toolbarId =
		! active && usesToolbar( pickedSection ) ? pickedSection : null;

	// Core's selection follows the section picked, and lets go of a section
	// once it isn't.
	useEffect( () => {
		if ( active || isComposing ) {
			return;
		}

		const selected = registry
			.select( blockEditorStore )
			.getSelectedBlockClientId();

		if ( toolbarId ) {
			if ( selected !== toolbarId ) {
				// No initial position, so core leaves focus and the scroll
				// where they are.
				registry
					.dispatch( blockEditorStore )
					.selectBlock( toolbarId, null );
			}
		} else if ( selected && sectionIds.includes( selected ) ) {
			registry.dispatch( blockEditorStore ).clearSelectedBlock();
		}
		// `sectionIds` is read as the section picked changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ active, isComposing, registry, toolbarId ] );

	// One of a section's design choices, asked for from its toolbar. Marked
	// `direct`, so Back leads to the toolbar rather than a list of choices.
	const designRequest = useDesignRequest();

	useEffect( () => {
		if ( ! designRequest ) {
			return;
		}

		requestSectionDesign( null );

		if ( sectionIds.includes( designRequest.clientId ) ) {
			enterMode( designRequest.clientId, MODE_DESIGN );
			setActive( {
				direct: true,
				id: designRequest.clientId,
				mode: MODE_DESIGN,
				view: designRequest.view,
			} );
		}
		// The sections and `enterMode` are read as the request arrives.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ designRequest ] );

	return { toolbarId, usesToolbar };
}
