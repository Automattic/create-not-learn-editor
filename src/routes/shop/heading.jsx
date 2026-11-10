/**
 * Internal dependencies
 */
import { SHOP_PATH } from './shop';
import { Breadcrumbs, Page, __ } from '../../wordpress-packages';

/**
 * A shop screen in the design system's page, like Home and Pages: a title or
 * breadcrumbs, a sentence and the screen's actions in its header, then the
 * screen. The shop itself is titled "Shop"; the screens inside it lead back
 * to the shop.
 *
 * @param {Object}   props             Component props.
 * @param {Element}  props.actions     The screen's actions, like adding.
 * @param {Element}  props.children    The screen.
 * @param {string}   props.className   Extra class for the page.
 * @param {Object[]} props.crumbs      Breadcrumbs after the shop's own, the
 *                                     last one this screen. None for the
 *                                     shop itself.
 * @param {string}   props.description Sentence under the breadcrumbs.
 * @param {boolean}  props.hasPadding  Whether the screen is padded, as a
 *                                     list is. A table runs edge to edge.
 * @return {Element} The page.
 */
export function ShopPage( {
	actions,
	children,
	className = '',
	crumbs = [],
	description,
	hasPadding = true,
} ) {
	const shopCrumb = { label: __( 'Shop' ), to: SHOP_PATH };
	const items = [ shopCrumb, ...crumbs ];
	const isTitled = items.length === 1;

	return (
		<Page
			actions={ actions }
			breadcrumbs={
				! isTitled && (
					<Breadcrumbs
						items={ items.map( ( item, index ) =>
							index === items.length - 1
								? { label: item.label }
								: item
						) }
					/>
				)
			}
			className={ `cnl-editor-stage cnl-editor-content-page cnl-shop-page ${ className }` }
			hasPadding={ false }
			headingLevel={ isTitled ? 1 : 2 }
			subTitle={ description }
			title={ isTitled ? shopCrumb.label : undefined }
		>
			{ hasPadding ? (
				<div className="cnl-shop-page__body">{ children }</div>
			) : (
				children
			) }
		</Page>
	);
}
