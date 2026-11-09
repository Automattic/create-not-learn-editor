import { notFound, redirect } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getEditablePostType } from '../../settings';
import {
	__,
	coreDataStore,
	resolveSelect,
	sprintf,
} from '../../wordpress-packages';

export const route = {
	beforeLoad: ( { params } ) => {
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
