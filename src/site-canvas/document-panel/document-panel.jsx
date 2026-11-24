/**
 * Document Overview as Details and Layers: what this page is, and what is on
 * it. It takes over core's Document Overview sidebar, whose List View becomes
 * Layers, and whose Outline goes. See "Document Overview" in
 * `../README.md`.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { TimeToRead, WordCount } from '@wordpress/editor';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { observeHost } from '../../editor-layer/portal-host';
import { usePageSections } from '../../routes/content/pages/data';
import { PageDetails } from '../../routes/content/pages/page-details';
import {
	MemoizedPageLayouts,
	usePageLayoutName,
} from '../../routes/content/pages/page-layout-picker';
import { groupSections } from '../../routes/content/pages/page-sections';
import { useHomepageState } from '../../routes/content/pages/homepage';
import { closeDocumentOverview } from '../toolbar';
import { documentInfoIcon, layersIcon } from '../icons';
import {
	__,
	Button,
	chevronLeftIcon,
	chevronRightIcon,
	closeSmallIcon,
	createPortal,
	isRTL,
	Tabs,
	Text,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '../../wordpress-packages';

const EDITOR_STORE = 'core/editor';
const SIDEBAR = '.editor-list-view-sidebar';
const HOST_CLASS = 'cnl-document-panel-host';
export const DETAILS_TAB = 'details';
export const LAYERS_TAB = 'layers';

/**
 * The layouts a page can use, in place of its details, with a way back.
 *
 * @param {Object}   props
 * @param {Object}   props.page        The page's edited record.
 * @param {boolean}  props.isFrontPage Whether the page is the homepage.
 * @param {Function} props.onBack      Goes back to the details.
 * @return {Element} The layouts.
 */
function ChangeLayout( { page, isFrontPage, onBack } ) {
	const { blocks } = usePageSections( page.id );
	// Each run of text is one section, as on the canvas.
	const sectionCount = useMemo(
		() => groupSections( blocks ).length,
		[ blocks ]
	);
	const backRef = useRef();

	useEffect( () => backRef.current?.focus(), [] );

	return (
		<div className="cnl-document-panel__drilldown">
			<div className="cnl-document-panel__drilldown-header">
				<Button
					icon={ isRTL() ? chevronRightIcon : chevronLeftIcon }
					label={ __( 'Back to details' ) }
					onClick={ onBack }
					ref={ backRef }
					size="compact"
				/>
				<Text render={ <h3 /> } variant="heading-md">
					{ __( 'Change layout' ) }
				</Text>
			</div>
			<MemoizedPageLayouts
				isFrontPage={ isFrontPage }
				pageId={ page.id }
				sectionCount={ sectionCount }
				slug={ page.slug }
				template={ page.template }
			/>
		</div>
	);
}

/**
 * How long the document is, as core's Outline tab said it, which Layers
 * replaces.
 *
 * @return {Element} The counts.
 */
function DocumentLength() {
	return (
		<Text className="cnl-document-panel__length" variant="body-sm">
			<WordCount /> { __( 'words' ) } · <TimeToRead />
		</Text>
	);
}

/**
 * What this document is: for a page, every detail the Pages screen has, its
 * layout leading on to the layouts in place. Anything else, which has no
 * details here yet, gets its name and length.
 *
 * @return {Element} The details.
 */
