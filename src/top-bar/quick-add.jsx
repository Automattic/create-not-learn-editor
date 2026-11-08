/**
 * Quick add: the blue + in the top bar's top left corner, a way to add
 * something new from any screen.
 *
 * Its menu lists each kind of content the site has that the person can add,
 * pages and posts first, then uploading media. Pages and posts open their
 * list's add flow, by asking the list to add one (`?add=1`, see
 * `src/routes/content/content.jsx`). Media has no screen in
 * the editor, so it opens the file picker and uploads straight to the media
 * library, with snackbar notices to say how it went.
 */

/**
 * WordPress dependencies
 */
import { DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { dispatch } from '@wordpress/data';
import { useRef } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { page, plus, post, upload } from '@wordpress/icons';
import { uploadMedia } from '@wordpress/media-utils';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { getPostTypes } from '../settings';

const UPLOAD_NOTICE_ID = 'cnl-quick-add-upload';

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

/**
 * @param {File[]} files Files to add to the media library.
 */
function uploadFiles( files ) {
	const notices = dispatch( noticesStore );
	const total = files.length;
	const uploaded = new Set();
	let failed = 0;

	notices.createInfoNotice(
		sprintf(
			/* translators: %d: number of files. */
			_n( 'Uploading %d file…', 'Uploading %d files…', total ),
			total
		),
		{ id: UPLOAD_NOTICE_ID, type: 'snackbar' }
	);

	const finishIfDone = () => {
		if ( uploaded.size + failed < total || ! uploaded.size ) {
			return;
		}

		notices.createSuccessNotice(
			sprintf(
				/* translators: %d: number of files. */
				_n(
					'%d file added to your media library.',
					'%d files added to your media library.',
					uploaded.size
				),
				uploaded.size
			),
			{
				id: UPLOAD_NOTICE_ID,
				type: 'snackbar',
				actions: [
					{
						label: __( 'Open media library' ),
						// WP Admin's, in a new tab, so the editor stays open.
						onClick: () =>
							window.open(
								new URL( 'upload.php', window.location.href ),
								'_blank'
							),
					},
				],
			}
		);
	};

	uploadMedia( {
		filesList: files,
		onFileChange: ( attachments ) => {
			attachments.forEach( ( attachment ) => {
				// Each file shows first as a blob, then as the saved attachment.
				if ( attachment?.id ) {
					uploaded.add( attachment.id );
				}
			} );
			finishIfDone();
		},
		onError: ( error ) => {
			failed++;
			notices.createErrorNotice( error.message, { type: 'snackbar' } );

			if ( failed === total ) {
				notices.removeNotice( UPLOAD_NOTICE_ID );
			}

			finishIfDone();
		},
	} );
}

export function QuickAdd() {
	const fileInput = useRef();
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
									fileInput.current?.click();
								} }
							>
								{ __( 'Upload media' ) }
							</MenuItem>
						</MenuGroup>
					</>
				) }
			</DropdownMenu>
			<input
				className="cnl-quick-add__file"
				multiple
				onChange={ ( event ) => {
					const files = Array.from( event.target.files || [] );

					// Cleared so picking the same file again still uploads it.
					event.target.value = '';

					if ( files.length ) {
						uploadFiles( files );
					}
				} }
				ref={ fileInput }
				tabIndex={ -1 }
				type="file"
				aria-hidden="true"
			/>
		</>
	);
}
