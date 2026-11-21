/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Where a new section will go, as a sentence.
 *
 * @param {?string} previousTitle Title of the section it goes after.
 * @param {?string} nextTitle     Title of the section it goes before.
 * @return {string} The placement sentence.
 */
export function getPlacementText( previousTitle, nextTitle ) {
	if ( ! previousTitle && ! nextTitle ) {
		return __(
			'It will be the first thing on the page.',
			'create-not-learn-editor'
		);
	}

	if ( ! previousTitle ) {
		return sprintf(
			/* translators: %s: section name. */
			__(
				'It will go at the top, above “%s”.',
				'create-not-learn-editor'
			),
			nextTitle
		);
	}

	if ( ! nextTitle ) {
		return __(
			'It will go at the end of the page.',
			'create-not-learn-editor'
		);
	}

	return sprintf(
		/* translators: %s: section name. */
		__( 'It will go after “%s”.', 'create-not-learn-editor' ),
		previousTitle
	);
}
