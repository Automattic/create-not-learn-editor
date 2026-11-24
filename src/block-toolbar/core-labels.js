/**
 * Core's toolbar controls and menu items that have no class, data attribute
 * or slot of their own to find them by, found by their labels instead.
 *
 * Each label is translated here, with the same string and context core uses,
 * so it is compared in the site's language, and the gettext filters that
 * reword core (`section-wording.js`) reword it here too. Labels aren't an
 * API, so each one is a drift canary: see the README and
 * `docs/editor-workarounds.md`.
 *
 * The stylesheet's rules that need them are written into a `<style>` of
 * their own, `cnl-block-toolbar-labels`, and written again whenever the
 * translations change, as they do when the editor's scripts load theirs.
 */

/**
 * WordPress dependencies
 */
import { __, _x, subscribe } from '@wordpress/i18n';

const STYLE_ID = 'cnl-block-toolbar-labels';

const TOOLBAR =
	'html.cnl-has-block-toolbar .components-popover .block-editor-block-contextual-toolbar';

/**
 * Core's style controls, which move to the options or Layout menu.
 *
 * @return {string[]} Labels, in the site's language.
 */
export function getStyleControlLabels() {
	return [
		__( 'Align text' ),
		__( 'Align block' ),
		__( 'Align' ),
		__( 'Font size' ),
		__( 'Change items justification' ),
		__( 'Align content vertically' ),
		__( 'Change vertical alignment' ),
		__( 'Apply duotone filter' ),
	];
}

/**
 * Icons people know from across the web, which keep their place.
 *
 * @return {string[]} Labels, in the site's language.
 */
export function getWellKnownLabels() {
	return [
		__( 'Link' ),
		__( 'Unlink' ),
		__( 'Bold' ),
		__( 'Italic' ),
		__( 'Delete' ),
		__( 'Remove' ),
	];
}

/**
 * Core's format buttons, which mark the format group. Core gives the group
 * nothing else to find it by.
 *
 * @return {string[]} Labels, in the site's language.
 */
export function getFormatButtonLabels() {
	return [ __( 'Bold' ), __( 'Italic' ), __( 'More' ) ];
}

/**
 * Core's items in the block's options menu, by the words core gives them.
 *
 * @return {Object} Labels, in the site's language.
 */
export function getCoreItemLabels() {
	return {
		group: _x( 'Group', 'verb' ),
		ungroup: _x(
			'Ungroup',
			'Ungrouping blocks from within a grouping block back into individual blocks within the Editor'
		),
		createPattern: __( 'Create pattern' ),
		lock: __( 'Lock' ),
		unlock: __( 'Unlock' ),
		rename: __( 'Rename' ),
		hide: __( 'Hide' ),
		show: __( 'Show' ),
	};
}

/**
 * An attribute selector for one label, quoted so any translation fits.
 *
 * @param {string} name  Attribute.
 * @param {string} value Its value.
 * @return {string} The selector.
 */
export function attributeIs( name, value ) {
	return `[${ name }="${ String( value ).replace( /["\\]/g, '\\$&' ) }"]`;
}

/**
 * Selectors for any of a list of labels.
 *
 * @param {string[]} labels Labels.
 * @return {string} A selector list.
 */
export function labelSelector( labels ) {
	return [ ...new Set( labels ) ]
		.map( ( label ) => attributeIs( 'aria-label', label ) )
		.join( ', ' );
}

/**
 * The stylesheet's rules that find core's controls by their labels.
 *
 * @return {string} CSS.
 */
export function getLabelStyles() {
	const style = labelSelector( getStyleControlLabels() );
	const wellKnown = labelSelector( getWellKnownLabels() );
	const format = labelSelector( getFormatButtonLabels() );
	const styleControl = `${ style }, .components-dropdown:has(> :is(${ style }))`;
	// Any other icon-only button, which the options menu takes instead,
	// named. `readToolbarTools()` in `core-menu-items.jsx` lists what this
	// hides.
	const toolButton = `.block-editor-block-toolbar__slot > button.has-icon:not(.has-text, [aria-haspopup], .cnl-block-toolbar__keep, ${ wellKnown })`;
	const group = `${ TOOLBAR } .block-editor-block-toolbar > .components-toolbar-group`;

	return [
		// Style controls, now in the options or Layout menu.
		`${ TOOLBAR } .block-editor-block-toolbar__slot > :is(${ styleControl }) { display: none; }`,
		// Icon tools without a well-known icon, now in the options menu.
		`${ group }:not(:has(${ format })) ${ toolButton } { display: none; }`,
		// A group left with nothing in it. (`:has()` can't hold another.)
		`${ group }:has(> .block-editor-block-toolbar__slot):not(:has(.block-editor-block-toolbar__slot :is(button, a):not(${ style }):not(${ toolButton }))) { display: none; }`,
		// Formatting, out of sight until text is selected. The floating
		// look is in `_style.scss`, on `[data-cnl-format="floating"]`.
		`${ group }:has(${ format }):not([data-cnl-format="floating"]) { display: none; }`,
	].join( '\n' );
}

/**
 * Write the label rules into the document, and again whenever the
 * translations change.
 *
 * @param {Document} [doc] The document to style.
 * @return {Function} Takes them out again.
 */
export function registerLabelStyles( doc = document ) {
	const style = doc.createElement( 'style' );

	style.id = STYLE_ID;
	doc.head.appendChild( style );

	const update = () => {
		const css = getLabelStyles();

		if ( style.textContent !== css ) {
			style.textContent = css;
		}
	};

	update();
	const unsubscribe = subscribe( update );

	return () => {
		unsubscribe();
		style.remove();
	};
}
