/**
 * WordPress dependencies
 */
import { redirect } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getCurrentEditorPath, getStaticScreen } from './screens';

// The lists, which fill the stage, with no canvas beside them.
const LIST_PATHS = [ '/media', '/patterns', '/template-parts' ];

export const route = {
	/*
	 * Gutenberg's media editor links back to its own media list, at
	 * `/types/attachment/list/$view`, the only path here with a `view`.
	 * That's the Media screen here.
	 */
	beforeLoad( { params } ) {
		if ( params?.view ) {
			throw redirect( { to: '/media' } );
		}
	},
	title: () => getStaticScreen().title,
	async canvas() {
		if ( LIST_PATHS.includes( getCurrentEditorPath() ) ) {
			return undefined;
		}

		return null;
	},
};
