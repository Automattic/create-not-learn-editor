/**
 * A section's design choices, Layout, Colour and Width. In Edit each opens
 * by itself in a popover under the section's toolbar
 * (`SectionDesignOptions`, in `section-tool-popover.jsx`). Zoomed out in
 * Compose, and on a header or footer, they are in a bar over it: the bar
 * lists the choices first, with More control on a header or footer, and
 * picking one drills into its options in the same bar, Back leading out
 * again. Colours and widths
 * sit in the bar's row; layouts, each drawn with the section's own content,
 * open in a tray under it. A header or footer offers its designs as its
 * layouts, and its colours. The last colour, Custom, opens a tray under
 * the colours with the section's own background, text and button colours,
 * so they are there for people who look for them without being offered
 * up front.
 *
 * Picking an option changes the section underneath at once, and that is it:
 * there is nothing to confirm. Back, Escape or a click anywhere else steps
 * out, the change kept, and undo takes it back like any other edit. More
 * control hands a header or footer to core's own block tools.
 */

/**
 * WordPress dependencies
 */
import { BlockPreview } from '@wordpress/block-editor';
import { Toolbar, ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { forwardRef, useRef, useState } from '@wordpress/element';
import {
	alignNone as alignNoneIcon,
	color as colorIcon,
	layout as layoutIcon,
	settings as optionsIcon,
	stretchFullWidth as stretchFullWidthIcon,
	stretchWide as stretchWideIcon,
} from '@wordpress/icons';
import { Menu } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	__,
	BlockIcon,
	blockEditorStore,
	Button,
	cautionIcon,
	chevronDownIcon,
	chevronUpIcon,
	cloneBlock,
	copyIcon,
	coreDataStore,
	Icon,
	pencilIcon,
	Popover,
	serialize,
	sprintf,
	trashIcon,
	useBlockDisplayInformation,
	useDispatch,
	useSelect,
} from '../../wordpress-packages';
import { ToolbarMenu } from '../../block-toolbar/toolbar-menu';
import ColorWell from '../../pickers/color-well';
import ColorList from './color-list';
import { getLayoutGridColumns, MAX_LAYOUT_COLUMNS } from './layout-grid';
import {
	usePartColors,
	usePartDesigns,
	useSectionVariations,
} from './use-variations';
import {
	getAttributeUpdate,
	getButtonTextValue,
	withCustomColors,
	withSectionColor,
} from '../compose/section-colors';
import {
	getContrast,
	MIN_TEXT_CONTRAST,
	parseColor,
} from '../compose/palette-colors';
import { resolveColor } from '../../pickers/resolve-color';
import { getPartColorBlocks } from '../compose/section-styles';
import {
	useSectionWidth,
	WIDTH_FULL,
	WIDTH_NARROW,
	WIDTH_WIDE,
} from '../../pickers/section-width';

export const VIEW_LAYOUT = 'layout';
export const VIEW_COLOR = 'color';
export const VIEW_WIDTH = 'width';
export const VIEW_CUSTOM_COLOR = 'custom-color';

// Below this, a button would be lost against the section's background.
const MIN_BUTTON_CONTRAST = 3;

/**
 * The level Escape steps out to from a design choice: from the custom
 * colours' tray to the colours, and from a choice to the choices.
 *
 * @param {?string} view The choice drilled into.
 * @return {?string} The choice above it, or null for the choices.
 */
export function getParentView( view ) {
	return view === VIEW_CUSTOM_COLOR ? VIEW_COLOR : null;
}

/**
 * @return {Object} The design choices' names, by view.
 */
function getViewLabels() {
	return {
		[ VIEW_LAYOUT ]: __( 'Layout', 'create-not-learn-editor' ),
		[ VIEW_COLOR ]: __( 'Colour', 'create-not-learn-editor' ),
		[ VIEW_WIDTH ]: __( 'Width', 'create-not-learn-editor' ),
	};
}

const VIEW_ICONS = {
	[ VIEW_LAYOUT ]: layoutIcon,
	[ VIEW_COLOR ]: colorIcon,
	[ VIEW_WIDTH ]: stretchWideIcon,
};

