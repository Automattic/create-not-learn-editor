/**
 * Options: a ⋮ menu after Save, at the end of the canvas toolbar, while the
 * canvas shows something the full-screen editor can open. Preferences, for
 * every screen, is in the workspace menu at the foot of the sidebar.
 */

/**
 * WordPress dependencies
 */
import { DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { code, moreVertical } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { useCanvasEditRoute } from '../site-canvas/mode';

export function OptionsMenu() {
	const editRoute = useCanvasEditRoute();

	if ( ! editRoute ) {
		return null;
	}

	return (
		<DropdownMenu
			className="cnl-options-menu"
			icon={ moreVertical }
			label={ __( 'Options' ) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ { showTooltip: true } }
		>
			{ ( { onClose } ) => (
				<MenuGroup>
					<MenuItem
						icon={ code }
						onClick={ () => {
							onClose();
							openRoute( editRoute.to, editRoute.search );
						} }
					>
						{ __( 'Open in advanced editor' ) }
					</MenuItem>
				</MenuGroup>
			) }
		</DropdownMenu>
	);
}
