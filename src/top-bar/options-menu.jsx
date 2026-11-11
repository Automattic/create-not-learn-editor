/**
 * Options: the top bar's ⋮ menu, in the top right corner, where the editor
 * keeps its own. While the canvas shows something the full-screen editor can
 * open, it offers that too.
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
import { openPreferences } from '../preferences';
import { useCanvasEditRoute } from '../site-canvas/mode';

export function OptionsMenu() {
	const editRoute = useCanvasEditRoute();

	return (
		<DropdownMenu
			className="cnl-options-menu"
			icon={ moreVertical }
			label={ __( 'Options' ) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ { showTooltip: true } }
		>
			{ ( { onClose } ) => (
				<>
					{ editRoute && (
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
					<MenuGroup>
						<MenuItem
							onClick={ () => {
								onClose();
								openPreferences();
							} }
						>
							{ __( 'Preferences' ) }
						</MenuItem>
					</MenuGroup>
				</>
			) }
		</DropdownMenu>
	);
}