function Preview( { blocks } ) {
	return (
		<span aria-hidden className="cnl-section-modes__preview" inert="">
			<BlockPreview.Async>
				<BlockPreview blocks={ blocks } viewportWidth={ 1200 } />
			</BlockPreview.Async>
		</span>
	);
}

/**
 * Every layout at once, in a grid, so how many there are can be seen at a
 * glance and picking one moves nothing. Each is drawn with the section's own
 * content.
 *
 * @param {Object}   props
 * @param {?string}  props.current  The layout in use.
 * @param {Function} props.onSelect Called with the layout picked.
 * @param {Object[]} props.options  `{ blocks, label, name }` for each.
 * @return {Element} The layouts.
 */
function LayoutOptions( { current, onSelect, options } ) {
	const columns = getLayoutGridColumns( options.length, MAX_LAYOUT_COLUMNS );

	return (
		<div
			aria-label={ __( 'Layouts', 'create-not-learn-editor' ) }
			className="cnl-section-modes__options"
			role="group"
			style={ { '--cnl-layout-columns': columns } }
		>
			{ options.map( ( option ) => (
				<button
					aria-pressed={ option.name === current }
					className="cnl-section-modes__option"
					key={ option.name ?? 'none' }
					onClick={ () =>
						option.name !== current && onSelect( option )
					}
					title={ option.label }
					type="button"
				>
					<Preview blocks={ option.blocks } />
					<span>{ option.label }</span>
				</button>
			) ) }
		</div>
	);
}

/**
 * @param {string} width A width.
 * @return {string} What it is called.
 */
function getWidthLabel( width ) {
	return {
		[ WIDTH_NARROW ]: __( 'Narrow', 'create-not-learn-editor' ),
		[ WIDTH_WIDE ]: __( 'Wide', 'create-not-learn-editor' ),
		[ WIDTH_FULL ]: __( 'Full width', 'create-not-learn-editor' ),
	}[ width ];
}

const WIDTH_ICONS = {
	[ WIDTH_NARROW ]: alignNoneIcon,
	[ WIDTH_WIDE ]: stretchWideIcon,
	[ WIDTH_FULL ]: stretchFullWidthIcon,
};

/**
 * How wide the section's content runs, in the bar's row.
 *
 * @param {Object} props
 * @param {Object} props.width `{ current, options, onSelect }`.
 * @return {Element} The options.
 */
function WidthOptions( { width } ) {
	return (
		<div
			aria-label={ __( 'Width', 'create-not-learn-editor' ) }
			className="cnl-section-modes__swatches"
			role="group"
		>
			{ width.options.map( ( option ) => (
				<Button
					aria-pressed={ option === width.current }
					className="cnl-section-modes__swatch cnl-section-modes__width"
					icon={ WIDTH_ICONS[ option ] }
					key={ option }
					onClick={ () =>
						option !== width.current && width.onSelect( option )
					}
					size="compact"
				>
					{ getWidthLabel( option ) }
				</Button>
			) ) }
		</div>
	);
}

/**
 * Whether two colours stand apart enough, or true when either can't be
 * read, so nothing is flagged that can't be checked.
 *
 * @param {?string} a   A CSS colour.
 * @param {?string} b   Another.
 * @param {number}  min The contrast they need.
 * @return {boolean} Whether they do.
 */
function hasContrast( a, b, min ) {
	const first = parseColor( a );
	const second = parseColor( b );

	return ! first || ! second || getContrast( first, second ) >= min;
}

/**
 * A section's own colours, in the bar's row: its background, its text,
 * headings and links taking that too, and its buttons, whose words take
 * whichever of the other two reads on them. Each opens core's palette,
 * and each change shows at once.
 *
 * In the toolbar's Colour menu they are rows, as core's block Color panel
 * lists colours, each opening the palette beside it.
 *
 * @param {Object}  props
 * @param {Object}  props.colors `{ palette, values, onChange }`.
 * @param {boolean} props.isList Whether to show them as rows.
 * @return {Element} The colours.
 */
