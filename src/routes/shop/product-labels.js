/**
 * How a product is described in the shop's screens, shared by the Products
 * list and the table of every product.
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { formatPrice } from './product-entity';
import { getShop } from './shop';

export const STATUS_LABELS = {
	draft: __( 'Draft', 'create-not-learn-editor' ),
	future: __( 'Scheduled', 'create-not-learn-editor' ),
	pending: __( 'Waiting for review', 'create-not-learn-editor' ),
	private: __( 'Private', 'create-not-learn-editor' ),
};

export const STOCK_LABELS = {
	onbackorder: __( 'Taking orders', 'create-not-learn-editor' ),
	outofstock: __( 'Sold out', 'create-not-learn-editor' ),
};

// Products whose price and stock belong to something else.
export const HAS_OPTIONS = [ 'variable', 'grouped' ];

/**
 * @param {number} id Product ID.
 * @return {string} WooCommerce's editor for the product, in WP Admin.
 */
export function getProductEditUrl( id ) {
	const { adminUrls } = getShop();

	return adminUrls.product ? adminUrls.product + id : '';
}

/**
 * @param {Object} product Product record.
 * @return {string} What it costs, as the shop shows it.
 */
export function getPriceLabel( product ) {
	if ( HAS_OPTIONS.includes( product.type ) ) {
		return product.price
			? sprintf(
					/* translators: %s: The lowest price. */
					__( 'From %s', 'create-not-learn-editor' ),
					formatPrice( product.price )
				)
			: __( 'Priced by option', 'create-not-learn-editor' );
	}

	return (
		formatPrice( product.sale_price || product.regular_price ) ||
		__( 'No price yet', 'create-not-learn-editor' )
	);
}
