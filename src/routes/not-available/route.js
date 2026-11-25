/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

/*
 * What opens in place of a screen the person can't use, at that screen's own
 * address (`cnl_editor_register_route()`), or here when a list or an editor
 * finds it can't open what it was asked for.
 */
export const route = {
	title: () => __( 'Not available' ),
	async canvas() {
		return undefined;
	},
};