function CustomColors( { colors, isList = false } ) {
	const { onChange, palette, values } = colors;
	const resolved = Object.fromEntries(
		Object.entries( values ).map( ( [ key, value ] ) => [
			key,
			resolveColor( value, palette ),
		] )
	);
	const isTextReadable = hasContrast(
		resolved.text,
		resolved.background,
		MIN_TEXT_CONTRAST
	);
	const textNote =
		! isTextReadable &&
		__(
			'Text may be hard to read on this background.',
			'create-not-learn-editor'
		);
	const buttonNote =
		( ! hasContrast(
			resolved.button,
			resolved.background,
			MIN_BUTTON_CONTRAST
		) &&
			__(
				'Buttons may not stand out from the background.',
				'create-not-learn-editor'
			) ) ||
		( ! hasContrast(
			resolved.button,
			resolveColor( getButtonTextValue( values, palette ), palette ),
			MIN_TEXT_CONTRAST
		) &&
			__(
				'Words on buttons may be hard to read in this colour.',
				'create-not-learn-editor'
			) );
	const wells = [
		{
			key: 'background',
			label: __( 'Background', 'create-not-learn-editor' ),
			note: textNote,
		},
		{
			key: 'text',
			label: __( 'Text', 'create-not-learn-editor' ),
			note: textNote,
		},
		{
			key: 'button',
			label: __( 'Button', 'create-not-learn-editor' ),
			note: buttonNote,
		},
	];

	return (
		<div
			aria-label={ __( 'Custom colours', 'create-not-learn-editor' ) }
			className={
				isList
					? 'cnl-section-modes__custom-rows'
					: 'cnl-section-modes__swatches'
			}
			role="group"
		>
			{ wells.map( ( { key, label, note } ) => (
				<ColorWell
					className={
						isList
							? 'cnl-section-modes__custom-row'
							: 'cnl-section-modes__swatch cnl-section-modes__well'
					}
					key={ key }
					label={ label }
					note={ note }
					placement={ isList ? 'right-start' : undefined }
					onChange={ ( value ) =>
						onChange( { ...values, [ key ]: value } )
					}
					palette={ palette }
					value={ values[ key ] }
				>
					{ note && (
						<Icon
							className="cnl-section-modes__well-alert"
							icon={ cautionIcon }
							size={ 16 }
						/>
					) }
				</ColorWell>
			) ) }
		</div>
	);
}

/**
 * Puts a colour on blocks in the editor, or the theme's, in one change.
 *
 * @return {Function} Called with the blocks, the colour's name, or null for
 *                    the theme's, and the colours there are.
 */
function useUpdateColors() {
	const { updateBlockAttributes } = useDispatch( blockEditorStore );

	return ( blocks, name, options ) => {
		const changes = Object.fromEntries(
			blocks.map( ( block ) => [
				block.clientId,
				getAttributeUpdate(
					block.attributes,
					withSectionColor( block.attributes, options, name )
				),
			] )
		);

		updateBlockAttributes( Object.keys( changes ), changes, {
			uniqueByBlock: true,
		} );
	};
}

/**
 * Puts custom colours on blocks in the editor, in one change.
 *
 * @return {Function} Called with the blocks, the colours, as
 *                    `withCustomColors` takes them, and the result of
 *                    `useColorOptions`.
 */
function useUpdateCustomColors() {
	const { updateBlockAttributes } = useDispatch( blockEditorStore );

	return ( blocks, values, choices ) => {
		const changes = Object.fromEntries(
			blocks.map( ( block ) => [
				block.clientId,
				getAttributeUpdate(
					block.attributes,
					withCustomColors(
						block.attributes,
						choices.options,
						values,
						{
							colors: choices.colors,
							supports: choices.supports,
						}
					)
				),
			] )
		);

		updateBlockAttributes( Object.keys( changes ), changes, {
			uniqueByBlock: true,
		} );
	};
}

/**
 * A colour offer with what Custom needs: the swatch it shows while it is
 * the one in use, and how to change its colours.
 *
 * @param {?Object}  colors   From `getColorOffer`.
 * @param {Object}   choices  Result of `useColorOptions`.
 * @param {Function} onSelect Called with the option picked.
 * @param {Function} onCustom Called with the custom colours.
 * @return {?Object} `{ current, options, onSelect, custom }`.
 */
