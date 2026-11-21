import { notFound, redirect } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getPostType, namespace } from '../../settings';
import { cnlEditorStore } from '../../records';
import { startPostFromKind } from '../../post-kinds';
import {
	getCoreEditorNewUrl,
	hasUnsavedChanges,
	openCoreEditor,
} from '../../core-editor';
import { __, dispatch, noticesStore, sprintf } from '../../wordpress-packages';

export const route = {
	beforeLoad: async ( { params, search } ) => {
		const type = getPostType( params.type );

		if ( ! type || ! type.canCreate ) {
			throw notFound();
		}

		// A post type with meta boxes, or the classic editor, starts its
		// posts in core's editor.
		const coreEditorUrl = getCoreEditorNewUrl( type.name );
		if ( coreEditorUrl ) {
			// Leaving would lose them, so stay, on the list.
			if ( hasUnsavedChanges() ) {
				dispatch( noticesStore ).createWarningNotice(
					__(
						'Save or discard your changes first. This opens in the full editor, which has its extra settings.'
					),
					{ id: 'cnl-core-editor-unsaved', type: 'snackbar' }
				);
				throw redirect( { to: `/types/${ type.name }` } );
			}

			openCoreEditor( coreEditorUrl, { replace: true } );
			await new Promise( () => {} );
		}

		if ( ! type.blockEditor ) {
			throw notFound();
		}

		const post = await dispatch( cnlEditorStore ).createAutoDraft(
			type.name,
			namespace
		);

		if ( ! post?.id ) {
			throw notFound();
		}

		// Picked as a kind of post, like a note or a photo, it starts with
		// that kind's blocks.
		if ( typeof search?.kind === 'string' ) {
			await startPostFromKind( type.name, post.id, search.kind );
		}

		throw redirect( {
			throw: true,
			to: `/types/${ type.name }/edit/${ post.id }`,
		} );
	},
	title: ( { params } ) => {
		const type = getPostType( params.type );
		return sprintf(
			/* translators: %s: post type singular label. */
			__( 'New %s' ),
			( type?.singular || params.type ).toLowerCase()
		);
	},
	async canvas() {
		return undefined;
	},
};
