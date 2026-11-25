import { notFound, redirect } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { userCan } from '../../capabilities';
import { getPostType } from '../../settings';
import { __ } from '../../wordpress-packages';

export const route = {
	beforeLoad: ( { params, search } ) => {
		const type = getPostType( params.type );

		if ( ! type ) {
			throw notFound();
		}

		// Content the person can't write, and the layouts, which are the
		// whole site's, explain themselves rather than open.
		if (
			! type.canEdit ||
			( [ 'templates', 'system' ].includes( search?.content ) &&
				! userCan( 'site' ) )
		) {
			throw redirect( { to: '/not-available' } );
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