function withCustom( colors, choices, onSelect, onCustom ) {
	if ( ! colors ) {
		return null;
	}

	return {
		...colors,
		custom: {
			onChange: onCustom,
			palette: choices.colors,
			values: colors.values,
		},
		onSelect,
		swatch: [ 'background', 'text', 'button' ]
			.map( ( key ) =>
				resolveColor( colors.values[ key ], choices.colors )
			)
			.filter( Boolean ),
	};
}

/**
 * How wide a section's, header's or footer's content runs, when that can
 * change.
 *
 * @param {string} clientId The section, header or footer.
 * @return {?Object} `{ current, options, onSelect }`.
 */
function useWidthChoice( clientId ) {
	const { setWidth, width } = useSectionWidth( clientId );

	if ( ! width || width.options.length < 2 ) {
		return null;
	}

	return { ...width, onSelect: setWidth };
}

/**
 * What one design choice offers, by itself: its layouts, its colours, with
 * the custom ones under them once Custom is picked, or its widths. For the
 * popover hung from the choice's button, on core's toolbar in Edit and on
 * Edit design's toolbar.
 *
 * @param {Object} props
 * @param {Object} props.choices `{ colors, layouts, width }`.
 * @param {string} props.view    `VIEW_LAYOUT`, `VIEW_COLOR` or `VIEW_WIDTH`.
 * @return {?Element} The options.
 */
function ChoiceOptions( { choices, view } ) {
	const { colors, layouts, width } = choices;

	if ( view === VIEW_LAYOUT && layouts ) {
		return <LayoutOptions { ...layouts } />;
	}

	if ( view === VIEW_COLOR && colors ) {
		return (
			<ColorList
				colors={ colors }
				custom={
					colors.custom && (
						<CustomColors colors={ colors.custom } isList />
					)
				}
			/>
		);
	}

	if ( view === VIEW_WIDTH && width ) {
		return <WidthOptions width={ width } />;
	}

	return null;
}

// Other popovers opened from a choice's, like a custom colour's palette,
// and the toolbar's own buttons, which open, close and swap it.
const CHOICE_STAYS_OPEN_FOR =
	'.components-popover, [data-cnl-design-view], .cnl-block-options';

/**
 * Edit design's toolbar, drawn as core's block toolbar is in Edit, so a
 * section looks the same to work on zoomed out, and a header or footer
 * the same as a section: the name, its moves, its choices, each opening
 * under its button, then Options and Delete, or Done editing for an open
 * header or footer. See "The section's toolbar" in `../README.md`.
 *
 * @param {Object}    props
 * @param {Object}    props.choices     `{ colors, layouts, width }`, each
 *                                      `{ current, options, onSelect }`, or
 *                                      null when there is nothing to choose.
 * @param {string}    props.clientId    The section, or the part's block.
 * @param {string}    props.title       Its name.
 * @param {?string}   props.view        The choice open, if any.
 * @param {Function}  props.onView      Called with the choice to open, or
 *                                      null to close it.
 * @param {?Function} props.onMove      Moves a section, called with -1 or 1.
 * @param {boolean}   props.canMoveUp   Whether it can move up.
 * @param {boolean}   props.canMoveDown Whether it can move down.
 * @param {?Function} props.onZoomIn    Zooms back into Edit, for its words
 *                                      and pictures.
 * @param {?Function} props.onDuplicate Duplicates a section.
 * @param {?Function} props.onDelete    Deletes a section.
 * @param {?Function} props.onFreeform  Hands a header or footer to core's
 *                                      own block tools.
 * @param {?Element}  props.end         What goes at the end, like an open
 *                                      header's Done editing.
 * @param {Object}    props.style       Where the toolbar sits.
 * @param {Object}    ref               Ref to the toolbar.
 * @return {Element} The toolbar.
 */
