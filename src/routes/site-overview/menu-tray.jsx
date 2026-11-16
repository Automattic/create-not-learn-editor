/**
 * The main menu as a tray along the top of the Site overview, while it is
 * being rearranged. Each top-level item is a pill, with the items in its
 * dropdown under it. Pages dropped on it join the menu, pills dragged along it
 * change its order, and any item can be taken out, with its × or by dragging
 * it off the tray.
 */

/**
 * Internal dependencies
 */
import { getPageTitle } from '../content/pages/data';
import { HOMEPAGE } from '../content/pages/homepage-state';
import { getNavigationItemLabel } from '../navigation-edit/navigation-blocks';
import { Button, __, closeSmallIcon, sprintf } from '../../wordpress-packages';

/**
 * The menu's items, each with the page or homepage it links to and the items
 * under it. A Page List stands for the pages it lists, nested as they are.
 *
 * @param {Object}   args             Arguments.
 * @param {Object[]} args.blocks      The menu's blocks.
 * @param {Object[]} args.tree        Pages as a tree.
 * @param {Function} args.getSwitch   From `useMenuSwitches`.
 * @param {number}   args.frontPageId The homepage's page.
 * @return {Object[]} `{ children, key, label, pageId, target }`, `target`
 *                    null for links that aren't to a page.
 */
export function getMenuTrayItems( { blocks, tree, getSwitch, frontPageId } ) {
	const getTarget = ( id ) => ( id === frontPageId ? HOMEPAGE : id );
	const fromPages = ( items ) =>
		items
			.filter(
				( item ) =>
					item.page.status === 'publish' &&
					getSwitch( Number( item.page.id ) ).checked
			)
			.map( ( item ) => ( {
				children: fromPages( item.children ),
				key: `page-${ item.page.id }`,
				label: getPageTitle( item.page ),
				pageId: Number( item.page.id ),
				target: getTarget( Number( item.page.id ) ),
			} ) );
	const fromBlocks = ( items, prefix ) =>
		( items || [] ).flatMap( ( block, index ) => {
			const attributes = block.attributes || {};

			if ( block.name === 'core/page-list' ) {
				return fromPages( tree );
			}

			let target = null;

			if ( block.name === 'core/home-link' ) {
				target = HOMEPAGE;
			} else if ( attributes.type === 'page' && attributes.id ) {
				target = getTarget( Number( attributes.id ) );
			}

			const key = `${ prefix }${ index }`;

			return [
				{
					children: fromBlocks( block.innerBlocks, `${ key }-` ),
					key: `${ block.name }-${ key }`,
					label: getNavigationItemLabel( block ),
					pageId: Number( attributes.id ) || 0,
					target,
				},
			];
		} );

	return fromBlocks( blocks, '' );
}

function Pill( {
	draggedKey,
	index,
	isMovable,
	item,
	onPointerDown,
	onRemove,
} ) {
	const canTakeOut = item.target !== null;

	return (
		<div
			className={ [
				'cnl-site-overview-menu-tray__item',
				( isMovable || canTakeOut ) && 'is-movable',
				item.key === draggedKey && 'is-dragged',
			]
				.filter( Boolean )
				.join( ' ' ) }
			onPointerDown={
				isMovable || canTakeOut
					? ( event ) => onPointerDown( event, item, index )
					: undefined
			}
		>
			<span>{ item.label }</span>
			{ canTakeOut && (
				<Button
					icon={ closeSmallIcon }
					label={ sprintf(
						/* translators: %s: Menu item label. */
						__( 'Take “%s” out of the menu' ),
						item.label
					) }
					onClick={ () => onRemove( item.target ) }
					size="small"
				/>
			) }
		</div>
	);
}

function SubItems( { items, ...props } ) {
	if ( ! items.length ) {
		return null;
	}

	return (
		<ul className="cnl-site-overview-menu-tray__sub-items">
			{ items.map( ( item ) => (
				<li key={ item.key }>
					<Pill { ...props } item={ item } />
					<SubItems { ...props } items={ item.children } />
				</li>
			) ) }
		</ul>
	);
}

export function MenuTray( {
	canReorder,
	draggedKey,
	hasMenu,
	insertIndex,
	isAutomatic,
	isDragging,
	isOver,
	items,
	menuTitle,
	onItemPointerDown,
	onRemove,
} ) {
	const className = [
		'cnl-site-overview-menu-tray',
		isDragging && 'is-dragging',
		isOver && 'is-over',
	]
		.filter( Boolean )
		.join( ' ' );
	let subtitle = '';

	if ( isAutomatic ) {
		subtitle = __( 'Auto menu, in page order' );
	} else if ( menuTitle && menuTitle !== __( 'Main menu' ) ) {
		subtitle = menuTitle;
	}

	const pillProps = {
		draggedKey,
		onPointerDown: onItemPointerDown,
		onRemove,
	};
	const marker = (
		<li
			aria-hidden
			className="cnl-site-overview-menu-tray__marker"
			key="marker"
		/>
	);
	const groups = items.flatMap( ( item, index ) => {
		const group = (
			<li className="cnl-site-overview-menu-tray__group" key={ item.key }>
				<Pill
					{ ...pillProps }
					index={ index }
					isMovable={ canReorder }
					item={ item }
				/>
				<SubItems { ...pillProps } items={ item.children } />
			</li>
		);

		return index === insertIndex ? [ marker, group ] : [ group ];
	} );

	if ( insertIndex === items.length ) {
		groups.push( marker );
	}

	return (
		<div
			aria-label={ __( 'Main menu' ) }
			className={ className }
			role="region"
		>
			<div className="cnl-site-overview-menu-tray__header">
				<span className="cnl-site-overview-menu-tray__title">
					{ __( 'Main menu' ) }
				</span>
				{ subtitle && (
					<span className="cnl-site-overview-menu-tray__subtitle">
						{ subtitle }
					</span>
				) }
			</div>
			{ ! hasMenu && (
				<p className="cnl-site-overview-menu-tray__empty">
					{ __( 'Your site has no menu yet.' ) }
				</p>
			) }
			{ hasMenu && ! items.length && (
				<p className="cnl-site-overview-menu-tray__empty">
					{ isOver
						? __( 'Drop to add it to your menu' )
						: __( 'Drag pages here to add them to your menu' ) }
				</p>
			) }
			{ hasMenu && !! items.length && (
				<ul className="cnl-site-overview-menu-tray__items">
					{ groups }
				</ul>
			) }
		</div>
	);
}
