/**
 * The controls Edit lays over a section: its name, the bar over it while it
 * is pointed at or picked, with Add, Edit design (or Edit content in
 * Compose, and Manage posts on a section listing posts) and its own moves,
 * or Edit header or Edit footer alone on a header or footer, and the small
 * bar on a section in Freeform. A layout item, like the page's title, is named
 * as part of its layout.
 */

/**
 * WordPress dependencies
 */
import { Tooltip } from '@wordpress/components';
import { forwardRef } from '@wordpress/element';
import {
	arrowDown as arrowDownIcon,
	arrowUp as arrowUpIcon,
	button as buttonIcon,
	copy as copyIcon,
	globe as globeIcon,
	heading as headingIcon,
	image as imageIcon,
	layout as layoutIcon,
	paragraph as paragraphIcon,
	pencil as pencilIcon,
	plus as plusIcon,
	styles as designIcon,
	trash as trashIcon,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	Dropdown,
	LegacyIcon,
	MenuGroup,
	MenuItem,
	sprintf,
} from '../../wordpress-packages';
import { getAddableTypes } from './items';
import PostsMenu from './posts-menu';

export const MODE_DESIGN = 'design';
export const MODE_CONTENT = 'content';
// Compose's way back into Edit, with the section picked.
export const MODE_ZOOM_IN = 'zoom-in';
// Part of Edit design, reached from its panel.
export const MODE_FREEFORM = 'free';

const ADD_ICONS = {
	button: buttonIcon,
	heading: headingIcon,
	image: imageIcon,
	paragraph: paragraphIcon,
};

/**
 * The ways to edit a section, on the bar over it. A section's words and
 * pictures are changed by clicking into it, so it has Edit design only. A
 * header or footer shows on every page, so it is opened on purpose, with
 * Edit header or Edit footer alone, which opens its words and pictures and
 * its design together. Zoomed out in Compose, a section's words and pictures are too small
 * to click into, so it has Edit content too, which zooms back into Edit
 * with the section picked. A run of text in writing, like a post, has no
 * design of its own, so it has Edit content only, and neither has what the
 * page's layout places, like its title, whose words are clicked into in
 * Edit.
 *
 * @param {boolean} isPart       Whether it is the header or footer.
 * @param {string}  title        Its name, like Header.
 * @param {boolean} isComposing  Whether the canvas is in Compose.
 * @param {boolean} isText       Whether it is a run of text in writing.
 * @param {boolean} isLayoutItem Whether it is placed by the page's layout,
 *                               like its title, which has no design here.
 * @return {Object[]} `{ mode, label, description, icon }` for each.
 */
export function getModes(
	isPart = false,
	title = '',
	isComposing = false,
	isText = false,
	isLayoutItem = false
) {
	if ( isPart ) {
		return [
			{
				description: getSitewideText( title ),
				icon: pencilIcon,
				label: getPartModeLabel( title ),
				mode: MODE_CONTENT,
			},
		];
	}

	const modes =
		isText || isLayoutItem
			? []
			: [
					{
						description: __(
							'Change the layout, colour and width'
						),
						icon: designIcon,
						label: __( 'Edit design' ),
						mode: MODE_DESIGN,
					},
				];

	if ( isComposing ) {
		modes.push( {
			description: __( 'Zoom in to change its words and pictures' ),
			icon: pencilIcon,
			label: __( 'Edit content' ),
			mode: MODE_ZOOM_IN,
		} );
	}

	return modes;
}

/**
 * A template part's name: Header or Footer for those areas, else its own,
 * like Sidebar.
 *
 * @param {Object} part `{ area, title }` from `useComposeStructure`.
 * @return {string} The name.
 */
export function getPartTitle( part ) {
	if ( part.area === 'header' ) {
		return __( 'Header' );
	}

	if ( part.area === 'footer' ) {
		return __( 'Footer' );
	}

	return part.title || __( 'Template part' );
}

