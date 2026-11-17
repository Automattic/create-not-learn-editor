/**
 * Stepping through a section's, header's or footer's design choices, and a
 * header's or footer's way into Freeform.
 */

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import { blockEditorStore, useCallback } from '../../wordpress-packages';
import { PART_FREEFORM, setOpenPart } from '../mode';
import { getParentView } from './design-bar';
import { MODE_FREEFORM } from './section-chrome';

// Takes the layer's state and actions it needs, by name.
export function useDesignMode( {
	activeRef,
	exitMode,
	partsById,
	registry,
	setActive,
} ) {
	// From a header's or footer's More control into Freeform, which Done,
	// Escape or a click elsewhere leaves, as Edit content.
	const enterFreeform = useCallback( () => {
		const actions = unlock( registry.dispatch( blockEditorStore ) );
		const { id } = activeRef.current;

		actions.clearSelectedBlock();

		// A header or footer opens completely, with core's own unlock.
		if ( partsById[ id ] ) {
			setOpenPart( id, PART_FREEFORM );
		}

		actions.editContentOnlySection( id );
		setActive( ( current ) => ( {
			...current,
			mode: MODE_FREEFORM,
			view: null,
		} ) );
	}, [ activeRef, partsById, registry, setActive ] );

	// The design choice drilled into in Edit design's bar, or null for the
	// choices. In an open header or footer, a block picked in it lets go,
	// so its own tools, like a link's, don't sit over the choice.
	const setDesignView = useCallback(
		( view ) => {
			if ( view && partsById[ activeRef.current?.id ] ) {
				registry.dispatch( blockEditorStore ).clearSelectedBlock();
			}

			setActive( ( current ) => current && { ...current, view } );
		},
		[ activeRef, partsById, registry, setActive ]
	);

	// Escape leaves the mode, or steps back from a design choice to the
	// choices, in Edit design or an open header or footer.
	const escapeMode = useCallback( () => {
		if ( activeRef.current?.view ) {
			setDesignView( getParentView( activeRef.current.view ) );
		} else {
			exitMode();
		}
	}, [ activeRef, exitMode, setDesignView ] );

	return { enterFreeform, escapeMode, setDesignView };
}