const DesignBarView = forwardRef( function UnforwardedDesignBarView(
	{
		canMoveDown,
		canMoveUp,
		choices,
		clientId,
		end,
		onDelete,
		onDuplicate,
		onFreeform,
		onMove,
		onView,
		onZoomIn,
		style,
		title,
		view,
	},
	ref
) {
	const labels = getViewLabels();
	const [ buttons ] = useState( () => ( {} ) );
	const info = useBlockDisplayInformation( clientId );
	const views = [ VIEW_LAYOUT, VIEW_COLOR, VIEW_WIDTH ].filter(
		( name ) =>
			( name === VIEW_LAYOUT && choices.layouts ) ||
			( name === VIEW_COLOR && choices.colors ) ||
			( name === VIEW_WIDTH && choices.width )
	);
	const openView = getParentView( view ) ?? view;
	const hasOptions = Boolean( onDuplicate || onFreeform );

	return (
		<div className="cnl-section-modes__design" ref={ ref } style={ style }>
			<Toolbar
				className="cnl-section-modes__design-row"
				label={ sprintf(
					/* translators: %s: section name. */
					__( '%s design', 'create-not-learn-editor' ),
					title
				) }
			>
				<ToolbarGroup>
					<div className="cnl-section-modes__design-name">
						<BlockIcon icon={ info?.icon } />
						<span title={ title }>{ title }</span>
					</div>
				</ToolbarGroup>
				{ onMove && (
					// Core's classes, so they are drawn as core's movers are.
					<ToolbarGroup className="block-editor-block-mover">
						<div className="block-editor-block-mover__move-button-container">
							<ToolbarButton
								accessibleWhenDisabled
								className="block-editor-block-mover-button is-up-button"
								disabled={ ! canMoveUp }
								icon={ chevronUpIcon }
								label={ __(
									'Move section up',
									'create-not-learn-editor'
								) }
								onClick={ () => onMove( -1 ) }
							/>
							<ToolbarButton
								accessibleWhenDisabled
								className="block-editor-block-mover-button is-down-button"
								disabled={ ! canMoveDown }
								icon={ chevronDownIcon }
								label={ __(
									'Move section down',
									'create-not-learn-editor'
								) }
								onClick={ () => onMove( 1 ) }
							/>
						</div>
					</ToolbarGroup>
				) }
				{ ( onZoomIn || views.length > 0 ) && (
					<ToolbarGroup>
						{ onZoomIn && (
							<ToolbarButton
								className="cnl-section-modes__design-tool"
								description={ __(
									'Zoom in to change its words and pictures',
									'create-not-learn-editor'
								) }
								icon={ pencilIcon }
								onClick={ onZoomIn }
							>
								{ __( 'Edit', 'create-not-learn-editor' ) }
							</ToolbarButton>
						) }
						{ views.map( ( name ) => (
							<ToolbarButton
								aria-expanded={ openView === name }
								aria-haspopup="true"
								className="cnl-section-modes__design-tool"
								data-cnl-design-view={ name }
								icon={ VIEW_ICONS[ name ] }
								isPressed={ openView === name }
								key={ name }
								onClick={ () =>
									onView( openView === name ? null : name )
								}
								ref={ ( node ) => {
									buttons[ name ] = node;
								} }
							>
								{ labels[ name ] }
							</ToolbarButton>
						) ) }
					</ToolbarGroup>
				) }
				{ ( hasOptions || onDelete || end ) && (
					<ToolbarGroup>
						{ hasOptions && (
							<ToolbarMenu
								buttonProps={ {
									icon: optionsIcon,
									label: __(
										'Options',
										'create-not-learn-editor'
									),
								} }
								popupClassName="cnl-block-options"
							>
								{ onDuplicate && (
									<Menu.Item
										onClick={ onDuplicate }
										prefix={
											<Menu.PrefixIcon
												icon={ copyIcon }
											/>
										}
									>
										<Menu.ItemLabel>
											{ __(
												'Duplicate',
												'create-not-learn-editor'
											) }
										</Menu.ItemLabel>
									</Menu.Item>
								) }
								{ onFreeform && (
									<Menu.Item onClick={ onFreeform }>
										<Menu.ItemLabel>
											{ __(
												'More control',
												'create-not-learn-editor'
											) }
										</Menu.ItemLabel>
										<Menu.ItemDescription>
											{ __(
												'Move, resize and restyle its blocks',
												'create-not-learn-editor'
											) }
										</Menu.ItemDescription>
									</Menu.Item>
								) }
							</ToolbarMenu>
						) }
						{ onDelete && (
							<ToolbarButton
								icon={ trashIcon }
								label={ __(
									'Delete',
									'create-not-learn-editor'
								) }
								onClick={ onDelete }
							/>
						) }
						{ end }
					</ToolbarGroup>
				) }
			</Toolbar>
			{ openView && views.includes( openView ) && (
				<Popover
					anchor={ buttons[ openView ] }
					className="cnl-section-tool-popover"
					offset={ 8 }
					onClose={ () => onView( null ) }
					onFocusOutside={ ( event ) => {
						if (
							! event.relatedTarget?.closest?.(
								CHOICE_STAYS_OPEN_FOR
							)
						) {
							onView( null );
						}
					} }
					placement="bottom-start"
					resize={ false }
				>
					<div
						className={ `cnl-section-modes cnl-section-tool-panel is-${ openView }` }
					>
						<ChoiceOptions choices={ choices } view={ openView } />
					</div>
				</Popover>
			) }
		</div>
	);
} );

