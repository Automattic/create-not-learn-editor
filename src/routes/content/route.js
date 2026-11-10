import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getPostType } from '../../settings';
import { __ } from '../../wordpress-packages';

export const route = {
	beforeLoad: ( { params } ) => {
		if ( ! getPostType( params.type ) ) {
			throw notFound();
		}
	},
	title: ( { params } ) => {
		const type = getPostType( params.type );
		return type?.menuName || type?.label || __( 'Content' );
	},
	async canvas( { params, search } ) {
		// A Layouts tab shows the layout picked there in a site canvas.
		// So do Pages' system pages.
		if ( [ 'templates', 'system' ].includes( search.content ) ) {
			return null;
		}

		// The table of all pages takes the whole width, like the lists under
		// Advanced.
		if ( params.type === 'page' && search.content === 'all' ) {
			return undefined;
		}

		// Pages always show a page next to the list.
		if ( params.type === 'page' || search.postId || search.postIds ) {
			return null;
		}

		return undefined;
	},
};
