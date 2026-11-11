/**
 * What Compose works on in the editor: the page's sections, and what the
 * template puts around them, like the header, footer and title.
 *
 * Only a page has sections. Anything else, like a layout or a post, is
 * edited block by block, so it has none, and no layout items. Its template
 * parts still count, as on a page: every template part, wherever it is, the
 * header and footer as much as a sidebar or a second header.
 *
 * Sections are the blocks of core's section root, the one its own zoom-out
 * treats as sections: the Post Content block when a page is shown in its
 * template, or a template's `main` group. Without one, the template's own
 * top-level blocks are taken, less its header and footer.
 *
 * A page shown in its template can change some of what the template puts
 * around its sections, like its title and featured image: core leaves those
 * blocks editable, for their content only. They are the layout's items.
 */

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import {
	blockEditorStore,
	coreDataStore,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const SITE_PART_AREAS = [ 'header', 'footer' ];

const TEMPLATE_PART = 'core/template-part';

const EDITOR_STORE = 'core/editor';

const EMPTY_ARRAY = [];

/**
 * The header or footer a template part block shows, if it shows one.
 *
 * @param {Object} attributes Template part block attributes.
 * @param {Object} record     Its template part record, if loaded.
 * @return {?string} `header`, `footer`, or nothing.
 */
export function getSitePartArea( attributes, record ) {
	const area = attributes?.area || record?.area;

	if ( SITE_PART_AREAS.includes( area ) ) {
		return area;
	}

	return (
		SITE_PART_AREAS.find( ( name ) =>
			String( attributes?.slug || '' ).includes( name )
		) || null
	);
}

/**
 * Describe a template part block, as a part of the site.
 *
 * Its area is the header or footer it shows, else the area its record
 * gives it, like a sidebar, else `uncategorized`.
 *
 * @param {string} clientId Template part block client ID.
 * @param {Object} store    `blockEditorStore` selectors.
 * @param {Object} entities `coreDataStore` selectors.
 * @param {string} theme    Current theme's stylesheet, for part IDs.
 * @return {string} `clientId|area|id|title`.
 */
function describePart( clientId, store, entities, theme ) {
	const attributes = store.getBlockAttributes( clientId ) || {};
	const id = attributes.slug
		? `${ attributes.theme || theme }//${ attributes.slug }`
		: '';
	const record = id
		? entities.getEditedEntityRecord( 'postType', 'wp_template_part', id )
		: null;
	const area =
		getSitePartArea( attributes, record ) ||
		attributes.area ||
		record?.area ||
		'uncategorized';
	const title =
		typeof record?.title === 'string'
			? record.title
			: record?.title?.rendered || record?.title?.raw || '';

	return [ clientId, area, id, title.replace( /\|/g, ' ' ) ].join( '|' );
}

/**
 * The template parts in the editor: the outermost ones, as a part inside
 * another, like a menu's overlay, goes with it. Not any in the sections
 * themselves, which are part of their section.
 *
 * @param {Object} store       `blockEditorStore` selectors.
 * @param {string} sectionRoot The section root's client ID, if sections are
 *                             found.
 * @return {string[]} Their client IDs, top to bottom.
 */
function findParts( store, sectionRoot ) {
	return store.getBlocksByName( TEMPLATE_PART ).filter( ( clientId ) => {
		const parents = store.getBlockParents( clientId );

		return ! parents.some(
			( parentId ) =>
				parentId === sectionRoot ||
				store.getBlockName( parentId ) === TEMPLATE_PART
		);
	} );
}

/**
 * Describe a block the template puts around the page's sections.
 *
 * @param {string} clientId Block client ID.
 * @param {Object} store    `blockEditorStore` selectors.
 * @param {string} position `before` or `after` the sections.
 * @return {string} `position|clientId|name`.
 */
function describeTemplateElement( clientId, store, position ) {
	return [ position, clientId, store.getBlockName( clientId ) ].join( '|' );
}

/**
 * The blocks of a template element a page can change, like its title or
 * featured image: the outermost ones core hasn't disabled. Not in a header
 * or footer, which are opened on purpose.
 *
 * @param {string}   clientId A block the template puts around the sections.
 * @param {Object}   store    `blockEditorStore` selectors.
 * @param {string[]} found    Collects the client IDs.
 * @return {string[]} `found`.
 */
function collectLayoutItems( clientId, store, found = [] ) {
	if ( store.getBlockName( clientId ) === 'core/template-part' ) {
		return found;
	}

	if ( store.getBlockEditingMode( clientId ) !== 'disabled' ) {
		found.push( clientId );
		return found;
	}

	store
		.getBlockOrder( clientId )
		.forEach( ( childId ) => collectLayoutItems( childId, store, found ) );

	return found;
}

/**
 * @param {Object}  options
 * @param {boolean} options.hasSections Whether what is edited is built from
 *                                      sections, as a page is. Without,
 *                                      there are no sections or layout
 *                                      items, only its template parts.
 * @return {Object} `{ layoutItems, parts, rootClientId, sectionIds,
 *                  templateElements }`.
 *                  `templateElements` are the blocks the template puts
 *                  around the sections, top to bottom, each `{ clientId,
 *                  name, position }`. `parts` are its template parts, each
 *                  `{ area, clientId, id, title }`, `id` being the template
 *                  part's record ID. `layoutItems` are the blocks in the
 *                  template elements that the page can change, each `{
 *                  clientId, name }`, only while a page is shown in its
 *                  template.
 */
export function useComposeStructure( { hasSections = true } = {} ) {
	/*
	 * Kept to strings and the store's own arrays, so the selector returns the
	 * same value until something Compose shows has changed.
	 */
	const { elementsKey, itemsKey, partsKey, rootClientId, sectionsKey } =
		useSelect(
			( select ) => {
				const store = unlock( select( blockEditorStore ) );
				const entities = select( coreDataStore );
				const theme = entities.getCurrentTheme()?.stylesheet;
				const root = hasSections
					? store.getSectionRootClientId() || ''
					: '';
				const partsFound = findParts( store, root )
					.map( ( clientId ) =>
						describePart( clientId, store, entities, theme )
					)
					.join( '\n' );

				if ( ! hasSections ) {
					return {
						elementsKey: '',
						itemsKey: '',
						partsKey: partsFound,
						rootClientId: '',
						sectionsKey: '',
					};
				}

				const before = [];
				const after = [];
				const aroundIds = [];
				let sections;

				if ( root ) {
					sections = store.getBlockOrder( root );

					// Walk up from the sections to the template's root,
					// collecting the blocks beside them at each level.
					let pathId = root;
					let parentId = store.getBlockRootClientId( root ) || '';

					for (;;) {
						const siblings = store.getBlockOrder( parentId );
						const index = siblings.indexOf( pathId );

						aroundIds.push(
							...siblings.slice( 0, index ),
							...siblings.slice( index + 1 )
						);
						before.unshift(
							...siblings
								.slice( 0, index )
								.map( ( clientId ) =>
									describeTemplateElement(
										clientId,
										store,
										'before'
									)
								)
						);
						after.push(
							...siblings
								.slice( index + 1 )
								.map( ( clientId ) =>
									describeTemplateElement(
										clientId,
										store,
										'after'
									)
								)
						);

						if ( ! parentId ) {
							break;
						}

						pathId = parentId;
						parentId = store.getBlockRootClientId( parentId ) || '';
					}
				} else {
					// No section root: the template's own blocks are the
					// sections, less its template parts.
					const order = store.getBlockOrder( '' );
					const isPart = ( clientId ) =>
						store.getBlockName( clientId ) === TEMPLATE_PART;
					const first = order.findIndex(
						( clientId ) => ! isPart( clientId )
					);

					sections = order.filter(
						( clientId ) => ! isPart( clientId )
					);
					order.forEach( ( clientId, index ) => {
						if ( isPart( clientId ) ) {
							const position =
								index < first || first === -1
									? 'before'
									: 'after';

							( position === 'before' ? before : after ).push(
								describeTemplateElement(
									clientId,
									store,
									position
								)
							);
						}
					} );
				}

				// Only a page in its template: editing the template itself,
				// every block of it is the template's own.
				const layoutItems =
					select( EDITOR_STORE )?.getRenderingMode?.() ===
					'template-locked'
						? aroundIds.flatMap( ( clientId ) =>
								collectLayoutItems( clientId, store ).map(
									( itemId ) =>
										`${ itemId }|${ store.getBlockName(
											itemId
										) }`
								)
							)
						: [];

				return {
					elementsKey: [ ...before, ...after ].join( '\n' ),
					itemsKey: layoutItems.join( '\n' ),
					partsKey: partsFound,
					rootClientId: root,
					sectionsKey: sections.join( ' ' ),
				};
			},
			[ hasSections ]
		);

	return useMemo( () => {
		const templateElements = elementsKey
			? elementsKey.split( '\n' ).map( ( line ) => {
					const [ position, clientId, name ] = line.split( '|' );

					return { clientId, name, position };
				} )
			: EMPTY_ARRAY;
		const parts = partsKey
			? partsKey.split( '\n' ).map( ( line ) => {
					const [ clientId, area, id, title ] = line.split( '|' );

					return { area, clientId, id: id || null, title };
				} )
			: EMPTY_ARRAY;
		const layoutItems = itemsKey
			? itemsKey.split( '\n' ).map( ( line ) => {
					const [ clientId, name ] = line.split( '|' );

					return { clientId, name };
				} )
			: EMPTY_ARRAY;

		return {
			layoutItems,
			parts,
			rootClientId,
			sectionIds: sectionsKey ? sectionsKey.split( ' ' ) : EMPTY_ARRAY,
			templateElements,
		};
	}, [ elementsKey, itemsKey, partsKey, rootClientId, sectionsKey ] );
}
