/**
 * Adding something that isn't a page to the main menu, from the Pages screen.
 *
 * Anything but a page is added on the Menus screen, to a menu set by hand. A
 * menu that updates by itself asks first, then becomes links to the pages it
 * shows now, which are kept, and the menu opens with "Add menu items" open.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getEditedEntityRecords } from '../../../edited-records';
import {
	MENU_PAGES_QUERY,
	showMenuSetByHandNotice,
} from '../../navigation-edit/list-view';
import {
	expandPageListBlocks,
	serializeNavigationBlocks,
} from '../../navigation-edit/navigation-blocks';
import { ADD_MENU_ITEMS_SEARCH } from '../../navigation-edit/shared';
import { getEditedMenuContent } from '../use-main-menu';
import { getMenuBlocks, hasPageList } from './menu-items';
import {
	__,
	Button,
	coreDataStore,
	MenuGroup,
	MenuItem,
	Modal,
	noticesStore,
	resolveSelect,
	select,
	useDispatch,
	useState,
} from '../../../wordpress-packages';

const EMPTY_ARRAY = [];

/**
 * What can be added from the Pages screen: a page, or anything else for the
 * menu. Shared by the screen's Add button and the + at the end of the list.
 *
 * @param {Object}   props               Component props.
 * @param {Function} props.onAddMenuItem Starts adding to the menu, if it can.
 * @param {Function} props.onAddPage     Starts a page, if one can be added.
 * @param {Function} props.onClose       Closes the dropdown.
 * @return {Element} The options.
 */
export function AddOptions( { onAddMenuItem, onAddPage, onClose } ) {
	return (
		<MenuGroup>
			{ onAddPage && (
				<MenuItem
					onClick={ () => {
						onClose();
						onAddPage();
					} }
				>
					{ __( 'Page' ) }
				</MenuItem>
			) }
			{ onAddMenuItem && (
				<MenuItem
					onClick={ () => {
						onClose();
						onAddMenuItem();
					} }
				>
					{ __( 'Link or something else' ) }
				</MenuItem>
			) }
		</MenuGroup>
	);
}

/**
 * A way to add something that isn't a page to the main menu.
 *
 * @param {number} menuId The main menu's ID.
 * @return {Object} `{ addMenuItem, modal }`: starts adding, and the dialog
 *                  that asks first, to render.
 */
export default function useAddMenuItem( menuId ) {
	const navigate = useNavigate();
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const [ isConfirming, setIsConfirming ] = useState( false );

	const openMenu = () =>
		navigate( {
			search: { [ ADD_MENU_ITEMS_SEARCH ]: 1 },
			to: `/navigation/edit/${ encodeURIComponent( menuId ) }`,
		} );

	const addMenuItem = async () => {
		const content = await getEditedMenuContent( menuId );

		if ( hasPageList( getMenuBlocks( content ) ) ) {
			setIsConfirming( true );
		} else {
			openMenu();
		}
	};

	const setByHandAndOpen = async () => {
		setIsConfirming( false );

		const previousContent = await getEditedMenuContent( menuId );
		const pageArgs = [ 'postType', 'page', MENU_PAGES_QUERY ];

		await resolveSelect( coreDataStore ).getEntityRecords( ...pageArgs );

		const pages =
			getEditedEntityRecords( select( coreDataStore ), ...pageArgs ) ||
			EMPTY_ARRAY;

		editEntityRecord( 'postType', 'wp_navigation', menuId, {
			blocks: undefined,
			content: serializeNavigationBlocks(
				expandPageListBlocks( getMenuBlocks( previousContent ), pages )
			),
			selection: undefined,
		} );
		showMenuSetByHandNotice( {
			createSuccessNotice,
			editEntityRecord,
			message: __(
				'Menu customized. New pages won’t be added to it for you.'
			),
			navigationId: menuId,
			previousContent,
		} );
		openMenu();
	};

	const modal = isConfirming && (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ () => setIsConfirming( false ) }
			size="medium"
			title={ __( 'Customize your menu?' ) }
		>
			<p>
				{ __(
					'Customizing lets you add other types of links (e.g. Posts or links to external websites), but your menu will stop adding new pages automatically.'
				) }
			</p>
			<div className="routes-navigation-edit__modal-actions">
				<Button
					onClick={ () => setIsConfirming( false ) }
					variant="tertiary"
				>
					{ __( 'Cancel' ) }
				</Button>
				<Button onClick={ setByHandAndOpen } variant="primary">
					{ __( 'Customize menu' ) }
				</Button>
			</div>
		</Modal>
	);

	return { addMenuItem, modal };
}
