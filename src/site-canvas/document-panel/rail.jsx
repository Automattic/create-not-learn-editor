/**
 * The document's panels as a rail of icons down the canvas's left edge,
 * always in view while editing. Each opens its panel beside the rail in one
 * click, and says in its tooltip what the panel is for.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { tableOfContents } from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { layersIcon } from '../icons';
import { unlock } from '../../lock-unlock';
import { __, LegacyIcon, sprintf, Tooltip } from '../../wordpress-packages';
import {
	DETAILS_TAB,
	LAYERS_TAB,
	OUTLINE_TAB,
	toggleDocumentPanel,
	useDocumentTab,
} from './state';

const EDITOR_STORE = 'core/editor';

export const RAIL_ITEMS = [
	{
		tab: DETAILS_TAB,
		// The document's own icon, picked as core's editor picks it.
		icon: null,
		label: __( 'Details', 'create-not-learn-editor' ),
	},
	{
		tab: LAYERS_TAB,
		icon: layersIcon,
		label: __( 'Layers', 'create-not-learn-editor' ),
	},
	{
		tab: OUTLINE_TAB,
		icon: tableOfContents,
		label: __( 'Outline', 'create-not-learn-editor' ),
	},
];

/**
 * What each panel is for, said in its tooltip, about the kind of document
 * being edited.
 *
 * @param {string} tab      The panel.
 * @param {string} typeName The kind of document, in lower case, like page.
 * @return {string} The description.
 */
function getDescription( tab, typeName ) {
	switch ( tab ) {
		case DETAILS_TAB:
			return sprintf(
				/* translators: %s: The kind of document, like page. */
				__(
					'See and change this %s’s title, status, address and layout.',
					'create-not-learn-editor'
				),
				typeName
			);
		case LAYERS_TAB:
			return sprintf(
				/* translators: %s: The kind of document, like page. */
				__(
					'See everything on this %s in order, and pick any part to change it.',
					'create-not-learn-editor'
				),
				typeName
			);
		case OUTLINE_TAB:
			return sprintf(
				/* translators: %s: The kind of document, like page. */
				__(
					'See this %s’s headings, to check it reads in a clear order.',
					'create-not-learn-editor'
				),
				typeName
			);
	}
}

/**
 * @param {Object}        props
 * @param {Object|string} props.icon An SVG icon, or a dashicon's name.
 * @return {Element} The icon, at the rail's size.
 */
function RailIcon( { icon } ) {
	// The design system's `Icon` only renders SVGs.
	return typeof icon === 'string' ? (
		<LegacyIcon icon={ icon } size={ 24 } />
	) : (
		<Icon icon={ icon } size={ 24 } />
	);
}

/**
 * @return {Element} The rail.
 */
export function DocumentRail() {
	const tab = useDocumentTab();
	const { documentIcon, isOpen, toggleRef, typeName } = useSelect(
		( select ) => {
			const editor = select( EDITOR_STORE );
			const postType = editor.getCurrentPostType();

			return {
				// Core's editor picks the same icon for the document: a
				// page's, a post's, a template part's area's, or a custom
				// type's dashicon. See `docs/editor-workarounds.md`.
				documentIcon: unlock( editor ).getPostIcon( postType, {
					area: editor.getEditedPostAttribute( 'area' ),
				} ),
				isOpen: Boolean( editor.isListViewOpened() ),
				// Core hands focus back here when its sidebar closes.
				toggleRef: unlock( editor ).getListViewToggleRef(),
				typeName:
					select( coreDataStore )
						.getPostType( postType )
						?.labels?.singular_name?.toLowerCase() ||
					__( 'document', 'create-not-learn-editor' ),
			};
		},
		[]
	);

	return (
		<nav
			aria-label={ __( 'Document panels', 'create-not-learn-editor' ) }
			className="cnl-document-rail"
		>
			{ RAIL_ITEMS.map( ( item ) => {
				const isCurrent = isOpen && tab === item.tab;
				const description = getDescription( item.tab, typeName );

				return (
					<Tooltip.Root key={ item.tab }>
						<Tooltip.Trigger
							aria-description={ description }
							aria-label={ item.label }
							aria-pressed={ isCurrent }
							className={ `cnl-document-rail__item${
								isCurrent ? ' is-current' : ''
							}` }
							onClick={ () => toggleDocumentPanel( item.tab ) }
							// The button for the panel picked, open or not.
							ref={ item.tab === tab ? toggleRef : undefined }
							render={ <button type="button" /> }
						>
							<RailIcon icon={ item.icon ?? documentIcon } />
						</Tooltip.Trigger>
						<Tooltip.Popup
							className="cnl-document-rail__tooltip"
							positioner={ <Tooltip.Positioner side="right" /> }
						>
							<strong>{ item.label }</strong>
							<span>{ description }</span>
						</Tooltip.Popup>
					</Tooltip.Root>
				);
			} ) }
		</nav>
	);
}
