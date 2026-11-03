/**
 * A menu item's text and link, in a popover beside its row in the menu tree.
 *
 * After the popover core's site editor shows for a selected Navigation Link
 * (`ListViewContentPopover`, filled by the block's `Controls`), cut down to
 * what changes an item: its text, where it goes and whether that opens in a
 * new tab. Core's popover only fills while a block's edit renders, and the
 * menu's blocks are only ever shown as a list, so this builds the same form
 * from outside.
 */

/**
 * WordPress dependencies
 */
import { privateApis as blockEditorPrivateApis } from '@wordpress/block-editor';

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import {
	blockEditorStore,
	CheckboxControl,
	coreDataStore,
	decodeEntities,
	escapeHTML,
	InputControl,
	Popover,
	safeDecodeURI,
	sprintf,
	Stack,
	Text,
	useCallback,
	useDispatch,
	useSelect,
	__,
} from '../../wordpress-packages';
import { useNavigationEntityBinding } from './navigation-list-view-link-ui';
import {
	getSuggestionsQuery,
	updateNavigationLinkAttributes,
} from './navigation-link-attributes';

const { isHashLink, isRelativePath, LinkPicker, useRemoteUrlData } = unlock(
	blockEditorPrivateApis
);

const LINK_BLOCKS = [ 'core/navigation-link', 'core/navigation-submenu' ];
const TEXT_ONLY_BLOCKS = [ 'core/home-link' ];
const STATUS_BADGES = {
	publish: { label: __( 'Published' ), intent: 'success' },
	future: { label: __( 'Scheduled' ), intent: 'warning' },
	draft: { label: __( 'Draft' ), intent: 'warning' },
	pending: { label: __( 'Pending' ), intent: 'warning' },
	private: { label: __( 'Private' ), intent: 'default' },
	trash: { label: __( 'Trash' ), intent: 'error' },
};

function getPlainText( value = '' ) {
	return decodeEntities( String( value ).replace( /<[^>]*>/g, '' ) );
}

// After core's `getEntityTitle` in `use-link-preview.js`.
function getEntityTitle( record ) {
	const title = record?.title;

	if ( typeof title === 'string' ) {
		return title;
	}

	if ( title && 'rendered' in title ) {
		return decodeEntities( title.rendered ) || __( '(no title)' );
	}

	return record?.name;
}

// After core's `getEntityTypeName` in `navigation-link/shared/controls.jsx`.
function getEntityTypeName( type, kind ) {
	if ( kind === 'post-type' ) {
		switch ( type ) {
			case 'post':
				return __( 'post' );
			case 'page':
				return __( 'page' );
			default:
				return type || __( 'post' );
		}
	}

	if ( kind === 'taxonomy' ) {
		switch ( type ) {
			case 'category':
				return __( 'category' );
			case 'tag':
				return __( 'tag' );
			default:
				return type || __( 'term' );
		}
	}

	return type || __( 'item' );
}

// After core's `isHomepage` in `use-link-preview.js`, except that an address
// with a query, like a draft's `/?page_id=12`, isn't the homepage.
function isHomepage( url, homeUrl ) {
	if ( url === '/' ) {
		return true;
	}

	if ( ! url || ! homeUrl ) {
		return false;
	}

	try {
		const urlParsed = new URL( url, homeUrl );
		const homeParsed = new URL( homeUrl );

		return (
			! urlParsed.search &&
			urlParsed.hostname === homeParsed.hostname &&
			urlParsed.pathname.replace( /\/$/, '' ) ===
				homeParsed.pathname.replace( /\/$/, '' )
		);
	} catch {
		return false;
	}
}

