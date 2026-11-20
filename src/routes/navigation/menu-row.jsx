/**
 * Internal dependencies
 */
import {
	Button,
	chevronRightIcon,
	DropdownMenu,
	Icon,
	InputControl,
	MenuItem,
	Modal,
	moreVerticalIcon,
	compassIcon,
	__,
	sprintf,
} from '../../wordpress-packages';
import { getMenuTitle } from './menu-helpers';

export function NavigationMenuRow( {
	description,
	isBusy,
	menu,
	onDelete,
	onDuplicate,
	onEdit,
	onRename,
} ) {
	const title = getMenuTitle( menu );

	return (
		<div className="routes-navigation-list__row">
			<Button
				className="routes-navigation-list__row-link cnl-screen-links__link"
				onClick={ () => onEdit( menu ) }
			>
				<Icon className="cnl-screen-links__icon" icon={ compassIcon } />
				<span className="cnl-screen-links__text">
					<span className="cnl-screen-links__title">{ title }</span>
					<span className="cnl-screen-links__description">
						{ description }
					</span>
				</span>
				<Icon
					className="cnl-screen-links__chevron"
					icon={ chevronRightIcon }
				/>
			</Button>
			<DropdownMenu
				className="routes-navigation-list__row-menu"
				disabled={ isBusy }
				icon={ moreVerticalIcon }
				label={ sprintf(
					/* translators: %s: navigation menu title. */
					__( '%s options' ),
					title
				) }
				popoverProps={ { placement: 'bottom-end' } }
				toggleProps={ {
					__next40pxDefaultSize: true,
					variant: 'tertiary',
				} }
			>
				{ ( { onClose } ) => (
					<>
						<MenuItem
							onClick={ () => {
								onRename( menu );
								onClose();
							} }
						>
							{ __( 'Rename' ) }
						</MenuItem>
						<MenuItem
							onClick={ () => {
								onDuplicate( menu );
								onClose();
							} }
						>
							{ __( 'Duplicate' ) }
						</MenuItem>
						<MenuItem
							isDestructive
							onClick={ () => {
								onDelete( menu );
								onClose();
							} }
						>
							{ __( 'Delete' ) }
						</MenuItem>
					</>
				) }
			</DropdownMenu>
		</div>
	);
}

/**
 * A place on the site that shows a menu, such as the header. Opens the menu
 * it shows.
 *
 * @param {Object}     props
 * @param {string}     props.description The menu's name.
 * @param {Object}     props.icon        The place's icon.
 * @param {string}     props.label       The place, e.g. "Header".
 * @param {() => void} props.onEdit      Opens the menu.
 */
export function MenuLocationRow( { description, icon, label, onEdit } ) {
	return (
		<div className="routes-navigation-list__row">
			<Button
				className="routes-navigation-list__row-link cnl-screen-links__link"
				onClick={ onEdit }
			>
				<Icon className="cnl-screen-links__icon" icon={ icon } />
				<span className="cnl-screen-links__text">
					<span className="cnl-screen-links__title">{ label }</span>
					<span className="cnl-screen-links__description">
						{ description }
					</span>
				</span>
				<Icon
					className="cnl-screen-links__chevron"
					icon={ chevronRightIcon }
				/>
			</Button>
		</div>
	);
}

export function RenameNavigationMenuModal( {
	isSaving,
	menuTitle,
	onChangeTitle,
	onClose,
	onSave,
	title,
} ) {
	return (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ onClose }
			title={ __( 'Rename navigation menu' ) }
		>
			<InputControl
				disabled={ isSaving }
				label={ __( 'Name' ) }
				onValueChange={ onChangeTitle }
				value={ title }
			/>
			<div className="routes-navigation-edit__modal-actions">
				<Button
					disabled={ isSaving }
					onClick={ onClose }
					variant="tertiary"
				>
					{ __( 'Cancel' ) }
				</Button>
				<Button
					disabled={
						isSaving || ! title.trim() || title.trim() === menuTitle
					}
					isBusy={ isSaving }
					onClick={ onSave }
					variant="primary"
				>
					{ __( 'Save' ) }
				</Button>
			</div>
		</Modal>
	);
}

/**
 * Delete a menu, asked first. A menu shown somewhere can't be, until another
 * takes its place, so visitors never see an empty space where it was.
 *
 * A published menu may be shown somewhere the editor doesn't look, a page or
 * a widget say, so deleting one says so.
 *
 * @param {Object}   props
 * @param {boolean}  props.isLive    Whether it is published.
 * @param {boolean}  props.isSaving  Whether it is being deleted.
 * @param {Object[]} props.locations Where it is shown, with unsaved changes.
 * @param {string}   props.menuTitle Its name.
 * @param {Function} props.onClose   Close the dialog.
 * @param {Function} props.onDelete  Delete it.
 * @return {Element} The dialog.
 */
export function DeleteNavigationMenuModal( {
	isLive = true,
	isSaving,
	locations = [],
	menuTitle,
	onClose,
	onDelete,
} ) {
	if ( locations.length ) {
		const where = locations[ 0 ].label;

		return (
			<Modal
				className="routes-navigation-edit__item-modal"
				onRequestClose={ onClose }
				title={ sprintf(
					/* translators: 1: navigation menu title, 2: where it is shown, like "Header". */
					__( '%1$s is in your %2$s' ),
					menuTitle,
					where.toLowerCase()
				) }
			>
				<p>
					{ sprintf(
						/* translators: %s: where the menu is shown, like "Header". */
						__(
							'Choose another menu for your %s first, so visitors never see an empty space.'
						),
						where.toLowerCase()
					) }
				</p>
				<div className="routes-navigation-edit__modal-actions">
					<Button onClick={ onClose } variant="primary">
						{ __( 'OK' ) }
					</Button>
				</div>
			</Modal>
		);
	}

	return (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ onClose }
			title={ __( 'Delete navigation menu' ) }
		>
			<p>
				{ isLive
					? sprintf(
							/* translators: %s: navigation menu title. */
							__(
								'If your site shows “%s” anywhere, it goes from there straight away. This can’t be undone.'
							),
							menuTitle
						)
					: sprintf(
							/* translators: %s: navigation menu title. */
							__(
								'“%s” isn’t shown anywhere, so visitors won’t notice. It’s deleted straight away, and this can’t be undone.'
							),
							menuTitle
						) }
			</p>
			<div className="routes-navigation-edit__modal-actions">
				<Button
					disabled={ isSaving }
					onClick={ onClose }
					variant="tertiary"
				>
					{ __( 'Cancel' ) }
				</Button>
				<Button
					disabled={ isSaving }
					isBusy={ isSaving }
					isDestructive
					onClick={ onDelete }
					variant="primary"
				>
					{ __( 'Delete' ) }
				</Button>
			</div>
		</Modal>
	);
}