/**
 * What opening a template part is called, like Edit header.
 *
 * @param {string} title The part's name, like Header.
 * @return {string} The words.
 */
export function getPartModeLabel( title ) {
	return sprintf(
		/* translators: %s: template part name, like header, lowercase. */
		__( 'Edit %s' ),
		title.toLowerCase()
	);
}

/**
 * The words for editing a header or footer, which every page shares.
 *
 * @param {string} title The part's name, like Header.
 * @return {string} The words.
 */
export function getSitewideText( title ) {
	return sprintf(
		/* translators: %s: template part name, like header, lowercase. */
		__( 'Changes to the %s show on every page of your site' ),
		title.toLowerCase()
	);
}

/**
 * Turns the outline and name grey and dashed for what it wraps: a layout
 * item, which the page's layout places, rather than the page.
 *
 * @param {Object}  props
 * @param {Element} props.children The outline and name.
 * @return {Element} The children, marked as the layout's.
 */
export function LayoutScope( { children } ) {
	return <div className="cnl-section-modes__layout-scope">{ children }</div>;
}

/**
 * The section's name, in a tab on its outline.
 *
 * @param {Object}  props
 * @param {string}  props.title    The name.
 * @param {boolean} props.isPart   Whether it is the header or footer.
 * @param {?string} props.layout   The name of the layout it is part of, for
 *                                 a layout item, like the page's title.
 * @param {boolean} props.isInside Whether the tab sits inside the top edge,
 *                                 when there is no room above it.
 * @param {boolean} props.isBelow  Whether the tab hangs under the bottom
 *                                 edge, for the section at the page's top.
 * @param {Object}  props.style    Where it sits.
 * @return {Element} The tab.
 */
export function SectionTab( {
	isBelow,
	isInside,
	isPart,
	layout = null,
	style,
	title,
} ) {
	return (
		<span
			aria-hidden
			title={ title }
			className={ `cnl-section-modes__tab${
				isInside ? ' is-inside' : ''
			}${ isBelow ? ' is-below' : '' }` }
			style={ style }
		>
			{ isPart && <LegacyIcon icon={ globeIcon } size={ 14 } /> }
			{ layout && <LegacyIcon icon={ layoutIcon } size={ 14 } /> }
			<span className="cnl-section-modes__tab-title">{ title }</span>
			{ isPart && (
				<span className="cnl-section-modes__tab-note">
					{ __( 'shown on every page' ) }
				</span>
			) }
			{ layout && (
				<span className="cnl-section-modes__tab-note">
					{ sprintf(
						/* translators: %s: layout name, like Standard. */
						__( 'part of the %s layout' ),
						layout
					) }
				</span>
			) }
		</span>
	);
}

/**
 * A button on the bar over a section: core's compact button, its name in a
 * tooltip when it is only an icon, or what it does when it has words. The
 * tooltip goes below, clear of "Add section" on the section's top edge.
 *
 * @param {Object}  props
 * @param {string}  props.label     Its name, or what it does, with words.
 * @param {?string} props.text      Its words, if it has any.
 * @param {string}  props.className Extra classes.
 * @param {Object}  props.icon      Its icon.
 * @return {Element} The button.
 */
function BarButton( { className = '', icon, label, text, ...props } ) {
	if ( ! text ) {
		return (
			<Button
				accessibleWhenDisabled
				className={ `cnl-section-modes__bar-button ${ className }` }
				icon={ icon }
				label={ label }
				showTooltip
				size="compact"
				tooltipPosition="bottom"
				{ ...props }
			/>
		);
	}

	return (
		<Tooltip placement="bottom" text={ label }>
			<Button
				className={ `cnl-section-modes__bar-button ${ className }` }
				description={ label }
				icon={ icon }
				size="compact"
				{ ...props }
			>
				{ text }
			</Button>
		</Tooltip>
	);
}

/**
 * The Add menu, of things that suit a section.
 *
 * @param {Object}   props
 * @param {string}   props.title    The section's name.
 * @param {Function} props.onAdd    Called with the type picked.
 * @param {Function} props.onToggle Called with whether the menu is open.
 * @return {Element} The menu.
 */