/**
 * Which of a section's design choices it has something to choose for, for
 * its toolbar's buttons.
 *
 * @param {?string} clientId The section.
 * @return {string[]} `VIEW_LAYOUT`, `VIEW_COLOR` and `VIEW_WIDTH`, those of
 *                    them it has.
 */
export function useSectionDesignViews( clientId ) {
	const { colors, layouts } = useSectionVariations( clientId, {
		allowCustom: true,
	} );
	const width = useWidthChoice( clientId );

	return [
		layouts && VIEW_LAYOUT,
		colors && VIEW_COLOR,
		width && VIEW_WIDTH,
	].filter( Boolean );
}

/**
 * A section's design choices, each `{ current, options, onSelect }` or null
 * when there is nothing to choose.
 *
 * @param {string}   clientId  The section.
 * @param {Function} onReplace Called with the block that takes the section's
 *                             place when its layout changes.
 * @return {Object} `{ colors, layouts, width }`.
 */
function useSectionChoices( clientId, onReplace ) {
	const { replaceBlocks } = useDispatch( blockEditorStore );
	const updateColors = useUpdateColors();
	const updateCustomColors = useUpdateCustomColors();
	const { block, choices, colors, layouts } = useSectionVariations(
		clientId,
		{
			allowCustom: true,
		}
	);
	const width = useWidthChoice( clientId );
	const steady = useSteadyLayouts( block, layouts );

	return {
		colors: withCustom(
			colors,
			choices,
			( name ) => updateColors( [ block ], name, colors.options ),
			( values ) => updateCustomColors( [ block ], values, choices )
		),
		layouts: steady.layouts && {
			...steady.layouts,
			onSelect: ( option ) => {
				const next = cloneBlock( option.block );

				steady.remember( next.clientId, option.name );
				// Selected but not focused: focus would scroll the canvas
				// to the new section, taking the toolbar and the layouts
				// with it.
				replaceBlocks( clientId, next, 0, null );
				onReplace( next );
			},
		},
		width,
	};
}

/**
 * A section's layouts, held as they were when first offered while its
 * layouts are picked between. They are worked out from the section's shape,
 * so the layout picked would otherwise offer a different set, in another
 * order, and the cards would move under the pointer. Any other change to
 * the section, or a section the picks didn't put in, offers them afresh.
 * Undo and redo go back to a section the picks put in, which keeps its own.
 *
 * @param {?Object} block   The section.
 * @param {?Object} layouts `{ current, options }` for it, or null.
 * @return {Object} `{ layouts, remember }`: the layouts to offer, and a
 *                  function taking the client ID of the section a pick put
 *                  in, and the layout's name.
 */
function useSteadyLayouts( block, layouts ) {
	const held = useRef( null );
	const seen = block && held.current?.sections.get( block.clientId );

	if ( seen && ! seen.block ) {
		// The section a pick put in, as the editor holds it.
		seen.block = block;
	}

	if ( layouts && ( ! seen || seen.block !== block ) ) {
		held.current = {
			options: layouts.options,
			sections: new Map( [
				[ block.clientId, { block, name: layouts.current } ],
			] ),
		};
	}

	// Between a pick and the new section being selected there is no
	// section, and the layouts stay as they were rather than blink out.
	const current = block
		? held.current?.sections.get( block.clientId )
		: held.current?.last;

	if ( current ) {
		held.current.last = current;
	}

	return {
		layouts: current
			? { current: current.name, options: held.current.options }
			: null,
		remember: ( clientId, name ) =>
			held.current?.sections.set( clientId, { name } ),
	};
}