// After core's `computeDisplayUrl` in `use-link-preview.js`.
function getDisplayUrl( url, homeUrl ) {
	if ( ! url ) {
		return { displayUrl: '', isExternal: false };
	}

	if ( isRelativePath( url ) || isHashLink( url ) ) {
		return { displayUrl: safeDecodeURI( url ), isExternal: false };
	}

	try {
		const parsedUrl = new URL( url );

		if ( parsedUrl.host !== new URL( homeUrl ).host ) {
			return { displayUrl: safeDecodeURI( url ), isExternal: true };
		}

		let path = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
		if ( path.endsWith( '/' ) && path.length > 1 ) {
			path = path.slice( 0, -1 );
		}

		return { displayUrl: safeDecodeURI( path ), isExternal: false };
	} catch {
		return { displayUrl: safeDecodeURI( url ), isExternal: true };
	}
}

// After core's `computeBadges` in `use-link-preview.js`.
function getBadges( {
	entityStatus,
	homeUrl,
	isEntityAvailable,
	isExternal,
	isTracked,
	type,
	url,
} ) {
	const badges = [];

	if ( url ) {
		if ( isExternal ) {
			badges.push( { label: __( 'External link' ), intent: 'default' } );
		} else if ( isHashLink( url ) ) {
			badges.push( { label: __( 'Internal link' ), intent: 'default' } );
		} else if ( isHomepage( url, homeUrl ) ) {
			badges.push( { label: __( 'Homepage' ), intent: 'default' } );
		} else if ( type && type !== 'custom' ) {
			badges.push( {
				label: type.charAt( 0 ).toUpperCase() + type.slice( 1 ),
				intent: 'default',
			} );
		} else {
			badges.push( { label: __( 'Page' ), intent: 'default' } );
		}
	}

	if ( isTracked && ! isEntityAvailable ) {
		badges.push( {
			label: sprintf(
				/* translators: %s is the entity type (e.g., "page", "post", "category") */
				__( 'Missing %s' ),
				type
			),
			intent: 'error',
		} );
	} else if ( ! url ) {
		badges.push( { label: __( 'No link selected' ), intent: 'error' } );
	} else if ( STATUS_BADGES[ entityStatus ] ) {
		badges.push( STATUS_BADGES[ entityStatus ] );
	}

	return badges;
}

/**
 * What a menu item links to, and whether it will show on the site, after
 * core's `useEntityBinding` and `useIsInvalidLink`.
 *
 * Core only checks links bound to what they link to. Menu items added from a
 * page here aren't bound, but the site leaves them out just the same when the
 * page is a draft, in the trash or deleted (`item-should-render.php`), so
 * they're checked too.
 *
 * @param {Object} args            Arguments.
 * @param {Object} args.attributes The item's attributes.
 * @param {string} args.clientId   The item's block.
 * @return {Object} The binding helpers, the linked record and its state.
 */
function useMenuItemLink( { attributes, clientId } ) {
	const { id, kind, type, url: storedUrl } = attributes;
	const binding = useNavigationEntityBinding( { attributes, clientId } );
	const { hasUrlBinding } = binding;
	const isPostType =
		kind === 'post-type' || type === 'post' || type === 'page';
	const isUnboundPostType =
		! hasUrlBinding && isPostType && Number.isInteger( id );
	const { boundUrl, unboundRecord, isUnboundMissing } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const result = {
				boundUrl: undefined,
				isUnboundMissing: false,
				unboundRecord: null,
			};

			// A bound link goes wherever its page or term is now, as core's
			// `core/post-data` and `core/term-data` sources say.
			if ( hasUrlBinding && kind === 'post-type' ) {
				result.boundUrl = store.getEditedEntityRecord(
					'postType',
					type,
					id
				)?.link;
			}

			if ( isUnboundPostType ) {
				const args = [ 'postType', type, id ];
				result.unboundRecord = store.getEntityRecord( ...args ) || null;
				result.isUnboundMissing =
					store.hasFinishedResolution( 'getEntityRecord', args ) &&
					! result.unboundRecord;
			}

			return result;
		},
		[ hasUrlBinding, id, isUnboundPostType, kind, type ]
	);
	const entityRecord = hasUrlBinding ? binding.entityRecord : unboundRecord;
	const isEntityAvailable = hasUrlBinding
		? binding.isBoundEntityAvailable
		: ! isUnboundMissing;
	const isTracked = hasUrlBinding || isUnboundPostType;
	const url =
		boundUrl || ( hasUrlBinding && entityRecord?.link ) || storedUrl;

	return {
		...binding,
		entityRecord,
		isDraft: entityRecord?.status === 'draft',
		isEntityAvailable,
		// Core counts a trashed or deleted page as invalid, and a missing
		// bound page or term.
		isInvalid:
			isTracked &&
			( ! isEntityAvailable ||
				( isPostType && entityRecord?.status === 'trash' ) ),
		isTracked,
		url,
	};
}

