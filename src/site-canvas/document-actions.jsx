/**
 * Saving and publishing the page or post open in the canvas, as core's post
 * editor header does: Save draft, which reads Saved once saved, and Publish,
 * which opens core's "Are you ready to publish?" panel, for a draft. A live
 * page or post has Save, which waits for a change.
 *
 * Save draft and the panel are core's own (`PostSavedState`,
 * `PostPublishPanel`). Publish and Save are drawn here, with core's labels and
 * actions, because core's button reads "Save" and opens its review of every
 * change whenever anything else is unsaved: in core, saving the post saves
 * the lot. Here everything else, the site's changes, waits for Publish site
 * in the top bar (`src/top-bar`), so the pre-publish panel has one line for
 * them instead, "Also publish N site changes", left unticked.
 */

/**
 * WordPress dependencies
 */
import {
	PostPublishPanel,
	PostSavedState,
	store as editorStore,
} from '@wordpress/editor';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { publishDraftMenus, useChanges } from '../top-bar/use-changes';
import {
	__,
	_n,
	Button,
	CheckboxControl,
	createContext,
	dispatch,
	sprintf,
	useContext,
	coreDataStore,
	useDispatch,
	useEffect,
	useRef,
	useRegistry,
	useSelect,
	useState,
} from '../wordpress-packages';

// Core's post editor turns the pre-publish checks on by default as it boots.
// The canvas's editor doesn't boot that way, so it is said here.
dispatch( preferencesStore ).setDefaults( 'core', {
	isPublishSidebarEnabled: true,
} );

const AlsoPublishContext = createContext( null );

/**
 * The page or post's publishing state, as core's publish button reads it.
 *
 * @param {Function} select Registry `select`.
 * @return {Object} The state.
 */
function getPublishState( select ) {
	const editor = select( editorStore );
	const status = editor.getEditedPostAttribute( 'status' );
	const hasStatusChanged = Boolean( editor.getPostEdits()?.status );

	return {
		hasPublishAction:
			!! editor.getCurrentPost()?._links?.[ 'wp:action-publish' ],
		hasStatusChanged,
		isBeingScheduled: editor.isEditedPostBeingScheduled(),
		isDirty: editor.isEditedPostDirty(),
		isPending: editor.isCurrentPostPending(),
		isPublished: editor.isCurrentPostPublished(),
		isPublishing: editor.isPublishingPost(),
		isSaveable: editor.isEditedPostSaveable(),
		isSaving: editor.isSavingPost() && ! editor.isAutosavingPost(),
		isScheduled: editor.isCurrentPostScheduled(),
		isLocked: editor.isPostSavingLocked(),
		isPanelEnabled: editor.isPublishSidebarEnabled(),
		status,
		visibility: editor.getEditedPostVisibility(),
	};
}

/**
 * Core's label for its publish button, less "Save" for when anything else
 * is unsaved. See `PostPublishButtonLabel`.
 *
 * @param {Object} state From `getPublishState`.
 * @return {string} The label.
 */
function getLabel( state ) {
	if ( state.isPublishing ) {
		return __( 'Publishing…' );
	}

	if ( ( state.isPublished || state.isBeingScheduled ) && state.isSaving ) {
		return __( 'Saving…' );
	}

	if ( ! state.hasPublishAction ) {
		return __( 'Submit for Review' );
	}

	if (
		state.isPublished ||
		( state.hasStatusChanged &&
			! [ 'future', 'publish' ].includes( state.status ) ) ||
		( ! state.hasStatusChanged && state.status === 'future' )
	) {
		return __( 'Save' );
	}

	return state.isBeingScheduled ? __( 'Schedule' ) : __( 'Publish' );
}

/**
 * The status publishing gives the post, as core's publish button works out.
 *
 * @param {Object} state From `getPublishState`.
 * @return {string} The status.
 */
function getPublishStatus( state ) {
	if ( state.hasStatusChanged ) {
		return state.status;
	}

	if ( ! state.hasPublishAction ) {
		return 'pending';
	}

	if ( state.visibility === 'private' ) {
		return 'private';
	}

	return state.isBeingScheduled ? 'future' : 'publish';
}

/**
 * Publish the draft menus the open page or post shows, a new menu put in
 * its content say, as it goes live. Core never shows a draft menu, and
 * Publish site only publishes the menus of what it publishes, so without
 * this the page would go live with an empty menu that nothing then
 * publishes. See `src/top-bar/README.md`.
 *
 * @param {Object} registry Data registry.
 * @return {Promise} Resolves once the menus are saved.
 */
function publishDocumentMenus( registry ) {
	const editor = registry.select( editorStore );
	const menus = publishDraftMenus( registry, [
		{
			kind: 'postType',
			name: editor.getCurrentPostType(),
			key: editor.getCurrentPostId(),
		},
	] );
	const { saveEditedEntityRecord } = registry.dispatch( coreDataStore );

	return Promise.all(
		menus.map( ( { kind, name, key } ) =>
			saveEditedEntityRecord( kind, name, key )
		)
	);
}

// Statuses that leave the page or post where visitors can't see it, so its
// draft menus stay drafts.
const HIDDEN_STATUSES = [ 'draft', 'pending', 'auto-draft' ];

/**
 * Publish, Schedule or Save: the primary button, in the toolbar and in the
 * pre-publish panel's header.
 *
 * @param {Object}  props
 * @param {boolean} props.canOpenPanel Whether it may open the pre-publish
 *                                     panel rather than publish at once.
 * @return {Element} The button.
 */
