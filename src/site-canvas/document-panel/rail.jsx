/**
 * Spike: Details and Layers as a rail down the canvas's left edge, always in
 * view while editing, so the panel can be seen to be there before it opens.
 */

/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { documentInfoIcon, layersIcon } from '../icons';
import { __, Tooltip } from '../../wordpress-packages';
import {
	DETAILS_TAB,
	LAYERS_TAB,
	toggleDocumentPanel,
	useDocumentTab,
} from './state';

const ITEMS = [
	{ tab: DETAILS_TAB, icon: documentInfoIcon, label: __( 'Details' ) },
	{ tab: LAYERS_TAB, icon: layersIcon, label: __( 'Layers' ) },
];

/**
 * @return {Element} The rail.
 */
export function DocumentRail() {
	const tab = useDocumentTab();
	const isOpen = useSelect(
		( select ) => Boolean( select( 'core/editor' )?.isListViewOpened?.() ),
		[]
	);

	return (
		<nav
			aria-label={ __( 'Page details and layers' ) }
			className="cnl-document-rail"
		>
			{ ITEMS.map( ( item ) => {
				const isCurrent = isOpen && tab === item.tab;

				return (
					<Tooltip.Root key={ item.tab }>
						<Tooltip.Trigger
							aria-pressed={ isCurrent }
							className={ `cnl-document-rail__item${
								isCurrent ? ' is-current' : ''
							}` }
							onClick={ () => toggleDocumentPanel( item.tab ) }
							render={ <button type="button" /> }
						>
							<Icon icon={ item.icon } size={ 24 } />
							<span className="cnl-document-rail__label">
								{ item.label }
							</span>
						</Tooltip.Trigger>
						<Tooltip.Popup
							positioner={ <Tooltip.Positioner side="right" /> }
						>
							{ isCurrent ? __( 'Close' ) : item.label }
						</Tooltip.Popup>
					</Tooltip.Root>
				);
			} ) }
		</nav>
	);
}