/**
 * Where the link picker's button says the item goes, after core's
 * `useLinkPreview`.
 *
 * @param {Object} args      Arguments.
 * @param {Object} args.link What `useMenuItemLink` says about the item.
 * @param {string} args.type The item's type.
 * @return {Object} `{ title, url, image, badges }` for `LinkPicker`.
 */
function useLinkPreview( { link, type } ) {
	const { entityRecord, isEntityAvailable, isTracked, url } = link;
	const homeUrl = useSelect(
		( select ) =>
			select( coreDataStore ).getEntityRecord( 'root', '__unstableBase' )
				?.home,
		[]
	);
	const title = getEntityTitle( entityRecord );
	// Only links to other sites lack a title to show.
	const { richData } = useRemoteUrlData( title ? null : url );
	const image = useSelect(
		( select ) => {
			if ( ! entityRecord?.featured_media ) {
				return null;
			}

			const media = select( coreDataStore ).getEntityRecord(
				'postType',
				'attachment',
				entityRecord.featured_media
			);

			return (
				media?.media_details?.sizes?.thumbnail?.source_url ||
				media?.media_details?.sizes?.medium?.source_url ||
				media?.source_url ||
				null
			);
		},
		[ entityRecord?.featured_media ]
	);
	const { displayUrl, isExternal } = getDisplayUrl( url, homeUrl );

	return {
		badges: getBadges( {
			entityStatus: entityRecord?.status,
			homeUrl,
			isEntityAvailable,
			isExternal,
			isTracked,
			type,
			url,
		} ),
		image,
		title: url
			? title || richData?.title || safeDecodeURI( url )
			: __( 'Add link' ),
		url: displayUrl,
	};
}

/**
 * Whether a row's item can be edited here, and how much of it.
 *
 * @param {Object} block The row's block.
 * @return {false|'text'|'link'} `'link'` for text and link, `'text'` for text
 *                               only, or `false` for no popover.
 */
export function getMenuItemEditing( block ) {
	if ( TEXT_ONLY_BLOCKS.includes( block?.name ) ) {
		return 'text';
	}

	if ( ! LINK_BLOCKS.includes( block?.name ) ) {
		return false;
	}

	// A drop-down that only opens its items has no link to change.
	const { url } = block.attributes;
	if (
		block.name === 'core/navigation-submenu' &&
		( ! url || url === '#' )
	) {
		return 'text';
	}

	return 'link';
}

