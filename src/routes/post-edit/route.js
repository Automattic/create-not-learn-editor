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

const SITE_WIDE_TYPES = [
	'wp_navigation',
	'wp_template',
	'wp_template_part',
	'wp_block',
];

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

		if ( ! params.id ) {
			throw notFound();
		}

		const type = getEditablePostType( params.type );

		// Menus, layouts and site parts are left out of the editable types
		// for people who can't change them.
		if (
			( ! type && SITE_WIDE_TYPES.includes( params.type ) ) ||
			( type && ! type.canEdit )
		) {
			throw redirect( { to: '/not-available' } );
		}

		if ( ! type ) {
			throw notFound();
		}

		// Someone else's post, that an Author can't change, say. People who
		// can change everyone's aren't kept waiting to ask.
		if ( type.canEditOthers !== false ) {
			return;
		}

		const canUpdate = await resolveSelect( coreDataStore ).canUser(
			'update',
			{ kind: 'postType', name: params.type, id: params.id }
		);

		if ( canUpdate === false ) {
			throw redirect( { to: '/not-available' } );
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
