/**
 * The Pages screen's address, and moving a page to the Trash from it.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getErrorMessage } from '../../../records';
import { getPageTitle } from './data';
import {
	__,
	Button,
	coreDataStore,
	Modal,
	noticesStore,
	sprintf,
	useCallback,
	useDispatch,
	useRef,
	useState,
} from '../../../wordpress-packages';

export const LIST_PATH = '/types/page/list/all';

/**
 * Moving a page to the Trash, after asking. Its sub-pages move up a level
 * rather than vanishing with it.
 *
 * @param {Object}   args             Arguments.
 * @param {Object[]} args.pages       Every page.
 * @param {number}   args.previewedId The page in the preview.
 * @return {Object} `{ modal, requestDelete }`: the confirmation to render, and
 *                  a callback taking the page ID to delete and, optionally,
 *                  what to do once it is deleted.
 */
export function usePageTrash( { pages: effectivePages, previewedId } ) {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const { deleteEntityRecord, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const [ deleteId, setDeleteId ] = useState( null );
	const [ isDeleting, setIsDeleting ] = useState( false );
	const onDeleted = useRef();
	const requestDelete = useCallback( ( pageId, afterDelete ) => {
		onDeleted.current = afterDelete;
		setDeleteId( pageId );
	}, [] );

	const closeDeleteModal = () => {
		if ( ! isDeleting ) {
			setDeleteId( null );
		}
	};

	const deletePage = async () => {
		const page = effectivePages.find(
			( item ) => Number( item.id ) === deleteId
		);

		if ( ! page ) {
			setDeleteId( null );

			return;
		}

		const title = getPageTitle( page );
		const parent = Number( page.parent ) || 0;
		// Its children move up a level rather than vanishing with it.
		const children = effectivePages.filter(
			( item ) => ( Number( item.parent ) || 0 ) === deleteId
		);

		setIsDeleting( true );

		try {
			await Promise.all(
				children.map( ( child ) =>
					saveEntityRecord(
						'postType',
						'page',
						{ id: child.id, parent },
						{ throwOnError: true }
					)
				)
			);
			await deleteEntityRecord(
				'postType',
				'page',
				deleteId,
				{},
				{ throwOnError: true }
			);

			if ( previewedId === deleteId ) {
				navigate( {
					search: { ...searchParams, previewId: parent || undefined },
					to: LIST_PATH,
				} );
			}

			onDeleted.current?.( deleteId );
			createSuccessNotice(
				sprintf(
					/* translators: %s: page title. */
					__( '“%s” moved to Trash.' ),
					title
				),
				{ type: 'snackbar' }
			);
			setDeleteId( null );
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: 1: page title, 2: error message. */
					__( 'Unable to delete “%1$s” (%2$s).' ),
					title,
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsDeleting( false );
		}
	};

	return {
		modal: deleteId && (
			<Modal
				className="routes-navigation-edit__item-modal"
				onRequestClose={ closeDeleteModal }
				title={ __( 'Delete page' ) }
			>
				<p>
					{ sprintf(
						/* translators: %s: page title. */
						__(
							'Are you sure you want to delete “%s”? It will be moved to the Trash.'
						),
						getPageTitle(
							effectivePages.find(
								( item ) => Number( item.id ) === deleteId
							) || {}
						)
					) }
				</p>
				<div className="routes-navigation-edit__modal-actions">
					<Button
						disabled={ isDeleting }
						onClick={ closeDeleteModal }
						variant="tertiary"
					>
						{ __( 'Cancel' ) }
					</Button>
					<Button
						disabled={ isDeleting }
						isBusy={ isDeleting }
						isDestructive
						onClick={ deletePage }
						variant="primary"
					>
						{ __( 'Move to Trash' ) }
					</Button>
				</div>
			</Modal>
		),
		requestDelete,
	};
}
