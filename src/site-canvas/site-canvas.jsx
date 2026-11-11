/**
 * A site canvas: a toolbar, and the editor with the preview laid over it.
 *
 * Both surfaces stay mounted. Moving to or from Browse fades the preview in or
 * out, so neither reloads, and the preview keeps its page, scroll position
 * and history while the editor is on show. Edit and Compose share one layer
 * over the editor, Compose zooming the editor out under it.
 */

/**
 * WordPress dependencies
 */
import { Editor as LazyEditor } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { GlobalScope } from '../global-scope';
import { unlock } from '../lock-unlock';
import { getErrorMessage } from '../records';
import {
	__,
	blockEditorStore,
	Fragment,
	Notice,
	Spinner,
	useEffect,
	useRef,
	useSelect,
} from '../wordpress-packages';
import { BrowseHints } from './browse-hints';
import { useComposeZoom } from './compose/use-compose-zoom';
import { EDITOR_DEVICES } from './constants';
import { useEditSectionControls } from './edit-section-controls';
import {
	MODE_BROWSE,
	MODE_COMPOSE,
	MODE_EDIT,
	setCanvasEditRoute,
} from './mode';
import { expandCanvas, useCanvasExpansion } from './expansion';
import { SectionModesLayer } from './section-modes/section-modes-layer';
import {
	BrowseToggle,
	closeDocumentOverview,
	DocumentOverviewToggle,
	EditHistory,
	ExpandButton,
	PreviewHistory,
	ViewMenu,
	ZoomOutToggle,
} from './toolbar';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';
import { useOwnEditorSettings } from './use-own-editor-settings';
import { useSectionLock } from './use-section-lock';
import { isContainerBlock, isWritingType } from './writing-mode';
import { useZoomGestures, ZoomControls } from './zoom-controls';

/**
 * @param {Object}  props
 * @param {Object}  props.canvas         Result of `useSiteCanvas`.
 * @param {string}  props.className      Extra class for the canvas.
 * @param {Element} props.document       What is on show, for the toolbar.
 * @param {Element} props.editorChildren Shown over the editor while it is
 *                                       on show.
 * @param {Object}  props.editorRef      Ref to the editor's container, if
 *                                       the caller needs one.
 * @param {?Object} props.editorSettings Core editor settings for what is
 *                                       edited, handed back when the canvas
 *                                       goes. See `use-own-editor-settings`.
 *                                       Keep the reference stable.
 * @param {Element} props.emptyPreview   Shown when there is nothing to
 *                                       preview.
 * @param {?string} props.focusId        The one section, header or footer a
 *                                       canvas about it works on, in the
 *                                       editor's client IDs. Edit's section
 *                                       layer offers nothing else on the
 *                                       page. See `SectionModesLayer`.
 * @param {boolean} props.canCompose     Whether Compose is offered. A canvas
 *                                       about one part of the site, not a
 *                                       page's sections, does without.
 * @param {boolean} props.hasSections    Whether what is edited is built from
 *                                       sections. Without, like a product
 *                                       in its locked layout, Edit has no
 *                                       section layer and clicks reach the
 *                                       blocks, and there is no Compose.
 * @return {Element} The canvas.
 */
