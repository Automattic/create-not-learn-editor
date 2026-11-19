/**
 * WordPress dependencies
 */
import { useNavigate, useParams, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { withUiTheme } from '../../theme';
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	Breadcrumbs,
	Button,
	coreDataStore,
	DropdownMenu,
	InputControl,
	MenuGroup,
	MenuItem,
	Modal,
	moreVerticalIcon,
	noticesStore,
	pencilIcon,
	postCategoriesIcon,
	Page,
	Spinner,
	sprintf,
	trashIcon,
	useDispatch,
	useEffect,
	useRef,
	useSelect,
	useState,
	__,
} from '../../wordpress-packages';
import { getRenamedNotice, renameMenu } from '../navigation/menu-helpers';
import { DeleteNavigationMenuModal } from '../navigation/menu-row';
import { setSelfSaving } from '../../site-canvas/mode';
import { useMenuItemsEditor } from './menu-items-editor';
import NavigationEditCanvas from './navigation-edit-canvas';
import { ADD_MENU_ITEMS_SEARCH, NAVIGATION_POST_TYPE } from './shared';
import { useNavigationLocations } from './use-navigation-locations';

// Long enough that a run of edits saves once.
const SAVE_DELAY_MS = 600;

/**
 * Save a draft menu as it is changed. Core never shows a draft, nor picks
 * it for a Navigation block with no menu of its own, so nobody can see it
 * and its edits have nothing to wait for. A published menu may be shown
 * anywhere, in a header, a page or a widget, so every change to it waits
 * for Publish site. See `src/top-bar/README.md`.
 *
 * @param {number} navigationId The menu.
 * @return {boolean} Whether the menu is live, published.
 */
function useSaveWhileDraft( navigationId ) {
	const { hasEdits, status } = useSelect(
		( select ) => {
			const store = select( coreDataStore );

			return {
				// Leaving out a draft Publish site is publishing, marked to
				// publish with the site's changes, which saves it there.
				hasEdits:
					store.hasEditsForEntityRecord(
						'postType',
						NAVIGATION_POST_TYPE,
						navigationId
					) &&
					store.getEntityRecordEdits(
						'postType',
						NAVIGATION_POST_TYPE,
						navigationId
					)?.status === undefined,
				// As saved, not as edited.
				status: store.getEntityRecord(
					'postType',
					NAVIGATION_POST_TYPE,
					navigationId
				)?.status,
			};
		},
		[ navigationId ]
	);
	const { saveEditedEntityRecord } = useDispatch( coreDataStore );
	const isDraft = status === 'draft';
	const recordId = `postType|${ NAVIGATION_POST_TYPE }|${ navigationId }`;

	useEffect( () => {
		setSelfSaving( recordId, isDraft );
	}, [ recordId, isDraft ] );
	useEffect( () => () => setSelfSaving( recordId, false ), [ recordId ] );

	useEffect( () => {
		if ( ! isDraft || ! hasEdits ) {
			return undefined;
		}

		const timer = window.setTimeout(
			() =>
				saveEditedEntityRecord(
					'postType',
					NAVIGATION_POST_TYPE,
					navigationId
				),
			SAVE_DELAY_MS
		);

		return () => window.clearTimeout( timer );
	}, [ hasEdits, isDraft, navigationId, saveEditedEntityRecord ] );

	return status === 'publish';
}

