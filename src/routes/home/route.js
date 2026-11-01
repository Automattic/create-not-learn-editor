/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

export const route = {
	title: () => __( 'Home' ),
	async canvas() {
		return null;
	},
};
