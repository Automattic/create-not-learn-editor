/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

// Room kept for the placeholder on an empty page.
export const EMPTY_SPACE = 320;

/**
 * Styles the layer adds to the canvas: no text cursor, hover outline or
 * block name outside the section being edited in place, none of core's
 * outline around the page's content as a whole, room for the placeholder on
 * an empty page, the rest of the page faded around a section core has
 * opened, and, composing, a hand to grab sections with.
 *
 * @param {string[]} openIds      The blocks of the section whose blocks can
 *                                be clicked: one, but for a run of text.
 * @param {?string}  rootClientId The sections' parent.
 * @param {boolean}  isEmpty      Whether the page has nothing in it.
 * @param {?string}  compose      While composing, `grab`, or `dragging` while
 *                                a section is dragged.
 * @param {string[]} fadedIds     The blocks faded around a section core has
 *                                opened.
 * @param {?Object}  gap          The gap opened for adding a section in
 *                                place: `{ clientId, isAfter, height }`, the
 *                                section it opens before, or after at the
 *                                page's end, and its height on screen.
 * @param {string[]} lockedIds    The sections locked to their content,
 *                                which take no new block but a line of
 *                                text, unlike a blank section or a run of
 *                                text.
 * @return {string} CSS.
 */
export function getCanvasCss(
	openIds,
	rootClientId,
	isEmpty,
	compose,
	fadedIds,
	gap,
	lockedIds
) {
	const outside = openIds
		.map( ( id ) => `:not(#block-${ id }):not(#block-${ id } *)` )
		.join( '' );
	const sections = rootClientId
		? `#block-${ rootClientId } > .block-editor-block-list__block`
		: null;

	return [
		`.is-root-container *${ outside } { cursor: default !important; }`,
		`.is-root-container .block-editor-block-list__block${ outside }.is-hovered::after { display: none !important; }`,
		// The block names shown on hover, from `block-canvas-styles.php`,
		// but not the badge on a change an agent made.
		`.is-root-container .block-editor-block-list__block${ outside }:not([data-cnl-change]):hover::before { content: none !important; }`,
		rootClientId &&
			`#block-${ rootClientId }.is-hovered::after { display: none !important; }`,
		/*
		 * Core prompts an empty line to type "/" for a block, but a section
		 * locked to its content takes no other block that way, so there the
		 * prompt points to the section's Add instead.
		 */
		lockedIds.length > 0 &&
			`.is-root-container :is(${ lockedIds
				.map( ( id ) => `#block-${ id }` )
				.join( ', ' ) }) [data-rich-text-placeholder=${ JSON.stringify(
				__( 'Type / to choose a block' )
			) }]::after { content: ${ JSON.stringify(
				__( 'Type here, or use Add for a heading, button or image' )
			) }; }`,
		// An empty page keeps room for its placeholder, in place of core's
		// prompt to type, the only thing core draws there.
		rootClientId &&
			isEmpty &&
			`#block-${ rootClientId } { min-height: ${ EMPTY_SPACE }px !important; }
			#block-${ rootClientId } > * { visibility: hidden !important; }`,
		/*
		 * Core fades the page around a section it has opened, but expects
		 * the section selected, and fades it too until something in it is.
		 * The layer never selects a section's own block, so the fade is
		 * drawn here instead, as core leaves it once something in the
		 * section is selected: the section and what holds it clear, the rest
		 * of the page faded. The selectors are kept light, so a canvas's own
		 * spotlight, like the Header screen's, still fades the page its own
		 * way.
		 */
		fadedIds.length > 0 &&
			`:where(.is-focus-mode) .block-editor-block-list__block { opacity: 1 !important; }
			.is-focus-mode :where(${ fadedIds
				.map( ( id ) => `#block-${ id }` )
				.join( ', ' ) }) { opacity: 0.2 !important; }`,
		// Composing, sections are grabbed to move them, and none of core's
		// zoomed-out separators and prompts show.
		compose &&
			`.block-editor-block-list__zoom-out-separator,
			.block-list-appender,
			.block-editor-default-block-appender { display: none !important; }`,
		compose &&
			sections &&
			`${ sections }, ${ sections } * { cursor: ${
				compose === 'dragging' ? 'grabbing' : 'grab'
			} !important; }`,
		// The gap for adding a section in place, opening as the sections
		// move apart. Its height is on screen, so zoomed out it is scaled
		// up by as much as core scales the page down.
		gap &&
			`#block-${ gap.clientId } {
				margin-block-${ gap.isAfter ? 'end' : 'start' }: ${ gap.height }px !important;
				transition: margin var(--wpds-motion-duration-md, 200ms) ease-out;
			}
			html.is-zoomed-out #block-${ gap.clientId } {
				margin-block-${ gap.isAfter ? 'end' : 'start' }: calc(${
					gap.height
				}px / var(--wp-block-editor-iframe-zoom-out-scale, 1)) !important;
			}
			@media (prefers-reduced-motion: reduce) {
				#block-${ gap.clientId } { transition: none; }
			}`,
	]
		.filter( Boolean )
		.join( '\n' );
}
