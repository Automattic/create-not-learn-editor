/**
 * Options: the top bar's ⋮ menu, in the top right corner, where the editor
 * keeps its own.
 */

/**
 * WordPress dependencies
 */
import { DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { moreVertical } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { openPreferences } from '../preferences';

export function OptionsMenu() {
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
						onClick={ () => {
							onClose();
							openPreferences();
						} }
					>
						{ __( 'Preferences' ) }
					</MenuItem>
				</MenuGroup>
			) }
		</DropdownMenu>
	);
}
