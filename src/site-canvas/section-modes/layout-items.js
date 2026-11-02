/**
 * What a page's layout puts around its sections that the page can change,
 * like its title and featured image. Their words and pictures are the
 * page's, but where they sit and how they look are the layout's, shared with
 * every page that uses it. So they are picked and clicked into as a section
 * is, but have no bar of design choices or moves, and their name says which
 * layout they are part of.
 */

/**
 * Internal dependencies
 */
import { getTemplateDisplayTitle } from '../../records';
import { __, coreDataStore, useSelect } from '../../wordpress-packages';

const EDITOR_STORE = 'core/editor';

const ITEM_TITLES = {
	'core/post-featured-image': () => __( 'Featured image' ),
	'core/post-title': () => __( 'Title' ),
};

/**
 * A layout item's name, for its tab.
 *
 * @param {string}   name         Its block name.
 * @param {Function} getBlockType `blocksStore`'s `getBlockType`.
 * @return {string} The name.
 */
export function getLayoutItemTitle( name, getBlockType ) {
	return (
		ITEM_TITLES[ name ]?.() || getBlockType( name )?.title || __( 'Block' )
	);
}

/**
 * The name of the layout the page is shown in, as the Pages screen's layout
 * picker names it: Standard for the one a page gets by default.
 *
 * @param {boolean} isOn Whether there are layout items to name it for.
 * @return {string} The name, or an empty string while there are none.
 */
export function useLayoutName( isOn ) {
	return useSelect(
		( select ) => {
			if ( ! isOn ) {
				return '';
			}

			const editor = select( EDITOR_STORE );
			const templateId = editor?.getCurrentTemplateId?.();
			const template = templateId
				? select( coreDataStore ).getEditedEntityRecord(
						'postType',
						'wp_template',
						templateId
					)
				: null;

			// The homepage always uses its own layout, chosen or not.
			if (
				! editor?.getEditedPostAttribute( 'template' ) &&
				template?.slug !== 'front-page'
			) {
				return __( 'Standard' );
			}

			return getTemplateDisplayTitle( template ) || __( 'Standard' );
		},
		[ isOn ]
	);
}
