/**
 * How section designs are grouped and searched in the section picker.
 *
 * Core's pattern categories are named after what a design is, like Banners or
 * Columns. The picker groups them by what it is for instead, like introducing
 * yourself or selling something. Categories outside the table, such as the
 * ones a theme registers, go into a catch-all group named after the theme.
 *
 * Layouts are plain shapes rather than finished designs, so they are grouped
 * by shape instead, like banners or columns.
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	getPatternDescription,
	getPatternTitle,
} from '../routes/content/page-layouts';

const EMPTY_ARRAY = [];

export const THEME_GROUP = 'theme';

/**
 * The purpose groups, in the order they are shown, and the core categories
 * each one takes in. A design lands in the first group that takes one of its
 * categories.
 *
 * @return {Object[]} `{ name, label, description, categories }` groups.
 */
export function getSectionGroups() {
	return [
		{
			name: 'introduce',
			label: __( 'Introduce', 'create-not-learn-editor' ),
			description: __( 'Say who you are', 'create-not-learn-editor' ),
			categories: [ 'banner', 'about', 'team' ],
		},
		{
			name: 'sell',
			label: __( 'Sell', 'create-not-learn-editor' ),
			description: __( 'Win people over', 'create-not-learn-editor' ),
			categories: [ 'call-to-action', 'services', 'testimonials' ],
		},
		{
			name: 'showcase',
			label: __( 'Showcase', 'create-not-learn-editor' ),
			description: __( 'Show off your work', 'create-not-learn-editor' ),
			categories: [ 'portfolio', 'gallery', 'media', 'videos', 'audio' ],
		},
		{
			name: 'write',
			label: __( 'Write', 'create-not-learn-editor' ),
			description: __(
				'Words, quotes and lists',
				'create-not-learn-editor'
			),
			categories: [ 'text', 'columns', 'buttons' ],
		},
		{
			name: 'posts',
			label: __( 'Posts', 'create-not-learn-editor' ),
			description: __(
				'Share your latest writing',
				'create-not-learn-editor'
			),
			categories: [ 'posts' ],
		},
		{
			name: 'contact',
			label: __( 'Get in touch', 'create-not-learn-editor' ),
			description: __(
				'Help people reach you',
				'create-not-learn-editor'
			),
			categories: [ 'contact' ],
		},
	];
}

/**
 * The layout groups, in the order they are shown, and the category each one
 * takes in. Each layout's group is set where it is registered, in
 * `cnl_editor_get_layouts()`.
 *
 * @return {Object[]} `{ name, label, description, categories }` groups.
 */
export function getLayoutGroups() {
	return [
		{
			name: 'layout-banners',
			label: __( 'Banners', 'create-not-learn-editor' ),
			description: __(
				'Big openers for the top of a page',
				'create-not-learn-editor'
			),
			categories: [ 'cnl-layouts-banners' ],
		},
		{
			name: 'layout-text',
			label: __( 'Text', 'create-not-learn-editor' ),
			description: __( 'Words on their own', 'create-not-learn-editor' ),
			categories: [ 'cnl-layouts-text' ],
		},
		{
			name: 'layout-image-text',
			label: __( 'Image and text', 'create-not-learn-editor' ),
			description: __(
				'A picture with words beside it',
				'create-not-learn-editor'
			),
			categories: [ 'cnl-layouts-image-text' ],
		},
		{
			name: 'layout-columns',
			label: __( 'Columns', 'create-not-learn-editor' ),
			description: __( 'Things side by side', 'create-not-learn-editor' ),
			categories: [ 'cnl-layouts-columns' ],
		},
		{
			name: 'layout-images',
			label: __( 'Images', 'create-not-learn-editor' ),
			description: __( 'Pictures first', 'create-not-learn-editor' ),
			categories: [ 'cnl-layouts-images' ],
		},
		{
			name: 'layout-calls-to-action',
			label: __( 'Calls to action', 'create-not-learn-editor' ),
			description: __(
				'Ask people to do something',
				'create-not-learn-editor'
			),
			categories: [ 'cnl-layouts-calls-to-action' ],
		},
	];
}

/**
 * Put each pattern in the first group that takes one of its categories, or
 * the last group if none does.
 *
 * @param {Object[]} patterns Patterns, in the order to show them.
 * @param {Object[]} groups   `{ categories }` groups, the catch-all last.
 * @return {Object[]} Non-empty `{ name, label, description, patterns }` groups.
 */
function groupPatterns( patterns, groups ) {
	const filled = groups.map( ( group ) => ( { ...group, patterns: [] } ) );
	const catchAll = filled[ filled.length - 1 ];

	( patterns || EMPTY_ARRAY ).forEach( ( pattern ) => {
		const categories = pattern.categories || EMPTY_ARRAY;
		const group =
			filled.find( ( { categories: taken } ) =>
				taken.some( ( category ) => categories.includes( category ) )
			) || catchAll;

		group.patterns.push( pattern );
	} );

	return filled
		.filter( ( group ) => group.patterns.length )
		.map( ( { categories, ...group } ) => group );
}

/**
 * Group section designs by purpose, each design once.
 *
 * @param {Object[]} patterns  Section patterns, in the order to show them.
 * @param {string}   themeName Active theme's name, for the catch-all group.
 * @return {Object[]} Non-empty `{ name, label, description, patterns }` groups.
 */
export function groupSectionDesigns( patterns, themeName ) {
	return groupPatterns( patterns, [
		...getSectionGroups(),
		{
			name: THEME_GROUP,
			label: themeName
				? sprintf(
						/* translators: %s: theme name. */
						__( 'From %s', 'create-not-learn-editor' ),
						themeName
					)
				: __( 'More designs', 'create-not-learn-editor' ),
			description: __(
				'Designs from your theme',
				'create-not-learn-editor'
			),
			categories: EMPTY_ARRAY,
		},
	] );
}

/**
 * Group layouts by shape, each layout once.
 *
 * @param {Object[]} patterns Layout patterns, in the order to show them.
 * @return {Object[]} Non-empty `{ name, label, description, patterns }` groups.
 */
export function groupLayouts( patterns ) {
	return groupPatterns( patterns, [
		...getLayoutGroups(),
		{
			name: 'layout-more',
			label: __( 'More templates', 'create-not-learn-editor' ),
			description: __( 'Other shapes', 'create-not-learn-editor' ),
			categories: EMPTY_ARRAY,
		},
	] );
}

function normalise( value ) {
	return String( value || '' )
		.normalize( 'NFD' )
		.replace( /[̀-ͯ]/g, '' )
		.toLowerCase();
}

/**
 * The section designs that match a search, in their original order.
 *
 * Every word searched for has to appear in the design's title, description or
 * keywords.
 *
 * @param {Object[]} patterns Section patterns.
 * @param {string}   search   What was typed.
 * @return {Object[]} Matching patterns.
 */
export function searchSectionDesigns( patterns, search ) {
	const words = normalise( search ).split( /\s+/ ).filter( Boolean );

	if ( ! words.length ) {
		return patterns || EMPTY_ARRAY;
	}

	return ( patterns || EMPTY_ARRAY ).filter( ( pattern ) => {
		const haystack = normalise(
			[
				getPatternTitle( pattern ),
				getPatternDescription( pattern ),
				...( pattern.keywords || EMPTY_ARRAY ),
			].join( ' ' )
		);

		return words.every( ( word ) => haystack.includes( word ) );
	} );
}
