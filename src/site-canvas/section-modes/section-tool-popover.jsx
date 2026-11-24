/**
 * What a section's toolbar opens under it: the options for its Layout,
 * Colour or Width, or Layers, the blocks inside it, which its name opens.
 * The toolbar (`src/block-toolbar/section-controls.jsx` and `name-menu.js`)
 * says which is open, through the canvas's store, and this draws it in a
 * popover hung from the button, or the name.
 *
 * Layers is core's List View rooted at the section, so it lists only what
 * is in it. The public List View always lists the whole page, so this is
 * core's private one. See `docs/editor-workarounds.md`.
 */

/**
 * WordPress dependencies
 */
import { privateApis as blockEditorPrivateApis } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import { Popover, useMemo, useRef } from '../../wordpress-packages';
import { setSectionTool } from '../mode';
import { SectionDesignOptions } from './design-bar';

const { PrivateListView } = unlock( blockEditorPrivateApis );

const LAYERS = 'layers';
// Other popovers opened from this one, like a custom colour's palette, and
// the toolbar's own buttons, which open, close and swap what is here.
const STAYS_OPEN_FOR =
	'.components-popover, [data-cnl-section-tool], .block-editor-block-switcher';
// The section's name on its toolbar, which Layers hangs from.
const NAME =
	'.block-editor-block-contextual-toolbar .block-editor-block-switcher .components-dropdown-menu__toggle';
// How long a new layout has to take the old one's place and be selected.
const REPLACE_GRACE = 500;

/**
 * @param {Object}   props
 * @param {Object}   props.tool       `{ clientId, view }`: the section, and
 *                                    which of its tools is open.
 * @param {Function} props.onReplaced Called with the section's client ID and
 *                                    the block that took its place, when its
 *                                    layout changes.
 * @return {Element} The popover.
 */
export function SectionToolPopover( { tool, onReplaced } ) {
	const { clientId, view } = tool;
	const lastRect = useRef( null );
	const isReplacing = useRef( false );
	// The button is drawn again whenever the toolbar is, so it is looked up
	// each time rather than held.
	const anchor = useMemo(
		() => ( {
			getBoundingClientRect() {
				const button = document.querySelector(
					view === LAYERS
						? NAME
						: `[data-cnl-section-tool="${ view }"]`
				);

				if ( button ) {
					lastRect.current = button.getBoundingClientRect();
				}

				return lastRect.current ?? new window.DOMRect();
			},
			ownerDocument: document,
		} ),
		[ view ]
	);

	return (
		<Popover
			anchor={ anchor }
			className="cnl-section-tool-popover"
			offset={ 8 }
			onClose={ () => setSectionTool( null ) }
			onFocusOutside={ ( event ) => {
				if (
					! isReplacing.current &&
					! event.relatedTarget?.closest?.( STAYS_OPEN_FOR )
				) {
					setSectionTool( null );
				}
			} }
			placement="bottom-start"
			resize={ false }
		>
			<div
				className={ `cnl-section-modes cnl-section-tool-panel is-${ view }` }
			>
				{ view === LAYERS ? (
					<PrivateListView isExpanded rootClientId={ clientId } />
				) : (
					<SectionDesignOptions
						clientId={ clientId }
						onReplace={ ( next ) => {
							// Core selects the new section and moves focus
							// to it, which mustn't close its layouts.
							isReplacing.current = true;
							window.setTimeout( () => {
								isReplacing.current = false;
							}, REPLACE_GRACE );

							onReplaced( clientId, next );
							setSectionTool( { clientId: next.clientId, view } );
						} }
						view={ view }
					/>
				) }
			</div>
		</Popover>
	);
}
