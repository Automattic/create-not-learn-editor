import { notFound, redirect } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getEditablePostType } from '../../settings';
import {
	hasUnsavedChanges,
	openCoreEditor,
	resolveCoreEditorUrl,
} from '../../core-editor';
import {
	__,
	coreDataStore,
	dispatch,
	noticesStore,
	resolveSelect,
	sprintf,
} from '../../wordpress-packages';

function warnOfUnsavedChanges() {
	dispatch( noticesStore ).createWarningNotice(
		__(
			'Save or discard your changes first. This opens in the full editor, which has its extra settings.'
		),
		{ id: 'cnl-core-editor-unsaved', type: 'snackbar' }
	);
}

export const route = {
	beforeLoad: async ( { params } ) => {
		// Gutenberg's templates list (`includes/gutenberg-routes.php`) opens
		// a template here, so it's sent on to the editor's template editor.
		if ( params.type === 'wp_template' && params.id ) {
			throw redirect( {
				search: { postId: decodeURIComponent( params.id ) },
				to: '/wp_template',
			} );
		}

		if ( ! getEditablePostType( params.type ) || ! params.id ) {
			throw notFound();
		}

		// A post with meta boxes, or of a classic post type, is edited in
		// core's editor. Replaced in the history, as coming back here would
		// only send the person on again.
		const coreEditorUrl = await resolveCoreEditorUrl(
			params.type,
			params.id
		);
		if ( coreEditorUrl ) {
			// Leaving would lose them, so stay, on the list.
			if ( hasUnsavedChanges() ) {
				warnOfUnsavedChanges();
				throw redirect( { to: `/types/${ params.type }` } );
			}

			openCoreEditor( coreEditorUrl, { replace: true } );
			// The page is leaving: nothing more to load.
			await new Promise( () => {} );
		}
	},
	title: ( { params } ) => {
		const type = getEditablePostType( params.type );
		return sprintf(
			/* translators: %s: post type singular label. */
			__( 'Edit %s' ),
			( type?.singular || params.type ).toLowerCase()
		);
	},
	/*
	 * The editor parses the post's content into blocks itself, once their
	 * types are registered (`useEntityBlockEditor`). Parsing here, before
	 * they are, stored an empty list of blocks in place of the post's.
	 */
	async canvas( { params } ) {
		await resolveSelect( coreDataStore ).getEntityRecord(
			'postType',
			params.type,
			params.id,
			{ context: 'edit' }
		);

		return {
			postType: params.type,
			postId: params.id,
		};
	},
};
