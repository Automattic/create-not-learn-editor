/**
 * Internal dependencies
 */
import {
	blockEditorStore,
	cloneBlock,
	flushSync,
	useEffect,
	useRef,
	useRegistry,
} from '../../wordpress-packages';

/**
 * A section's layouts while they are picked between: shown on the canvas
 * while pointed at or focused, and put in when clicked.
 *
 * They are held as they were first offered. They are worked out from the
 * section's shape, so the layout picked would otherwise offer a different
 * set, in another order, and the cards would move under the pointer. A
 * section the picks didn't put in offers them afresh; undo and redo go back
 * to one they did, which keeps its own. The layout the section had when
 * they were first offered is marked, and picking it puts back the section
 * as it was.
 *
 * A layout pointed at goes in in place of the section as a passing change,
 * which core keeps out of undo and doesn't count as unsaved, and the section
 * goes back once nothing is. Before a pick goes in the section goes back,
 * so undo after it returns to the section, not to what was pointed at.
 * Both go in selected but not focused: focus would scroll the canvas to the
 * new section, taking the toolbar and the layouts with it.
 *
 * @param {?Object}  block     The section.
 * @param {?Object}  layouts   `{ current, options }` for it, or null.
 * @param {Function} onReplace Called with the block that takes the section's
 *                             place, and `{ isClosing }`, true when it is
 *                             put back as the layouts close.
 * @return {?Object} `{ current, original, options, onPreview, onSelect }`,
 *                   or null when there are none.
 */
export function useLayoutChoice( block, layouts, onReplace ) {
	const registry = useRegistry();
	const held = useRef( null );
	const latest = useRef();

	if (
		layouts &&
		( ! block || ! held.current?.sections.has( block.clientId ) )
	) {
		held.current = {
			options: layouts.options,
			original: { block, name: layouts.current },
			sections: new Map( [ [ block.clientId, layouts.current ] ] ),
			shown: null,
		};
	}

	const state = held.current;
	const isShown = block && state?.shown === block.clientId;

	if ( block && state?.sections.has( block.clientId ) && ! isShown ) {
		// The section as it stands, picked or put back by undo or redo.
		state.committed = { block, name: state.sections.get( block.clientId ) };
	}

	const replace = ( fromId, next, { isPassing, isClosing } = {} ) => {
		const { __unstableMarkNextChangeAsNotPersistent, replaceBlocks } =
			registry.dispatch( blockEditorStore );

		const run = () => {
			if ( isPassing ) {
				__unstableMarkNextChangeAsNotPersistent();
			}

			replaceBlocks( fromId, next, 0, null );
			onReplace( next, { isClosing } );
		};

		// The new section and the canvas's note of which section is picked
		// go in in one render, else the layouts close for want of their
		// section. A layout pointed at goes in from a timer, where React
		// wouldn't otherwise render them together. Not while closing, as
		// nothing is left open to close.
		if ( isClosing ) {
			run();
		} else {
			flushSync( run );
		}
	};

	// Puts the section back in place of a layout shown.
	const putBack = ( isClosing = false ) => {
		if ( state?.shown && state.committed ) {
			const { shown } = state;

			state.shown = null;
			replace( shown, state.committed.block, {
				isClosing,
				isPassing: true,
			} );
		}
	};

	latest.current = putBack;

	// Closing the layouts while one is shown puts the section back.
	useEffect( () => () => latest.current( true ), [] );

	if ( ! state?.committed ) {
		return null;
	}

	return {
		current: state.committed.name,
		original: state.original.name,
		options: state.options,
		onPreview: ( option ) => {
			if ( ! option || option.name === state.committed.name ) {
				putBack();
				return;
			}

			const next = cloneBlock( option.block );
			const from = state.shown ?? state.committed.block.clientId;

			// Marked as shown before it goes in, so it is never taken for
			// a pick.
			state.sections.set( next.clientId, option.name );
			state.shown = next.clientId;
			replace( from, next, { isPassing: true } );
		},
		onSelect: ( option ) => {
			const next = cloneBlock(
				option.name === state.original.name
					? state.original.block
					: option.block
			);

			putBack();
			state.sections.set( next.clientId, option.name );
			replace( state.committed.block.clientId, next );
		},
	};
}
