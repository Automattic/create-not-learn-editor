/**
 * Pages kept out of a Page List block, in the editor.
 *
 * A menu that is only a Page List block updates itself, and the Pages screen
 * keeps it that way by leaving pages out of the block rather than turning the
 * menu into links. This gives the block the `excludedPageIDs` attribute that
 * says which, and hides those pages wherever the block shows in the editor.
 * A page left out takes the pages under it with it, as on the site.
 *
 * The site's side is `includes/page-list.php`.
 *
 * WordPress dependencies
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * as this is registered from app init (see `template-part-editing.jsx`).
 */
import { addFilter } from '@wordpress/hooks';

export const EXCLUDED_PAGES_ATTRIBUTE = 'excludedPageIDs';

const CONTEXT_KEY = 'create-not-learn-editor/excludedPageIDs';
const NAMESPACE = 'create-not-learn-editor/page-list-excluded-pages';

function addExcludedPagesSupport( settings, name ) {
	if ( name === 'core/page-list' ) {
		return {
			...settings,
			attributes: {
				...settings.attributes,
				[ EXCLUDED_PAGES_ATTRIBUTE ]: {
					default: [],
					items: { type: 'integer' },
					type: 'array',
				},
			},
			providesContext: {
				...settings.providesContext,
				[ CONTEXT_KEY ]: EXCLUDED_PAGES_ATTRIBUTE,
			},
		};
	}

	if ( name === 'core/page-list-item' ) {
		return {
			...settings,
			usesContext: [ ...( settings.usesContext || [] ), CONTEXT_KEY ],
		};
	}

	return settings;
}

function withExcludedPagesHidden( BlockEdit ) {
	return function PageListItemEdit( props ) {
		if (
			props.name === 'core/page-list-item' &&
			( props.context?.[ CONTEXT_KEY ] || [] ).includes(
				Number( props.attributes?.id )
			)
		) {
			return null;
		}

		return <BlockEdit { ...props } />;
	};
}

/**
 * Let Page List blocks leave pages out. Must run before the block library
 * registers its blocks, which happens when the editor's assets load.
 */
export function registerPageListExcludedPages() {
	addFilter( 'blocks.registerBlockType', NAMESPACE, addExcludedPagesSupport );
	addFilter( 'editor.BlockEdit', NAMESPACE, withExcludedPagesHidden );
}
