/**
 * The panel the document rail opens: Details, what this document is, Layers,
 * what is on it, and Outline, its headings. It takes over core's Document
 * Overview sidebar, whose List View becomes Layers. See "Document Overview"
 * in `../README.md`.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { DocumentOutline, TimeToRead, WordCount } from '@wordpress/editor';

/**
 * Internal dependencies
 */
import { observeHost } from '../../editor-layer/portal-host';
import { hasSections } from '../../sections';
import { usePageSections } from '../../routes/content/pages/data';
import { PageDetails } from '../../routes/content/pages/page-details';
import {
	MemoizedPageLayouts,
	usePageLayoutName,
} from '../../routes/content/pages/page-layout-picker';
import { groupSections } from '../../routes/content/pages/page-sections';
import { useHomepageState } from '../../routes/content/pages/homepage';
import { RAIL_ITEMS } from './rail';
import {
	closeDocumentPanel,
	DETAILS_TAB,
	OUTLINE_TAB,
	useDocumentTab,
} from './state';
import {
	__,
	Button,
	chevronLeftIcon,
	chevronRightIcon,
	closeSmallIcon,
	createPortal,
	isRTL,
	Text,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '../../wordpress-packages';

const EDITOR_STORE = 'core/editor';
const SIDEBAR = '.editor-list-view-sidebar';
const HOST_CLASS = 'cnl-document-panel-host';

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
					label={ __( 'Back to details', 'create-not-learn-editor' ) }
					onClick={ onBack }
					ref={ backRef }
					size="compact"
				/>
				<Text render={ <h3 /> } variant="heading-md">
					{ __( 'Change layout', 'create-not-learn-editor' ) }
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
 * replaces. Only for writing: a page built from sections isn't read by its
 * length.
 *
 * @return {Element} The counts.
 */
function DocumentLength() {
	return (
		<Text className="cnl-document-panel__length" variant="body-sm">
			<WordCount /> { __( 'words', 'create-not-learn-editor' ) } ·{ ' ' }
			<TimeToRead />
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
	const { hasLength, page, postType, title, typeName } = useSelect(
		( select ) => {
			const editor = select( EDITOR_STORE );
			const type = editor.getCurrentPostType();
			const id = editor.getCurrentPostId();
			const store = select( coreDataStore );

			return {
				hasLength: ! hasSections( select, type, id ),
				page:
					type === 'page'
						? store.getEditedEntityRecord( 'postType', 'page', id )
						: null,
				postType: type,
				title: editor.getEditedPostAttribute( 'title' ),
				typeName: store.getPostType( type )?.labels?.singular_name,
			};
		},
		[]
	);
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
			{ /* A page's title is the form's first field, to change in place. */ }
			{ page ? (
				hasLength && <DocumentLength />
			) : (
				<div className="cnl-document-panel__summary">
					<Text
						className="cnl-document-panel__type"
						render={ <p /> }
						variant="body-sm"
					>
						{ isFrontPage
							? __( 'Homepage', 'create-not-learn-editor' )
							: typeName || postType }
					</Text>
					<Text
						className="cnl-document-panel__title"
						render={ <h2 /> }
						variant="heading-xl"
					>
						{ title ||
							__( '(no title)', 'create-not-learn-editor' ) }
					</Text>
					{ hasLength && <DocumentLength /> }
				</div>
			) }
			{ page && (
				<PageDetails
					layoutName={ layoutName }
					onOpenLayouts={ () => setIsChangingLayout( true ) }
					pageId={ page.id }
					withTitle
				/>
			) }
		</div>
	);
}

/**
 * Escape closes the panel. Core closes its sidebar on Escape, but the panel
 * is outside it in React's tree, so the key doesn't reach it.
 *
 * @param {KeyboardEvent} event The key press.
 */
function closeOnEscape( event ) {
	if ( event.key === 'Escape' && ! event.defaultPrevented ) {
		event.preventDefault();
		closeDocumentPanel();
	}
}

/**
 * The panel the rail opened, named, with a close button. The rail switches
 * between panels, so there are no tabs. Layers' panel is core's List View,
 * just below, shown while Layers is picked.
 *
 * @param {Object} props
 * @param {string} props.tab The panel picked.
 * @return {Element} The panel.
 */
function DocumentPanelContent( { tab } ) {
	const item = RAIL_ITEMS.find( ( { tab: name } ) => name === tab );

	return (
		// Escape is handled for the keys pressed inside the panel.
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div
			className={ `cnl-document-panel is-${ tab }` }
			onKeyDown={ closeOnEscape }
		>
			<div className="cnl-document-panel__header">
				<Text render={ <h2 /> } variant="heading-md">
					{ item?.label }
				</Text>
				<Button
					icon={ closeSmallIcon }
					label={ __( 'Close', 'create-not-learn-editor' ) }
					onClick={ closeDocumentPanel }
					size="compact"
				/>
			</div>
			{ tab === DETAILS_TAB && (
				<div className="cnl-document-panel__panel">
					<DocumentDetails />
				</div>
			) }
			{ tab === OUTLINE_TAB && (
				<div className="cnl-document-panel__panel cnl-document-panel__outline">
					<DocumentOutline />
				</div>
			) }
		</div>
	);
}

/**
 * The panel the rail picked, while Document Overview is open. The panel
 * picked is kept while it is closed, so the next open finds it where it was.
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
	const tab = useDocumentTab();

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

	if ( ! host ) {
		return null;
	}

	return createPortal( <DocumentPanelContent tab={ tab } />, host );
}