function AddMenu( { onAdd, onToggle, title } ) {
	return (
		<Dropdown
			className="cnl-section-modes__add"
			contentClassName="cnl-section-modes__add-menu"
			onToggle={ onToggle }
			popoverProps={ { placement: 'bottom-start' } }
			renderContent={ ( { onClose } ) => (
				<MenuGroup
					label={ sprintf(
						/* translators: %s: section name. */
						__( 'Add to %s' ),
						title
					) }
				>
					{ getAddableTypes().map( ( { label, type } ) => (
						<MenuItem
							icon={ ADD_ICONS[ type ] }
							iconPosition="left"
							key={ type }
							onClick={ () => {
								onClose();
								onAdd( type );
							} }
						>
							{ label }
						</MenuItem>
					) ) }
				</MenuGroup>
			) }
			renderToggle={ ( { isOpen, onToggle: toggle } ) => (
				<div className="cnl-section-modes__group">
					<Button
						aria-expanded={ isOpen }
						aria-haspopup="menu"
						className="cnl-section-modes__bar-button"
						icon={ plusIcon }
						isPressed={ isOpen }
						onClick={ toggle }
						size="compact"
					>
						{ __( 'Add' ) }
					</Button>
				</div>
			) }
		/>
	);
}

/**
 * The bar over a section while it is pointed at.
 *
 * @param {Object}   props
 * @param {string}   props.title         The section's name.
 * @param {boolean}  props.isPart        Whether it is the header or footer,
 *                                       which stay where they are.
 * @param {boolean}  props.isText        Whether it is a run of text in
 *                                       writing, which has no design.
 * @param {boolean}  props.isLayoutItem  Whether it is placed by the page's
 *                                       layout, like its title, which has
 *                                       no design and stays where it is.
 * @param {boolean}  props.isComposing   Whether the canvas is in Compose,
 *                                       which has Edit content in place of
 *                                       Add.
 * @param {boolean}  props.isNarrow      Whether the modes go on a row of
 *                                       their own, for a narrow section.
 * @param {boolean}  props.isCompact     Whether the modes are icons only,
 *                                       for a short section.
 * @param {boolean}  props.canMoveUp     Whether it can move up.
 * @param {boolean}  props.canMoveDown   Whether it can move down.
 * @param {string}   props.clientId      The section.
 * @param {?Object}  props.posts         The posts it lists, if any, from
 *                                       `usePostsSection`, for Manage posts.
 * @param {Object}   props.style         Where the bar sits.
 * @param {Function} props.onAdd         Adds an item, called with its type.
 * @param {Function} props.onMenuToggle  Called with whether Add, or Manage
 *                                       posts, is open.
 * @param {Function} props.onManagePosts Leads to the posts' screen.
 * @param {Function} props.onMode        Called with the mode picked.
 * @param {Function} props.onMove        Called with -1 or 1.
 * @param {Function} props.onDuplicate   Duplicates the section.
 * @param {Function} props.onDelete      Deletes the section.
 * @return {Element} The bar.
 */