/**
 * A section's design choices, in the bar.
 *
 * @param {Object}   props
 * @param {string}   props.clientId  The section.
 * @param {Function} props.onReplace See `useSectionChoices`.
 * @param {Object}   ref             Ref to the bar.
 * @return {Element} The bar.
 */
const SectionDesignBar = forwardRef( function UnforwardedSectionDesignBar(
	{ clientId, onReplace, ...props },
	ref
) {
	return (
		<DesignBarView
			{ ...props }
			choices={ useSectionChoices( clientId, onReplace ) }
			clientId={ clientId }
			ref={ ref }
		/>
	);
} );

/**
 * One of a section's design choices by itself, for the popover under its
 * toolbar: its layouts, its colours, with the custom ones under them once
 * Custom is picked, or its widths.
 *
 * @param {Object}   props
 * @param {string}   props.clientId  The section.
 * @param {string}   props.view      `VIEW_LAYOUT`, `VIEW_COLOR` or
 *                                   `VIEW_WIDTH`.
 * @param {Function} props.onReplace See `useSectionChoices`.
 * @return {?Element} The options.
 */
export function SectionDesignOptions( { clientId, view, onReplace } ) {
	return (
		<ChoiceOptions
			choices={ useSectionChoices( clientId, onReplace ) }
			view={ view }
		/>
	);
}

/**
 * A header's or footer's design choices: its designs, as its layouts, and
 * its colours.
 *
 * @param {Object} props
 * @param {Object} props.part `{ area, clientId, id }`.
 * @param {Object} ref        Ref to the bar.
 * @return {Element} The bar.
 */
const PartDesignBar = forwardRef( function UnforwardedPartDesignBar(
	{ part, ...props },
	ref
) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const updateColors = useUpdateColors();
	const updateCustomColors = useUpdateCustomColors();
	const { blockName, choices, colors } = usePartColors( part );
	const designs = usePartDesigns(
		part,
		colors && {
			blockName,
			choices,
			name: colors.current,
			values: colors.values,
		}
	);
	const partBlocks = useSelect(
		( select ) => select( blockEditorStore ).getBlocks( part.clientId ),
		[ part.clientId ]
	);
	const width = useWidthChoice( part.clientId );

	return (
		<DesignBarView
			{ ...props }
			choices={ {
				colors: withCustom(
					colors,
					choices,
					( name ) =>
						updateColors(
							getPartColorBlocks( partBlocks ),
							name,
							colors.options
						),
					( values ) =>
						updateCustomColors(
							getPartColorBlocks( partBlocks ),
							values,
							choices
						)
				),
				layouts:
					designs.options.length > 1
						? {
								...designs,
								onSelect: ( option ) => {
									const blocks = option.blocks.map(
										( item ) => cloneBlock( item )
									);

									editEntityRecord(
										'postType',
										'wp_template_part',
										part.id,
										{
											blocks,
											content: serialize( blocks ),
										}
									);
								},
							}
						: null,
				width,
			} }
			ref={ ref }
		/>
	);
} );

/**
 * @param {Object}   props
 * @param {?Object}  props.part      The header or footer, if it is one.
 * @param {string}   props.clientId  The section.
 * @param {string}   props.title     Its name.
 * @param {?string}  props.view      The choice drilled into, if any.
 * @param {Object}   props.style     Where the bar sits.
 * @param {Function} props.onView    See `DesignBarView`, as are its
 *                                   moves, Edit content, Duplicate,
 *                                   Delete, More control and `end`.
 * @param {Function} props.onReplace See `SectionDesignBar`.
 * @param {Object}   ref             Ref to the bar.
 * @return {Element} The bar.
 */
function DesignBar( { clientId, onReplace, part, ...props }, ref ) {
	return (
		<>
			{ part ? (
				<PartDesignBar
					{ ...props }
					clientId={ clientId }
					part={ part }
					ref={ ref }
				/>
			) : (
				<SectionDesignBar
					{ ...props }
					clientId={ clientId }
					onReplace={ onReplace }
					ref={ ref }
				/>
			) }
		</>
	);
}

export default forwardRef( DesignBar );