export function SiteCanvas( {
	canCompose: canComposeSections = true,
	canvas,
	className = '',
	document,
	editorChildren,
	editorRef: givenEditorRef,
	editorSettings = null,
	emptyPreview = null,
	focusId = null,
	hasSections = true,
} ) {
	const canCompose = canComposeSections && hasSections;
	const ownEditorRef = useRef();
	const bodyRef = useRef();
	const editorRef = givenEditorRef || ownEditorRef;
	const { device, editorDevice, editorEntity, frame, mode } = canvas;
	const isPreviewing = canvas.isPreviewing;
	const isEditing = mode === MODE_EDIT;
	const isExpanded = useCanvasExpansion();
	const editRouteKey = JSON.stringify( canvas.editRoute ?? null );

	// The top bar's Options menu opens this in the full-screen editor.
	useEffect( () => {
		setCanvasEditRoute( JSON.parse( editRouteKey ) );

		return () => setCanvasEditRoute( null );
	}, [ editRouteKey ] );
	// Document Overview is for working with the whole editor, so it is only
	// offered while the canvas fills it, and its list closes as it goes back.
	useEffect( () => {
		if ( ! isExpanded ) {
			closeDocumentOverview();
		}
	}, [ isExpanded ] );
	// A layout, like an archive's, changes every page made with it, so Edit
	// is in the purple of what every page shares. See `src/global-scope`.
	const EditScope =
		canvas.canvasEntity?.postType === 'wp_template'
			? GlobalScope
			: Fragment;
	// Writing, like a post, has no sections to work on in Edit. See
	// `writing-mode.js`.
	const isWriting = isWritingType( editorEntity?.postType );
	// Writing is only zoomed out to arrange its containers, if it has any.
	const hasContainers = useSelect(
		( select ) => {
			if ( ! isWriting ) {
				return false;
			}

			const store = unlock( select( blockEditorStore ) );

			return store
				.getBlockOrder( store.getSectionRootClientId() || '' )
				.some( ( clientId ) =>
					isContainerBlock( store.getBlockName( clientId ) )
				);
		},
		[ isWriting ]
	);
	const canArrange = canCompose && ( ! isWriting || hasContainers );
	const isComposing = canArrange && canvas.isComposing;

	// A canvas without Compose, reached while composing, edits instead, as
	// does writing once it has nothing left to arrange.
	useEffect( () => {
		if ( ! canArrange && canvas.isComposing ) {
			canvas.requestMode( MODE_EDIT );
		}
		// Only arriving here composing should switch.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ canArrange, canvas.isComposing ] );

	useComposeZoom( isComposing && Boolean( editorEntity ), editorRef );

	// Zooming out is Compose, offered by the toolbar's Zoom out, the canvas's
	// corner and by pinching.
	const canZoom = ! isPreviewing && canArrange && Boolean( editorEntity );
	const zoomIn = () => isComposing && canvas.requestMode( MODE_EDIT );
	const zoomOut = () => ! isComposing && canvas.requestMode( MODE_COMPOSE );

	useZoomGestures( {
		areaRef: bodyRef,
		editorRef,
		enabled: canZoom,
		onZoomIn: zoomIn,
		onZoomOut: zoomOut,
	} );
	/*
	 * A layout's sections are mostly the post's title, image and content,
	 * filled in from each post. Locked to their content, they would leave
	 * nothing to change. Writing has no sections to lock.
	 */
	useSectionLock(
		isEditing &&
			Boolean( editorEntity ) &&
			editorEntity.postType !== 'wp_template' &&
			! isWriting
	);
	useEditSectionControls( isEditing && Boolean( editorEntity ) );
	useOwnEditorSettings( editorSettings );

	// Published for the stylesheet, which hides core chrome by block.
	const selectedBlockName = useSelect(
		( select ) => {
			const { getBlockName, getSelectedBlockClientId } =
				select( blockEditorStore );

			return isPreviewing
				? null
				: getBlockName( getSelectedBlockClientId() );
		},
		[ isPreviewing ]
	);

	return (
		<section
			className={ `cnl-site-canvas cnl-editor-canvas cnl-editor-preview-canvas is-${ mode } ${
				isPreviewing ? 'is-previewing ' : ''
			}${ className }` }
		>
			<header className="cnl-editor-canvas__toolbar cnl-editor-homepage-toolbar">
				<div className="cnl-editor-homepage-toolbar__left">
					<EditScope>
						<ExpandButton
							isBrowsing={ isPreviewing }
							isExpanded={ isExpanded }
							onToggle={ () => {
								if ( ! isExpanded && isPreviewing ) {
									canvas.requestMode( MODE_EDIT );
								}

								expandCanvas( ! isExpanded );
							} }
						/>
					</EditScope>
					{ ! isPreviewing && <EditHistory /> }
					{ isExpanded && ! isPreviewing && editorEntity && (
						<DocumentOverviewToggle />
					) }
					{ isPreviewing && (
						<PreviewHistory
							history={ frame.history }
							onMove={ frame.move }
						/>
					) }
					{ canvas.isAwaitingPreview && (
						<span
							className="cnl-site-canvas__awaiting"
							role="status"
						>
							<Spinner />
							<span className="screen-reader-text">
								{ __( 'Loading the preview' ) }
							</span>
						</span>
					) }
				</div>
				<div className="cnl-editor-homepage-toolbar__center">
					{ document }
				</div>
				<div className="cnl-editor-homepage-toolbar__right">
					<BrowseToggle
						canEdit={ canvas.canEdit }
						isBrowsing={ isPreviewing }
						onChange={ ( browse ) =>
							canvas.requestMode(
								browse ? MODE_BROWSE : MODE_EDIT
							)
						}
					/>
					<ViewMenu
						device={ device }
						isComposing={ isComposing }
						onChange={ canvas.setDevice }
						onZoomIn={ zoomIn }
						liveUrl={ canvas.liveUrl }
					/>
					{ canZoom && (
						<ZoomOutToggle
							isComposing={ isComposing }
							onToggle={ () =>
								( isComposing ? zoomIn : zoomOut )()
							}
						/>
					) }
				</div>
			</header>
			<div className="cnl-site-canvas__body" ref={ bodyRef }>
				<div
					className="cnl-site-canvas__editor cnl-inline-editor"
					data-selected-block={ selectedBlockName || undefined }
					ref={ editorRef }
				>
					{ editorEntity && (
						<LazyEditor
							initialViewport={ EDITOR_DEVICES[ editorDevice ] }
							key={ `${ editorEntity.postType }:${ editorEntity.postId }` }
							postId={ editorEntity.postId }
							postType={ editorEntity.postType }
							settings={ editorSettings || undefined }
						/>
					) }
					{ isEditing && editorChildren }
				</div>
				{ /* One layer for Edit and Compose, kept as the canvas moves
				between them, so what is picked carries over. Writing is
				edited without it, and only arranged with it. */ }
				{ ( ( isEditing && ! isWriting ) || isComposing ) &&
					editorEntity &&
					hasSections && (
						<SectionModesLayer
							editorRef={ editorRef }
							entity={ editorEntity }
							focusId={ focusId }
							isComposing={ isComposing }
							isWriting={ isWriting }
							onExitCompose={ () =>
								canvas.requestMode( MODE_EDIT )
							}
						/>
					) }
				{ canZoom && (
					<ZoomControls
						isComposing={ isComposing }
						onZoomIn={ zoomIn }
						onZoomOut={ zoomOut }
					/>
				) }
				{ /*
				 * `aria-hidden` rather than `hidden`: `hidden` is `display: none`,
				 * which would cut the fade short.
				 */ }
				<div
					aria-hidden={ ! isPreviewing }
					className={ `cnl-site-canvas__preview is-${ device }` }
				>
					{ canvas.previewContextError && (
						<Notice
							className="cnl-editor-preview-canvas__notice"
							isDismissible={ false }
							status="error"
						>
							{ getErrorMessage( canvas.previewContextError ) }
						</Notice>
					) }
					{ frame.isLoading && (
						<div className="cnl-editor-preview-canvas__spinner">
							<Spinner />
						</div>
					) }
					{ frame.frameProps.src ? (
						<iframe
							{ ...frame.frameProps }
							className="cnl-site-canvas__frame"
							title={ __( 'Site preview' ) }
						/>
					) : (
						emptyPreview
					) }
					{ /* Only in Browse: out of it the hints draw nothing, and
					mounted they would follow every edit. */ }
					{ isPreviewing && frame.frameProps.src && editorEntity && (
						<BrowseHints canvas={ canvas } />
					) }
				</div>
			</div>
			{ canvas.dialog.isOpen && (
				<UnsavedChangesDialog { ...canvas.dialog } />
			) }
		</section>
	);
}