export function HoverBar( {
	canMoveDown,
	canMoveUp,
	clientId,
	isCompact,
	isComposing,
	isLayoutItem = false,
	isNarrow,
	isPart,
	isText = false,
	onAdd,
	onDelete,
	onDuplicate,
	onManagePosts,
	onMenuToggle,
	onMode,
	onMove,
	posts,
	style,
	title,
} ) {
	const modes = getModes( isPart, title, isComposing, isText, isLayoutItem );

	return (
		<div
			className={ `cnl-section-modes__bar${
				isNarrow ? ' is-narrow' : ''
			}` }
			style={ style }
		>
			<div className="cnl-section-modes__bar-start">
				{ ! isPart && ! isLayoutItem && ! isComposing && (
					<AddMenu
						onAdd={ onAdd }
						onToggle={ onMenuToggle }
						title={ title }
					/>
				) }
			</div>
			{ /* A run of text has no modes in Edit, nor an empty group. */ }
			{ ( modes.length > 0 ||
				( posts && ! isPart && ! isLayoutItem ) ) && (
				<div
					aria-label={ sprintf(
						/* translators: %s: section name. */
						__( 'Edit %s' ),
						title
					) }
					className="cnl-section-modes__group"
					role="group"
				>
					{ modes.map( ( { description, icon, label, mode } ) => (
						<BarButton
							icon={ icon }
							key={ mode }
							label={ isCompact ? label : description }
							onClick={ () => onMode( mode ) }
							text={ isCompact ? null : label }
						/>
					) ) }
					{ posts && ! isPart && ! isLayoutItem && (
						<PostsMenu
							clientId={ clientId }
							isCompact={ isCompact }
							onManageAll={ onManagePosts }
							onToggle={ onMenuToggle }
							posts={ posts }
						/>
					) }
				</div>
			) }
			<div className="cnl-section-modes__bar-end">
				{ ! isPart && ! isLayoutItem && (
					<div
						aria-label={ __( 'Section' ) }
						className="cnl-section-modes__group"
						role="group"
					>
						<BarButton
							disabled={ ! canMoveUp }
							icon={ arrowUpIcon }
							label={ __( 'Move section up' ) }
							onClick={ () => onMove( -1 ) }
						/>
						<BarButton
							disabled={ ! canMoveDown }
							icon={ arrowDownIcon }
							label={ __( 'Move section down' ) }
							onClick={ () => onMove( 1 ) }
						/>
						<BarButton
							icon={ copyIcon }
							label={ __( 'Duplicate section' ) }
							onClick={ onDuplicate }
						/>
						<BarButton
							className="is-delete"
							icon={ trashIcon }
							label={ __( 'Delete section' ) }
							onClick={ onDelete }
						/>
					</div>
				) }
			</div>
		</div>
	);
}

/**
 * Done editing, which leaves the mode.
 *
 * @param {Object}   props
 * @param {Function} props.onDone Leaves the mode.
 * @return {Element} The button.
 */
export function DoneButton( { onDone } ) {
	return (
		<Button
			className="cnl-section-modes__done"
			onClick={ onDone }
			size="compact"
			variant="primary"
		>
			{ __( 'Done editing' ) }
		</Button>
	);
}

/**
 * The bar on a section in Edit content or Freeform: Done, and Restore when
 * there is something to restore. The mode is its name for assistive
 * technology only; the section's outline and name say enough on
 * screen. The size of the bar over a section pointed at, or smaller, for a
 * small section, where it sits outside it.
 *
 * @param {Object}   props
 * @param {boolean}  props.isSmall      Whether it is the smaller bar.
 * @param {string}   props.label        The mode's name.
 * @param {number}   props.removedCount How many items were taken out.
 * @param {Object}   props.style        Where it sits.
 * @param {Function} props.onRestore    Puts back what was taken out.
 * @param {Function} props.onDone       Leaves the mode.
 * @param {Object}   ref                Takes the bar's node, to measure it.
 * @return {Element} The bar.
 */
export const ModeBar = forwardRef( function UnforwardedModeBar(
	{ isSmall, label, onDone, onRestore, removedCount, style },
	ref
) {
	return (
		<div
			aria-label={ label }
			className={ `cnl-section-modes__mode-bar${
				isSmall ? ' is-small' : ''
			}` }
			ref={ ref }
			role="group"
			style={ style }
		>
			{ removedCount > 0 && (
				<Button
					className="cnl-section-modes__text-button"
					description={ __( 'Bring back removed items' ) }
					onClick={ onRestore }
					size="compact"
					variant="secondary"
				>
					{ sprintf(
						/* translators: %d: number of items removed. */
						__( 'Restore (%d)' ),
						removedCount
					) }
				</Button>
			) }
			<DoneButton onDone={ onDone } />
		</div>
	);
} );