function MenuItemLinkFields( { attributes, clientId, onUpdate } ) {
	const { kind, opensInNewTab, type } = attributes;
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const link = useMenuItemLink( { attributes, clientId } );
	const { clearBinding, createBinding, entityRecord, hasUrlBinding } = link;
	const preview = useLinkPreview( { link, type } );

	let help;
	if ( link.isInvalid ) {
		help = __(
			'This link is invalid and will not appear on your site. Please update the link.'
		);
	} else if ( link.isDraft ) {
		const entityType = getEntityTypeName( type, kind );
		help = sprintf(
			/* translators: %1$s is the entity type (e.g., "page", "post", "category") */
			__(
				'This link is to a draft %1$s and will not appear on your site until the %1$s is published.'
			),
			entityType
		);
	}

	// After core's `useHandleLinkChange`.
	const onSelect = useCallback(
		( newLink ) => {
			if ( ! newLink ) {
				return;
			}

			// Core only gives an item the new page's title when it has no text.
			// Text that still says where the item went follows it here too, so
			// "About" doesn't stay on a link to the Café. Text someone wrote
			// stays.
			const currentText = getPlainText( attributes.label ).trim();
			const followsLink =
				! currentText ||
				currentText === getEntityTitle( entityRecord ) ||
				currentText === preview.title;
			const title = followsLink ? newLink.title : undefined;

			// From a page or term to a typed address: drop the binding first,
			// then set the attributes straight, as core does.
			if ( ! newLink.id && hasUrlBinding ) {
				clearBinding();
				updateBlockAttributes( clientId, {
					id: undefined,
					kind: 'custom',
					type: 'custom',
					url: newLink.url,
					...( title ? { label: escapeHTML( title ) } : {} ),
				} );
				return;
			}

			const { attributes: updatedAttributes, isEntityLink } =
				updateNavigationLinkAttributes(
					{
						id: newLink.id,
						kind: newLink.kind,
						title,
						type: newLink.type,
						url: newLink.url,
					},
					onUpdate,
					attributes
				);

			if ( isEntityLink ) {
				createBinding( updatedAttributes );
			} else {
				clearBinding();
			}
		},
		[
			attributes,
			clearBinding,
			clientId,
			createBinding,
			entityRecord,
			hasUrlBinding,
			onUpdate,
			preview.title,
			updateBlockAttributes,
		]
	);

	return (
		<>
			<LinkPicker
				help={ help }
				label={ __( 'Link to' ) }
				onSelect={ onSelect }
				preview={ preview }
				suggestionsQuery={ getSuggestionsQuery( type, kind ) }
			/>
			<CheckboxControl
				checked={ !! opensInNewTab }
				label={ __( 'Open in new tab' ) }
				onChange={ ( value ) => onUpdate( { opensInNewTab: value } ) }
			/>
		</>
	);
}

/**
 * The popover itself.
 *
 * @param {Object}   props           Component props.
 * @param {Object}   props.anchor    What it sits beside.
 * @param {string}   props.clientId  The item's block.
 * @param {Function} props.onClose   Called to close it.
 * @param {string}   props.placement Which side of the anchor it opens on.
 * @return {Element|null} The popover, or nothing for an item it can't edit.
 */
export default function NavigationListViewItemPopover( {
	anchor,
	clientId,
	onClose,
	placement,
} ) {
	const block = useSelect(
		( select ) => select( blockEditorStore ).getBlock( clientId ),
		[ clientId ]
	);
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const onUpdate = useCallback(
		( attributes ) => updateBlockAttributes( clientId, attributes ),
		[ clientId, updateBlockAttributes ]
	);
	const editing = getMenuItemEditing( block );

	if ( ! editing ) {
		return null;
	}

	const text = getPlainText( block.attributes.label );

	return (
		<Popover
			anchor={ anchor }
			className="routes-navigation-edit-list-view__item-popover"
			offset={ 12 }
			onClose={ onClose }
			placement={ placement }
			shift
		>
			<Stack
				className="routes-navigation-edit-list-view__item-form"
				direction="column"
				gap="lg"
			>
				<Text
					className="routes-navigation-edit-list-view__item-title"
					render={ <h2 /> }
					variant="heading-md"
				>
					{ text.trim() || __( 'Menu item' ) }
				</Text>
				<InputControl
					autoComplete="off"
					label={ __( 'Text' ) }
					onValueChange={ ( value ) => onUpdate( { label: value } ) }
					value={ text }
				/>
				{ editing === 'link' && (
					<MenuItemLinkFields
						attributes={ block.attributes }
						clientId={ clientId }
						onUpdate={ onUpdate }
					/>
				) }
			</Stack>
		</Popover>
	);
}
