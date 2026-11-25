/**
 * Data for the Site parts screens: which header and footer the homepage
 * uses, what is in them, and the layouts the theme offers for them.
 */

/**
 * Internal dependencies
 */
import { getSitePartArea } from '../content/pages/data';
import {
	__,
	_n,
	blockEditorStore,
	coreDataStore,
	sprintf,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];

// The screen that leads to each part's screen.
export const SITE_PARTS_PATH = '/site-parts';

export const SITE_PART_PATHS = {
	footer: '/site-parts/footer',
	header: '/site-parts/header',
};

/**
 * Pick the part a screen is about from the site parts on the page, in the
 * order they appear: the first header, or the last footer.
 *
 * @param {Object[]} parts `{ area }` items, in page order.
 * @param {string}   area  `header` or `footer`.
 * @return {Object|null} The part, or `null` when the page has none.
 */
export function pickSitePart( parts, area ) {
	const matches = ( parts || EMPTY_ARRAY ).filter(
		( part ) => part.area === area
	);

	return ( area === 'footer' ? matches.at( -1 ) : matches[ 0 ] ) || null;
}

/**
 * Every site part in the editor, in page order.
 *
 * @param {Object} store `blockEditorStore` selectors.
 * @param {string} theme Current theme's stylesheet.
 * @return {Object[]} `{ area, clientId, id }` items.
 */
export function getSiteParts( store, theme ) {
	const parts = [];
	const visit = ( rootClientId ) =>
		store.getBlockOrder( rootClientId ).forEach( ( clientId ) => {
			if ( store.getBlockName( clientId ) === 'core/template-part' ) {
				const attributes = store.getBlockAttributes( clientId ) || {};
				const area = getSitePartArea( attributes, theme );

				if ( area ) {
					parts.push( {
						area,
						clientId,
						id: `${ attributes.theme || theme }//${
							attributes.slug
						}`,
					} );
				}

				// A part's own blocks are never another site part.
				return;
			}

			visit( clientId );
		} );

	visit( '' );

	return parts;
}

/**
 * The site part the editor on the canvas shows: the homepage's header or
 * footer. Read from the block editor, which the canvas fills, so it is only
 * known once the editor has loaded.
 *
 * @param {string} area `header` or `footer`.
 * @return {Object} `{ clientId, id, isEditorReady }`. `clientId` and `id` are
 *                  `null` until found, or when the page has no such part.
 */
export function useSitePart( area ) {
	const { clientId, id, isEditorReady } = useSelect(
		( select ) => {
			const store = select( blockEditorStore );
			const theme = select( coreDataStore ).getCurrentTheme()?.stylesheet;
			const isReady = !! theme && store.getBlockOrder( '' ).length > 0;
			const part = isReady
				? pickSitePart( getSiteParts( store, theme ), area )
				: null;

			return {
				clientId: part?.clientId || null,
				id: part?.id || null,
				isEditorReady: isReady,
			};
		},
		[ area ]
	);

	return { clientId, id, isEditorReady };
}

/**
 * What a site part holds that the screen offers controls for.
 *
 * @param {string[]} names Names of every block in the part.
 * @return {Object} `{ hasLogo, hasNavigation, hasSiteTitle,
 *                  hasSocialLinks }`.
 */
export function getSitePartContents( names ) {
	const has = ( name ) => ( names || EMPTY_ARRAY ).includes( name );

	return {
		hasLogo: has( 'core/site-logo' ),
		hasNavigation: has( 'core/navigation' ),
		hasSiteTitle: has( 'core/site-title' ),
		hasSocialLinks: has( 'core/social-links' ),
	};
}

/**
 * The menus a site part shows, one for each of its Navigation blocks that
 * shows a saved menu. A Navigation block with links of its own shows no
 * menu: its links are changed where they are, on the canvas.
 *
 * @param {Object} store       `blockEditorStore` selectors.
 * @param {string} descendants Client IDs of every block in the part.
 * @return {Object[]} `{ clientId, index, ref }` items. `index` is the
 *                    block's place among the part's Navigation blocks, and
 *                    `ref` is undefined when it shows the site's first menu.
 */
export function getSitePartMenus( store, descendants ) {
	return descendants
		.filter( ( id ) => store.getBlockName( id ) === 'core/navigation' )
		.map( ( id, index ) => ( {
			clientId: id,
			index,
			ref: store.getBlockAttributes( id )?.ref,
		} ) )
		.filter(
			( menu ) => !! menu.ref || ! store.getBlockCount( menu.clientId )
		);
}

/**
 * What a site part in the editor holds, and the menus it shows.
 *
 * @param {?string} clientId The part's client ID in the editor.
 * @return {Object} `{ hasLogo, hasNavigation, hasSiteTitle, hasSocialLinks,
 *                  menus }`. See `getSitePartMenus` for `menus`.
 */
export function useSitePartContents( clientId ) {
	const { menus, names } = useSelect(
		( select ) => {
			if ( ! clientId ) {
				return { menus: '', names: '' };
			}

			const store = select( blockEditorStore );
			const descendants = store.getClientIdsOfDescendants( clientId );

			// Joined, so the selector returns values that only change when
			// the part's blocks do.
			return {
				menus: JSON.stringify( getSitePartMenus( store, descendants ) ),
				names: [
					...new Set(
						descendants.map( ( id ) => store.getBlockName( id ) )
					),
				].join( ',' ),
			};
		},
		[ clientId ]
	);

	return useMemo(
		() => ( {
			...getSitePartContents( names ? names.split( ',' ) : [] ),
			menus: menus ? JSON.parse( menus ) : EMPTY_ARRAY,
		} ),
		[ menus, names ]
	);
}

export {
	getCurrentPatternName,
	getSitePartContent,
	getSitePartPatterns,
	putLayoutFirst,
	useSitePartLayouts,
} from './layouts';

// What a menu holds, from its saved blocks: its links, and whether it lists
// the site's pages by itself.
export function getLinkCount( menu ) {
	const content = String(
		( typeof menu?.content === 'string'
			? menu.content
			: menu?.content?.raw ) || ''
	);
	const count = (
		content.match(
			/<!-- wp:(navigation-link|navigation-submenu|home-link)\b/g
		) || []
	).length;
	const hasPages = content.includes( '<!-- wp:page-list' );

	if ( hasPages && ! count ) {
		return __( 'Lists your pages', 'create-not-learn-editor' );
	}

	const links = sprintf(
		/* translators: %d: Number of links in a menu. */
		_n( '%d link', '%d links', count, 'create-not-learn-editor' ),
		count
	);

	return hasPages
		? sprintf(
				/* translators: %s: Number of links, like "2 links". */
				__( '%s and your pages', 'create-not-learn-editor' ),
				links
			)
		: links;
}
