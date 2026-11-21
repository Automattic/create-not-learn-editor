/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

function createRoute( title ) {
	return {
		title: () => title,
		async canvas() {
			// The screen's own canvas, from its content module.
			return null;
		},
	};
}

export const sitePartsRoute = createRoute(
	__( 'Site parts', 'create-not-learn-editor' )
);
export const headerRoute = createRoute(
	__( 'Header', 'create-not-learn-editor' )
);
export const footerRoute = createRoute(
	__( 'Footer', 'create-not-learn-editor' )
);