function NavigationEditStage() {
	const navigate = useNavigate();
	const params = useParams( { strict: false } );
	const navigationId = Number( params.id );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ isRenaming, setIsRenaming ] = useState( false );
	const [ isDeleting, setIsDeleting ] = useState( false );
	const [ renameTitle, setRenameTitle ] = useState( '' );
	const { deleteEntityRecord, editEntityRecord, saveEntityRecord } =
		useDispatch( coreDataStore );
	const isLive = useSaveWhileDraft( navigationId );
	const { locations } = useNavigationLocations( navigationId );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const {
		canAddMenuItems,
		editor,
		isMenuReady,
		menuTitle,
		openAddMenuItems,
	} = useMenuItemsEditor( navigationId );
	const search = useSearch( { strict: false } );
	const hasOpenedAdd = useRef( false );

	// Sent here to add something, "Add menu items" opens once it can.
	useEffect( () => {
		if (
			! search[ ADD_MENU_ITEMS_SEARCH ] ||
			! canAddMenuItems ||
			hasOpenedAdd.current
		) {
			return;
		}

		hasOpenedAdd.current = true;
		openAddMenuItems();
		navigate( {
			replace: true,
			search: { ...search, [ ADD_MENU_ITEMS_SEARCH ]: undefined },
			to: `/navigation/edit/${ encodeURIComponent( navigationId ) }`,
		} );
	}, [ canAddMenuItems, navigate, navigationId, openAddMenuItems, search ] );

	const openRenameModal = () => {
		setRenameTitle( menuTitle );
		setIsRenaming( true );
	};

	const closeRenameModal = () => {
		if ( ! isSaving ) {
			setIsRenaming( false );
		}
	};

	const renameNavigationMenu = async () => {
		const trimmedTitle = renameTitle.trim();

		if ( ! trimmedTitle ) {
			return;
		}

		setIsSaving( true );

		try {
			await renameMenu( {
				editEntityRecord,
				id: navigationId,
				isLive,
				saveEntityRecord,
				title: trimmedTitle,
			} );
			invalidateNavigationMenus();
			setIsRenaming( false );
			createSuccessNotice(
				getRenamedNotice( { status: isLive ? 'publish' : 'draft' } ),
				{ type: 'snackbar' }
			);
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to rename navigation menu (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSaving( false );
		}
	};

	const closeDeleteModal = () => {
		if ( ! isSaving ) {
			setIsDeleting( false );
		}
	};

	const deleteNavigationMenu = async () => {
		setIsSaving( true );

		try {
			await deleteEntityRecord(
				'postType',
				NAVIGATION_POST_TYPE,
				navigationId,
				{ force: true },
				{ throwOnError: true }
			);
			invalidateNavigationMenus();
			createSuccessNotice( __( 'Navigation menu deleted.' ), {
				type: 'snackbar',
			} );
			navigate( { to: '/navigation' } );
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to delete navigation menu (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSaving( false );
		}
	};

	const menuOptions = isMenuReady && (
		<DropdownMenu
			icon={ moreVerticalIcon }
			label={ __( 'Navigation menu options' ) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ { variant: 'tertiary' } }
		>
			{ ( { onClose } ) => (
				<div>
					<MenuGroup>
						<MenuItem
							disabled={ ! canAddMenuItems }
							icon={ postCategoriesIcon }
							onClick={ () => {
								openAddMenuItems();
								onClose();
							} }
						>
							{ __( 'Add menu items' ) }
						</MenuItem>
						<MenuItem
							icon={ pencilIcon }
							onClick={ () => {
								openRenameModal();
								onClose();
							} }
						>
							{ __( 'Rename' ) }
						</MenuItem>
						<MenuItem
							onClick={ () =>
								navigate( {
									to: `/types/${ NAVIGATION_POST_TYPE }/edit/${ navigationId }`,
								} )
							}
						>
							{ __( 'Open block editor' ) }
						</MenuItem>
					</MenuGroup>
					<MenuGroup>
						<MenuItem
							icon={ trashIcon }
							isDestructive
							onClick={ () => {
								setIsDeleting( true );
								onClose();
							} }
						>
							{ __( 'Delete' ) }
						</MenuItem>
					</MenuGroup>
				</div>
			) }
		</DropdownMenu>
	);

	return (
		<Page
			actions={ menuOptions }
			ariaLabel={ menuTitle }
			// A menu sits under the Menus screen, wherever it was opened
			// from. Back retraces the way it was reached.
			breadcrumbs={
				<Breadcrumbs
					items={ [
						{ label: __( 'Menus' ), to: '/navigation' },
						{ label: menuTitle },
					] }
				/>
			}
			className="cnl-editor-stage routes-navigation-edit"
			hasPadding={ false }
			headingLevel={ 2 }
			subTitle={ __( 'Manage this navigation menu.' ) }
		>
			{ ! isMenuReady && (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ isMenuReady && (
				<div className="routes-navigation-edit__content">
					{ editor }
					{ isRenaming && (
						<Modal
							className="routes-navigation-edit__item-modal"
							onRequestClose={ closeRenameModal }
							title={ __( 'Rename navigation menu' ) }
						>
							<InputControl
								disabled={ isSaving }
								label={ __( 'Name' ) }
								onValueChange={ setRenameTitle }
								value={ renameTitle }
							/>
							<div className="routes-navigation-edit__modal-actions">
								<Button
									disabled={ isSaving }
									onClick={ closeRenameModal }
									variant="tertiary"
								>
									{ __( 'Cancel' ) }
								</Button>
								<Button
									disabled={
										isSaving || ! renameTitle.trim()
									}
									isBusy={ isSaving }
									onClick={ renameNavigationMenu }
									variant="primary"
								>
									{ __( 'Rename' ) }
								</Button>
							</div>
						</Modal>
					) }
					{ isDeleting && (
						<DeleteNavigationMenuModal
							isSaving={ isSaving }
							isLive={ isLive }
							locations={ locations }
							menuTitle={ menuTitle }
							onClose={ closeDeleteModal }
							onDelete={ deleteNavigationMenu }
						/>
					) }
				</div>
			) }
		</Page>
	);
}

export const stage = withUiTheme( NavigationEditStage );
export const canvas = withCanvasRecovery( withUiTheme( NavigationEditCanvas ) );
