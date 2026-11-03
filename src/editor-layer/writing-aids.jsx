/**
 * Small things that make the edit canvas feel like a place to write, for
 * workspaces that ask for them (`writingAids`) while a post is open.
 *
 * - Core's empty-paragraph prompt, "Type / to choose a block", invites the
 *   writing first and mentions the slash second.
 * - A quiet line in the corner says how long the post is and how long it
 *   takes to read, as writing apps do.
 * - A post started from a kind, like a quote, opens with the caret in the
 *   kind's first block, and a note's title says it is optional.
 *
 * The wording is swapped the way `section-wording.js` swaps it.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useRegistry, useSelect } from '@wordpress/data';
import { createPortal, useEffect } from '@wordpress/element';
import { addFilter, removeFilter } from '@wordpress/hooks';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { EDITOR_REGIONS, usePortalHost } from './portal-host';
import { countWords } from './word-count';
import { isUntitledFormat, takePostKindFocus } from '../post-kinds-base';
import { EDITOR_STORE } from './settings-guard';

const NAMESPACE = 'create-not-learn-editor/writing-wording';
const UNTITLED_NAMESPACE = 'create-not-learn-editor/untitled-wording';

// Blocks that hold the writing rather than being it, like a quote.
const CONTAINER_BLOCKS = [ 'core/quote', 'core/group', 'core/pullquote' ];

// Words a minute, as core's own reading time counts them.
const WORDS_PER_MINUTE = 189;

const WRITING_WORDING = {
	'Type / to choose a block': () =>
		__( 'Start writing, or type / for images and more' ),
};

function filterGettext( translation, text ) {
	return Object.hasOwn( WRITING_WORDING, text )
		? WRITING_WORDING[ text ]()
		: translation;
}

function filterUntitledGettext( translation, text ) {
	return text === 'Add title' ? __( 'Title (optional)' ) : translation;
}

/**
 * Use the writing wording for as long as `isActive` is true.
 *
 * @param {boolean} isActive Whether to swap the wording.
 */
export function useWritingWording( isActive ) {
	useEffect( () => {
		if ( ! isActive ) {
			return undefined;
		}

		addFilter( 'i18n.gettext_default', NAMESPACE, filterGettext );

		return () => removeFilter( 'i18n.gettext_default', NAMESPACE );
	}, [ isActive ] );
}

/**
 * Say a post's title is optional while it is a kind that usually goes
 * without one, like a note.
 *
 * @param {boolean} isActive Whether a post is being written.
 */
export function useUntitledWording( isActive ) {
	const isUntitled = useSelect(
		( select ) =>
			isActive &&
			isUntitledFormat(
				select( EDITOR_STORE )?.getEditedPostAttribute( 'format' )
			),
		[ isActive ]
	);

	useEffect( () => {
		if ( ! isUntitled ) {
			return undefined;
		}

		addFilter(
			'i18n.gettext_default',
			UNTITLED_NAMESPACE,
			filterUntitledGettext
		);

		return () => removeFilter( 'i18n.gettext_default', UNTITLED_NAMESPACE );
	}, [ isUntitled ] );
}

/**
 * Put the caret in the first block a kind of post started with, once its
 * blocks are in the editor, rather than in the title.
 *
 * @param {boolean} isEditCanvas Whether the full-screen edit canvas is on
 *                               screen.
 */
export function usePostKindFocus( isEditCanvas ) {
	const registry = useRegistry();
	const blockCount = useSelect(
		( select ) =>
			isEditCanvas ? select( blockEditorStore ).getBlockCount() : 0,
		[ isEditCanvas ]
	);

	useEffect( () => {
		if ( ! blockCount || ! takePostKindFocus() ) {
			return undefined;
		}

		const { getBlockName, getClientIdsWithDescendants } =
			registry.select( blockEditorStore );
		const target = getClientIdsWithDescendants().find(
			( clientId ) =>
				! CONTAINER_BLOCKS.includes( getBlockName( clientId ) )
		);

		if ( ! target ) {
			return undefined;
		}

		// Once the canvas has drawn the block, so it can take the caret.
		const timeout = setTimeout(
			() =>
				registry.dispatch( blockEditorStore ).selectBlock( target, 0 ),
			100
		);

		return () => clearTimeout( timeout );
	}, [ blockCount, registry ] );
}

/**
 * The post's length and reading time, in the corner of the canvas.
 *
 * @return {?Element} The line, once the canvas has a place for it.
 */
export function WritingStatus() {
	const host = usePortalHost(
		EDITOR_REGIONS.content,
		'cnl-editor-layer__writing-status'
	);
	const words = useSelect(
		( select ) =>
			countWords(
				select( EDITOR_STORE )?.getEditedPostAttribute( 'content' )
			),
		[]
	);

	if ( ! host || ! words ) {
		return null;
	}

	const minutes = Math.max( 1, Math.round( words / WORDS_PER_MINUTE ) );

	return createPortal(
		<p className="cnl-writing-status" aria-live="off">
			{ [
				sprintf(
					/* translators: %s: Number of words. */
					_n( '%s word', '%s words', words ),
					words.toLocaleString()
				),
				sprintf(
					/* translators: %d: Minutes it takes to read the post. */
					_n( '%d min read', '%d min read', minutes ),
					minutes
				),
			].join( ' · ' ) }
		</p>,
		host
	);
}
