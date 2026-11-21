/**
 * Internal dependencies
 */
import { getCurrentEditorPath } from '../static/screens';
import { PRODUCTS_PATH, SHOP_PAGES_PATH } from './shop';
import { __ } from '../../wordpress-packages';

const TITLES = {
	[ PRODUCTS_PATH ]: __( 'Products', 'create-not-learn-editor' ),
	[ SHOP_PAGES_PATH ]: __( 'Shop pages', 'create-not-learn-editor' ),
};

export const route = {
	title: () =>
		TITLES[ getCurrentEditorPath() ] ||
		__( 'Shop', 'create-not-learn-editor' ),
	async canvas( { search } ) {
		// The table of every product takes the whole width, like Pages'.
		if (
			getCurrentEditorPath() === PRODUCTS_PATH &&
			search?.content === 'all'
		) {
			return undefined;
		}

		// The screen's own canvas, from its content module.
		return null;
	},
};
