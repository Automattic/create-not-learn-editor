/**
 * Quick add: the blue + in the top bar's top left corner, a way to add
 * something new from any screen.
 *
 * Its menu lists each kind of content the site has that the person can add,
 * pages and posts first, then uploading media. Pages and posts open their
 * list's add flow, by asking the list to add one (`?add=1`, see
 * `src/routes/content/content.jsx`). Upload media opens the same upload
 * modal as the Media screen's Upload button, from any screen (see
 * `src/upload-media`).
 */

/**
 * WordPress dependencies
 */
import { DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { page, plus, post, upload } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { getPostTypes } from '../settings';
import { UploadMediaModal } from '../upload-media';

/*
 * Pages and posts get words of their own. Any other kind the site has is
 * added under its own name.
 */
const KNOWN_TYPES = {
	page: {
		icon: page,
		label: __( 'Create new page' ),
		description: __( 'Start a new page on your site.' ),
	},
	post: {
		icon: post,
		label: __( 'Write new post' ),
		description: __( 'Start a new post on your blog.' ),
	},
};

/**
 * @param {Object} type Post type, from the editor's settings.
 * @return {Object} The type's icon, label and description in the menu.
 */
function getTypeItem( type ) {
	if ( KNOWN_TYPES[ type.name ] ) {
		return KNOWN_TYPES[ type.name ];
	}

	const singular = ( type.singular || type.label ).toLocaleLowerCase();

	return {
		icon: post,
		label: sprintf(
			/* translators: %s: singular name of a post type, like "product". */
			__( 'Add new %s' ),
			singular
		),
		description: sprintf(
			/* translators: %s: plural name of a post type, like "Products". */
			__( 'Start a new one in your %s.' ),
			type.label.toLocaleLowerCase()
		),
	};
}

export function QuickAdd() {
	const [ isUploadOpen, setIsUploadOpen ] = useState( false );
	const types = getPostTypes().filter( ( type ) => type.canCreate );

	return (
		<>
			<DropdownMenu
				className="cnl-quick-add"
				icon={ plus }
				label={ __( 'Add new' ) }
				popoverProps={ {
					className: 'cnl-quick-add__popover',
					placement: 'bottom-start',
				} }
				toggleProps={ {
					className: 'cnl-quick-add__toggle',
					showTooltip: true,
					size: 'compact',
					variant: 'primary',
				} }
			>
				{ ( { onClose } ) => (
					<>
						{ !! types.length && (
							<MenuGroup>
								{ types.map( ( type ) => {
									const item = getTypeItem( type );

									return (
										<MenuItem
											icon={ item.icon }
											iconPosition="left"
											info={ item.description }
											key={ type.name }
											onClick={ () => {
												onClose();
												openRoute(
													`/types/${ type.name }/list/all`,
													{ add: 1 }
												);
											} }
										>
											{ item.label }
										</MenuItem>
									);
								} ) }
							</MenuGroup>
						) }
						<MenuGroup>
							<MenuItem
								icon={ upload }
								iconPosition="left"
								info={ __(
									'Add files to your media library.'
								) }
								onClick={ () => {
									onClose();
									setIsUploadOpen( true );
								} }
							>
								{ __( 'Upload media' ) }
							</MenuItem>
						</MenuGroup>
					</>
				) }
			</DropdownMenu>
			{ isUploadOpen && (
				<UploadMediaModal onClose={ () => setIsUploadOpen( false ) } />
			) }
		</>
	);
}
