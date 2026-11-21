/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

export const route = {
	title: () => __( 'Home', 'create-not-learn-editor' ),
	async canvas() {
		return null;
	},
};