function PublishButton( { canOpenPanel = false } ) {
	const state = useSelect( getPublishState, [] );
	const { editPost, savePost, togglePublishSidebar } =
		useDispatch( editorStore );
	const registry = useRegistry();
	const isLive =
		state.isPublished || ( state.isScheduled && state.isBeingScheduled );
	// The post's status is final, as core's toggle reads it, so it saves.
	const isFinal =
		isLive ||
		( state.hasStatusChanged &&
			! [ 'future', 'publish' ].includes( state.status ) ) ||
		( state.isPending && ! state.hasPublishAction );
	const opensPanel = canOpenPanel && ! isFinal && state.isPanelEnabled;
	const isDisabled =
		state.isLocked ||
		state.isSaving ||
		! state.isSaveable ||
		( isLive && ! state.isDirty );

	const onClick = () => {
		if ( isDisabled ) {
			return;
		}

		if ( opensPanel ) {
			togglePublishSidebar();
			return;
		}

		const status = isLive ? state.status : getPublishStatus( state );

		if ( ! isLive ) {
			editPost( { status }, { undoIgnore: true } );
		}

		if ( ! HIDDEN_STATUSES.includes( status ) ) {
			publishDocumentMenus( registry );
		}

		savePost();
	};

	return (
		<Button
			accessibleWhenDisabled
			aria-disabled={ isDisabled }
			aria-expanded={ opensPanel ? false : undefined }
			className="cnl-document-actions__publish"
			isBusy={ state.isSaving && isLive }
			onClick={ onClick }
			variant="primary"
			__next40pxDefaultSize
		>
			{ getLabel( state ) }
		</Button>
	);
}

/**
 * The buttons, after Exit in the canvas toolbar. Gone while the pre-publish
 * panel is open, which has its own.
 *
 * @return {?Element} Save draft and Publish, or Save.
 */
export function DocumentActions() {
	const isPanelOpen = useSelect(
		( select ) => select( editorStore ).isPublishSidebarOpened(),
		[]
	);

	return (
		<div className="cnl-document-actions">
			<PostSavedState />
			{ ! isPanelOpen && <PublishButton canOpenPanel /> }
		</div>
	);
}

/**
 * The one line for the site's changes in the pre-publish panel.
 *
 * @return {?Element} The checkbox, while the site has changes waiting.
 */
function AlsoPublishSiteChanges() {
	const { count, isIncluded, setIsIncluded } =
		useContext( AlsoPublishContext );

	if ( ! count ) {
		return null;
	}

	return (
		<div className="cnl-also-publish-site">
			<CheckboxControl
				checked={ isIncluded }
				label={ sprintf(
					/* translators: %d: Number of site changes waiting to be published. */
					_n(
						'Also publish %d site change',
						'Also publish %d site changes',
						count
					),
					count
				) }
				onChange={ setIsIncluded }
			/>
		</div>
	);
}

/**
 * Core's pre- and post-publish panel, at the canvas's right while it is
 * open. Its header's Publish is this file's, laid over core's (see
 * `_style.scss`). Publishing with "Also publish" ticked publishes the site's
 * changes once the page or post is live.
 *
 * @return {?Element} The panel.
 */
export function DocumentPublishPanel() {
	const { isOpen, isPublished, isLive, isSaving, hasPublishAction } =
		useSelect( ( select ) => {
			const editor = select( editorStore );

			return {
				isOpen: editor.isPublishSidebarOpened(),
				isPublished: editor.isCurrentPostPublished(),
				// Published or scheduled: either way it no longer waits on
				// anyone, so the site's changes ticked to go with it go too.
				isLive:
					editor.isCurrentPostPublished() ||
					editor.isCurrentPostScheduled(),
				isSaving: editor.isSavingPost(),
				hasPublishAction:
					!! editor.getCurrentPost()?._links?.[ 'wp:action-publish' ],
			};
		}, [] );
	const { closePublishSidebar } = useDispatch( editorStore );
	const { siteChanges, publishSite } = useChanges();
	const [ isIncluded, setIsIncluded ] = useState( false );
	const wasLive = useRef( isLive );

	useEffect( () => {
		if ( isLive && ! wasLive.current && isIncluded ) {
			setIsIncluded( false );
			publishSite();
		}

		wasLive.current = isLive;
		// Only the page going live, or being scheduled, should publish.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isLive ] );

	// Closed with the panel, so it's never ticked without being seen.
	useEffect( () => {
		if ( ! isOpen ) {
			setIsIncluded( false );
		}
	}, [ isOpen ] );

	if ( ! isOpen ) {
		return null;
	}

	const isPrePublish = ! isPublished && ! isSaving;

	return (
		<AlsoPublishContext.Provider
			value={ {
				// Submitting for review publishes nothing, so there is
				// nothing for the site's changes to go with.
				count: hasPublishAction ? siteChanges.length : 0,
				isIncluded,
				setIsIncluded,
			} }
		>
			<div
				className={ `cnl-site-canvas__publish-panel${
					isPrePublish ? ' is-pre-publish' : ''
				}` }
			>
				<PostPublishPanel
					onClose={ closePublishSidebar }
					PrePublishExtension={ AlsoPublishSiteChanges }
				/>
				{ isPrePublish && (
					<div className="cnl-site-canvas__publish-panel-button">
						<PublishButton />
					</div>
				) }
			</div>
		</AlsoPublishContext.Provider>
	);
}
