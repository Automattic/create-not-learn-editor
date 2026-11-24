/**
 * Reading core's action item fills, like plugins' More menu and preview menu
 * items, as the items they would render, so CnL can draw them in its own
 * menus. See `README.md`.
 */

export function getText( node ) {
	if ( typeof node === 'string' || typeof node === 'number' ) {
		return String( node );
	}
	if ( Array.isArray( node ) ) {
		return node.map( getText ).join( '' );
	}
	return node?.props?.children ? getText( node.props.children ) : '';
}

/**
 * Menu items from the elements of action item fills, as a slot's render
 * prop hands them over.
 *
 * @param {Object[]} elements The elements.
 * @return {Object[]} Each item's `label`, `icon`, `onClick` and `href`.
 */
export function readActionItems( elements ) {
	return elements
		.filter( ( element ) => element?.props )
		.map( ( { props } ) => ( {
			label: getText( props.children ),
			icon: props.icon,
			onClick: props.onClick,
			href: props.href,
		} ) )
		.filter( ( item ) => item.label );
}
