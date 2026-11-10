/**
 * Shop pages: the pages WooCommerce adds, shown in the site canvas one at a
 * time, so each is changed in place like any other page, in Edit.
 *
 * Single Product and Product Listing are layouts, so Edit changes every
 * product's page, or every list of products, rather than the one on show.
 * The cart and checkout are pages with their blocks in them, so Edit changes
 * the page. Advanced leads to all of WooCommerce's layouts, like those for a
 * product category or search results.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import ScreenLinks from '../../screen-links';
import SitePreviewCanvas from '../static/site-preview';
import { ShopPage } from './heading';
import {
	SHOP_LAYOUTS,
	SHOP_PAGES_PATH,
	getShop,
	useTemplateEntity,
} from './shop';
import {
	Button,
	Icon,
	__,
	layoutIcon,
	pageIcon,
	paymentIcon,
	storeIcon,
	tagIcon,
} from '../../wordpress-packages';

function getShopPages() {
	const { pages } = getShop();

	return [
		{
			description: pages.product
				? __( 'How every product’s page is laid out.' )
				: __( 'Add a product to see its page.' ),
			icon: tagIcon,
			id: 'product',
			templateSlug: 'single-product',
			title: __( 'Single Product' ),
			url: pages.product,
		},
		{
			description: __(
				'How the shop, and every list of products, is laid out.'
			),
			icon: storeIcon,
			id: 'shop',
			templateSlug: 'archive-product',
			title: __( 'Product Listing' ),
			url: pages.shop,
		},
		{
			description: __( 'What visitors have picked, before they pay.' ),
			icon: pageIcon,
			id: 'cart',
			title: __( 'Cart' ),
			url: pages.cart,
		},
		{
			description: __( 'Where visitors pay.' ),
			icon: paymentIcon,
			id: 'checkout',
			title: __( 'Checkout' ),
			url: pages.checkout,
		},
	];
}

function useSelectedShopPage() {
	const { page } = useSearch( { strict: false } );
	const pages = getShopPages();

	return {
		pages,
		selected:
			pages.find( ( { id, url } ) => id === page && url ) ||
			pages.find( ( { url } ) => url ) ||
			pages[ 0 ],
	};
}

export function ShopPagesStage() {
	const navigate = useNavigate();
	const { pages, selected } = useSelectedShopPage();

	return (
		<ShopPage
			crumbs={ [ { label: __( 'Shop pages' ) } ] }
			description={ __(
				'Pick a page to see it. Switch to Edit to change how it looks.'
			) }
		>
			<ul className="cnl-shop-products">
				{ pages.map( ( page ) => (
					<li key={ page.id }>
						<Button
							aria-pressed={ page.id === selected.id }
							className="cnl-shop-products__item"
							disabled={ ! page.url }
							onClick={ () =>
								navigate( {
									search: { page: page.id },
									to: SHOP_PAGES_PATH,
								} )
							}
						>
							<Icon
								className="cnl-shop-products__icon"
								icon={ page.icon }
							/>
							<span className="cnl-shop-products__text">
								<span className="cnl-shop-products__name">
									{ page.title }
								</span>
								<span className="cnl-shop-products__meta">
									{ page.description }
								</span>
							</span>
						</Button>
					</li>
				) ) }
			</ul>
			<ScreenLinks
				label={ __( 'More shop layouts' ) }
				links={ [
					{
						description: __(
							'All of WooCommerce’s templates, like a product category’s or search results.'
						),
						icon: layoutIcon,
						search: { layouts: SHOP_LAYOUTS },
						title: __( 'Advanced' ),
						to: '/templates',
					},
				] }
			/>
		</ShopPage>
	);
}

export function ShopPagesCanvas() {
	const { selected } = useSelectedShopPage();
	const pinnedEntity = useTemplateEntity( selected.templateSlug );

	return (
		<SitePreviewCanvas
			pinnedEntity={ pinnedEntity }
			url={ selected.url || undefined }
		/>
	);
}