function DocumentDetails() {
	const homepage = useHomepageState();
	const [ isChangingLayout, setIsChangingLayout ] = useState( false );
	const { page, postType, title, typeName } = useSelect( ( select ) => {
		const editor = select( EDITOR_STORE );
		const type = editor.getCurrentPostType();
		const id = editor.getCurrentPostId();
		const store = select( coreDataStore );

		return {
			page:
				type === 'page'
					? store.getEditedEntityRecord( 'postType', 'page', id )
					: null,
			postType: type,
			title: editor.getEditedPostAttribute( 'title' ),
			typeName: store.getPostType( type )?.labels?.singular_name,
		};
	}, [] );
	const isFrontPage = Boolean( page ) && page.id === homepage.pageId;
	const layoutName = usePageLayoutName( {
		isFrontPage,
		slug: page?.slug,
		template: page?.template,
	} );

	if ( page && isChangingLayout ) {
		return (
			<ChangeLayout
				isFrontPage={ isFrontPage }
				onBack={ () => setIsChangingLayout( false ) }
				page={ page }
			/>
		);
	}

	return (
		<div className="cnl-document-panel__details">
			<div className="cnl-document-panel__summary">
				<Text
					className="cnl-document-panel__type"
					render={ <p /> }
					variant="body-sm"
				>
					{ isFrontPage ? __( 'Homepage' ) : typeName || postType }
				</Text>
				<Text
					className="cnl-document-panel__title"
					render={ <h2 /> }
					variant="heading-xl"
				>
					{ title || __( '(no title)' ) }
				</Text>
				<DocumentLength />
			</div>
			{ page && (
				<PageDetails
					layoutName={ layoutName }
					onOpenLayouts={ () => setIsChangingLayout( true ) }
					pageId={ page.id }
				/>
			) }
		</div>
	);
}

/**
 * The tabs, with core's close button beside them, and Details' panel. Layers'
 * panel is core's List View, just below, shown while Layers is picked.
 *
 * @param {Object}   props
 * @param {string}   props.tab         The tab picked.
 * @param {Function} props.onChangeTab Picks a tab.
 * @return {Element} The panel.
 */
function DocumentPanelContent( { tab, onChangeTab } ) {
	return (
		<Tabs.Root
			className={ `cnl-document-panel is-${ tab }` }
			// Core closes its sidebar on Escape, but this is outside it in
			// React's tree, so the key doesn't reach it.
			onKeyDown={ ( event ) => {
				if ( event.key === 'Escape' && ! event.defaultPrevented ) {
					event.preventDefault();
					closeDocumentOverview();
				}
			} }
			onValueChange={ onChangeTab }
			value={ tab }
		>
			<div className="cnl-document-panel__header">
				<Tabs.List className="cnl-document-panel__tablist">
					<Tabs.Tab
						className="cnl-document-panel__tab"
						value={ DETAILS_TAB }
					>
						<Icon icon={ documentInfoIcon } size={ 20 } />
						{ __( 'Details' ) }
					</Tabs.Tab>
					<Tabs.Tab
						className="cnl-document-panel__tab"
						value={ LAYERS_TAB }
					>
						<Icon icon={ layersIcon } size={ 20 } />
						{ __( 'Layers' ) }
					</Tabs.Tab>
				</Tabs.List>
				<Button
					icon={ closeSmallIcon }
					label={ __( 'Close' ) }
					onClick={ closeDocumentOverview }
					size="compact"
				/>
			</div>
			<Tabs.Panel
				className="cnl-document-panel__panel"
				value={ DETAILS_TAB }
			>
				<DocumentDetails />
			</Tabs.Panel>
		</Tabs.Root>
	);
}

/**
 * Details and Layers, while Document Overview is open. The tab picked is kept
 * while it is closed, so it opens again where it was left.
 *
 * @param {Object} props
 * @param {Object} props.editorRef Ref to the editor's container.
 * @return {?Element} The panel.
 */
export function DocumentPanel( { editorRef } ) {
	const isOpen = useSelect(
		( select ) => Boolean( select( EDITOR_STORE )?.isListViewOpened?.() ),
		[]
	);
	const [ host, setHost ] = useState( null );
	const [ tab, setTab ] = useState( DETAILS_TAB );

	useEffect( () => {
		if ( ! isOpen || ! editorRef.current ) {
			setHost( null );
			return undefined;
		}

		return observeHost( SIDEBAR, HOST_CLASS, setHost, editorRef.current );
	}, [ editorRef, isOpen ] );

	// Core's sidebar shows its List View only while Layers is picked.
	useEffect( () => {
		host?.parentElement?.setAttribute( 'data-cnl-tab', tab );
	}, [ host, tab ] );

	return host
		? createPortal(
				<DocumentPanelContent onChangeTab={ setTab } tab={ tab } />,
				host
			)
		: null;
}
