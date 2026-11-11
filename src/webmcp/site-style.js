/**
 * The site's look, its colour palette and its fonts, as the Design, Colors
 * and Fonts screens offer them (`src/pickers/styles.jsx`): the theme's style
 * variations, sorted into the three, and written to the site's global styles
 * as unsaved edits.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { dispatch, resolveSelect, select } from '@wordpress/data';

/**
 * Internal dependencies
 */
import {
	applyPreset,
	COLOR_PROPERTIES,
	findActiveLook,
	findActivePreset,
	getStyleConfig,
	getVariationTitle,
	groupStyleVariations,
	TYPOGRAPHY_PROPERTIES,
} from '../routes/static/style-variations';
import { findByName } from './match';

// The theme's own look, as the Design screen offers it: no changes at all.
const THEME_DEFAULT_LOOK = {};
const THEME_DEFAULT = 'Theme default';
const THEME_COLORS = 'Theme colors';
const THEME_FONTS = 'Theme fonts';

async function getStyles() {
	const resolve = resolveSelect( coreDataStore );
	const id = await resolve.__experimentalGetCurrentGlobalStylesId();

	if ( ! id ) {
		throw new Error( "The site's styles can't be changed here." );
	}

	const [ variations ] = await Promise.all( [
		resolve.__experimentalGetCurrentThemeGlobalStylesVariations(),
		resolve.getEntityRecord( 'root', 'globalStyles', id ),
	] );
	const groups = groupStyleVariations( variations || [] );

	return {
		id,
		looks: [ THEME_DEFAULT_LOOK, ...groups.looks ],
		palettes: groups.colors,
		fonts: groups.fonts,
		config: select( coreDataStore ).getEditedEntityRecord(
			'root',
			'globalStyles',
			id
		),
	};
}

function getLookTitle( look ) {
	return look === THEME_DEFAULT_LOOK
		? THEME_DEFAULT
		: getVariationTitle( look );
}

/**
 * The site's look as it is now, and what it can change to.
 *
 * @return {Promise<Object>} `{ look, palette, fonts, title, tagline }`.
 */
export async function describeSiteStyle() {
	const { config, fonts, looks, palettes } = await getStyles();
	const site = await resolveSelect( coreDataStore ).getEntityRecord(
		'root',
		'site'
	);
	const edited = select( coreDataStore ).getEditedEntityRecord(
		'root',
		'site'
	);
	const active = findActiveLook( config, looks );
	const palette = findActivePreset( config, palettes, COLOR_PROPERTIES );
	const font = findActivePreset( config, fonts, TYPOGRAPHY_PROPERTIES );

	return {
		look: {
			current: active ? getLookTitle( active.look ) : null,
			options: looks.map( getLookTitle ),
		},
		palette: {
			current: palette
				? getVariationTitle( palette )
				: active && ! active.hasColorChanges && THEME_COLORS,
			options: [ THEME_COLORS, ...palettes.map( getVariationTitle ) ],
		},
		fonts: {
			current: font
				? getVariationTitle( font )
				: active && ! active.hasFontChanges && THEME_FONTS,
			options: [ THEME_FONTS, ...fonts.map( getVariationTitle ) ],
		},
		title: edited?.title ?? site?.title,
		tagline: edited?.description ?? site?.description,
	};
}

/**
 * Change the site's look, palette or fonts, each by name.
 *
 * @param {Object}  changes
 * @param {?string} changes.look    A look, or "Theme default".
 * @param {?string} changes.palette A palette, or "Theme colors".
 * @param {?string} changes.fonts   A font pairing, or "Theme fonts".
 * @return {Promise<string[]>} What changed, in words.
 */
export async function setSiteStyle( { look, palette, fonts } ) {
	const styles = await getStyles();
	let config = styles.config;
	const done = [];

	if ( look ) {
		const next = findByName( styles.looks, look, getLookTitle, 'look' );

		config = next;
		done.push( `look to ${ getLookTitle( next ) }` );
	}

	if ( palette ) {
		const next = findByName(
			[ null, ...styles.palettes ],
			palette,
			( item ) => ( item ? getVariationTitle( item ) : THEME_COLORS ),
			'palette'
		);

		config = applyPreset( config, next, COLOR_PROPERTIES );
		done.push(
			`palette to ${ next ? getVariationTitle( next ) : THEME_COLORS }`
		);
	}

	if ( fonts ) {
		const next = findByName(
			[ null, ...styles.fonts ],
			fonts,
			( item ) => ( item ? getVariationTitle( item ) : THEME_FONTS ),
			'font pairing'
		);

		config = applyPreset( config, next, TYPOGRAPHY_PROPERTIES );
		done.push(
			`fonts to ${ next ? getVariationTitle( next ) : THEME_FONTS }`
		);
	}

	if ( done.length ) {
		dispatch( coreDataStore ).editEntityRecord(
			'root',
			'globalStyles',
			styles.id,
			getStyleConfig( config )
		);
	}

	return done;
}
