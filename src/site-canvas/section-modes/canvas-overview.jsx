/**
 * Document Overview's List View, for a page built from sections: what the
 * canvas shows, a row each, in Header, Content and Footer. See "Document
 * Overview" in `../README.md`.
 */

/**
 * WordPress dependencies
 */
import { createPortal } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { observeHost } from '../../editor-layer/portal-host';
import { unlock } from '../../lock-unlock';
import { EMPTY_ARRAY } from './layer-constants';
import { groupOverviewRows } from './overview-groups';
import { getPartModeLabel } from './section-chrome';
import {
	__,
	BlockIcon,
	blockEditorStore,
	BlockTitle,
	Button,
	chevronLeftSmallIcon,
	chevronRightSmallIcon,
	footerIcon,
	getBlockType,
	headerIcon,
	Icon,
	isRTL,
	lockSmallIcon,
	pencilIcon,
	plusIcon,
	Text,
	Tooltip,
	TreeGrid,
	TreeGridCell,
	TreeGridRow,
	useBlockDisplayInformation,
	useEffect,
	useId,
	useMemo,
	useRef,
	useRegistry,
	useSelect,
	useState,
	VisuallyHidden,
} from '../../wordpress-packages';

const EDITOR_STORE = 'core/editor';
const LIST_PANEL = '.editor-list-view-sidebar__list-view-panel-content';
const HOST_CLASS = 'cnl-canvas-overview-host';
const PART_ICONS = { footer: footerIcon, header: headerIcon };
// What a run of text is listed as: no block's name, with a paragraph's icon.
const TEXT_SECTION_NAME = 'cnl/text';

/**
 * Rows for the parts, layout items and sections, in page order, each `{
 * area, clientId, icon, isLayoutItem, isPart, title }`.
 *
 * @param {Object}   props
 * @param {Function} props.getTitle        The layer's name for a block.
 * @param {Function} props.isTextSection   Whether a section is a run of text.
 * @param {Object}   props.layoutItemsById The layout items, by ID.
 * @param {Object}   props.partsById       The template parts, by ID.
 * @param {string[]} props.sectionIds      The sections, runs of text grouped.
 * @return {Array} The rows.
 */
function useOverviewRows( {
	getTitle,
	isTextSection,
	layoutItemsById,
	partsById,
	sectionIds,
} ) {
	/*
	 * Kept to a string, so the selector returns the same value until a row
	 * changes, and the list isn't drawn again on every keystroke.
	 */
	const rowsKey = useSelect(
		( select ) => {
			const store = select( blockEditorStore );
			const position = new Map(
				store
					.getClientIdsWithDescendants()
					.map( ( clientId, index ) => [ clientId, index ] )
			);

			return [
				...Object.keys( partsById ),
				...Object.keys( layoutItemsById ),
				...sectionIds,
			]
				.filter( ( clientId ) => position.has( clientId ) )
				.sort( ( a, b ) => position.get( a ) - position.get( b ) )
				.map( ( clientId ) =>
					[
						clientId,
						partsById[ clientId ]?.area ?? '',
						isTextSection( clientId )
							? TEXT_SECTION_NAME
							: store.getBlockName( clientId ),
						getTitle( clientId ).replace( /[|\n]/g, ' ' ),
					].join( '|' )
				)
				.join( '\n' );
		},
		// `getTitle` and `isTextSection` read the sections as they are now.
		[ getTitle, isTextSection, layoutItemsById, partsById, sectionIds ]
	);

	return useMemo(
		() =>
			rowsKey
				? rowsKey.split( '\n' ).map( ( line ) => {
						const [ clientId, area, name, title ] =
							line.split( '|' );

						return {
							area: area || null,
							clientId,
							icon:
								PART_ICONS[ area ] ||
								getBlockType(
									name === TEXT_SECTION_NAME
										? 'core/paragraph'
										: name
								)?.icon,
							isLayoutItem: Boolean(
								layoutItemsById[ clientId ]
							),
							isPart: Boolean( partsById[ clientId ] ),
							isText: name === TEXT_SECTION_NAME,
							// A run of text is known by its first block, which
							// has a row of its own under it.
							key:
								name === TEXT_SECTION_NAME
									? `text:${ clientId }`
									: clientId,
							title,
						};
					} )
				: [],
		[ layoutItemsById, partsById, rowsKey ]
	);
}

/**
 * The blocks inside each section that is open in the list, a row each,
 * from core's own tree for the list view, so the list leaves out what core's
 * leaves out. A header or footer has none until it is opened with Edit
 * header or Edit footer, as its blocks can't be reached until then.
 *
 * @param {Object}      props
 * @param {Array}       props.rows       The sections' rows.
 * @param {Set<string>} props.expanded   The rows open in the list.
 * @param {Function}    props.getMembers A section's blocks, a run of text's
 *                                       being its paragraphs.
 * @param {?string}     props.openPartId The header or footer open.
 * @return {Object} `{ hasChildren, children }`: the sections with blocks to
 *                  list, by row key, and the rows under each section open,
 *                  each `{ clientId, hasChildren, level, position, setSize }`.
 */
function useNestedRows( { rows, expanded, getMembers, openPartId } ) {
	// Kept to a string, as the sections' rows are, for the same reason.
	const key = useSelect(
		( select ) => {
			const store = unlock( select( blockEditorStore ) );
			const lines = [];

			const walk = ( nodes, level, sectionId ) =>
				nodes.forEach( ( node, index ) => {
					const hasChildren = node.innerBlocks.length > 0;

					lines.push(
						[
							sectionId,
							node.clientId,
							level,
							hasChildren ? 1 : 0,
							index + 1,
							nodes.length,
						].join( '|' )
					);

					if ( hasChildren && expanded.has( node.clientId ) ) {
						walk( node.innerBlocks, level + 1, sectionId );
					}
				} );

			rows.forEach( ( row ) => {
				let tree = [];

				if ( row.isText ) {
					const members = new Set( getMembers( row.clientId ) );
					const parentId = store.getBlockRootClientId(
						getMembers( row.clientId )[ 0 ]
					);

					tree = store
						.getListViewClientIdsTree( parentId ?? '' )
						.filter( ( node ) => members.has( node.clientId ) );
				} else if (
					! row.isLayoutItem &&
					( ! row.isPart || row.clientId === openPartId )
				) {
					tree = store.getListViewClientIdsTree( row.clientId );
				}

				if ( ! tree.length ) {
					return;
				}

				// A section with blocks to list, open or not.
				lines.push( row.key );

				if ( expanded.has( row.key ) ) {
					walk( tree, 2, row.key );
				}
			} );

			return lines.join( '\n' );
		},
		// `getMembers` reads the sections as they are now.
		[ expanded, getMembers, openPartId, rows ]
	);

	return useMemo( () => {
		const hasChildren = new Set();
		const children = {};

		( key ? key.split( '\n' ) : [] ).forEach( ( line ) => {
			const fields = line.split( '|' );

			if ( fields.length === 1 ) {
				hasChildren.add( line );
				return;
			}

			const [ sectionId, clientId, level, nested, position, setSize ] =
				fields;

			( children[ sectionId ] ??= [] ).push( {
				clientId,
				hasChildren: nested === '1',
				level: Number( level ),
				position: Number( position ),
				setSize: Number( setSize ),
			} );
		} );

		return { hasChildren, children };
	}, [ key ] );
}

/**
 * The chevron that opens and closes a row, core's list view's own.
 *
 * @param {Object}   props
 * @param {Function} props.onToggle Opens or closes the row.
 * @return {Element} The chevron.
 */
function Expander( { onToggle } ) {
	return (
		// The row's own button takes the keyboard: Right and Left open and
		// close it, as in core's list view.
		<span
			aria-hidden="true"
			className="block-editor-list-view__expander"
			onClick={ ( event ) => {
				event.stopPropagation();
				onToggle?.();
			} }
		>
			<Icon
				icon={ isRTL() ? chevronLeftSmallIcon : chevronRightSmallIcon }
			/>
		</span>
	);
}

/**
 * A row, drawn with core's list view's own markup and classes, so it looks
 * and behaves as a row there does.
 *
 * @param {Object}   props
 * @param {string}   props.clientId    The block the row is for.
 * @param {?string}  props.rowKey      What opens and closes it, if not
 *                                     the block's ID.
 * @param {?string}  props.className   Added to the row's classes.
 * @param {?boolean} props.isExpanded  Whether it is open, if it can be.
 * @param {boolean}  props.isSelected  Whether it is picked.
 * @param {number}   props.level       How deep it is, from 1.
 * @param {number}   props.position    Its place among its siblings, from 1.
 * @param {number}   props.setSize     How many siblings it has.
 * @param {Function} props.onPick      Picks it on the canvas.
 * @param {Function} props.onToggle    Opens or closes it.
 * @param {Object}   props.buttonProps Added to the row's button.
 * @param {?Object}  props.action      A button at the row's end, `{ icon,
 *                                     label, onClick }`, where core's list
 *                                     view has its options.
 * @param {Element}  props.children    The row's icon and name.
 * @return {Element} The row.
 */
function LayerRow( {
	clientId,
	rowKey = clientId,
	className,
	isExpanded,
	isSelected,
	level,
	position,
	setSize,
	onPick,
	onToggle,
	buttonProps,
	action,
	children,
} ) {
	return (
		<TreeGridRow
			aria-selected={ isSelected }
			className={ [
				'block-editor-list-view-leaf',
				! action && 'has-single-cell',
				'cnl-canvas-overview__row',
				isSelected && 'is-selected',
				className,
			]
				.filter( Boolean )
				.join( ' ' ) }
			data-block={ clientId }
			data-row={ rowKey }
			data-expanded={
				isExpanded === undefined ? undefined : String( isExpanded )
			}
			isExpanded={ isExpanded }
			level={ level }
			positionInSet={ position }
			setSize={ setSize }
		>
			<TreeGridCell className="block-editor-list-view-block__contents-cell">
				{ ( cellProps ) => (
					<button
						{ ...cellProps }
						{ ...buttonProps }
						aria-expanded={ isExpanded }
						className="block-editor-list-view-block-select-button block-editor-list-view-block-contents cnl-canvas-overview__select"
						onClick={ onPick }
						type="button"
					>
						<Expander onToggle={ onToggle } />
						{ children }
					</button>
				) }
			</TreeGridCell>
			{ action && (
				// Always shown, as it is the way into the part: core's own cell shows
				// its button only while the row is pointed at.
				<TreeGridCell className="block-editor-list-view-block__menu-cell is-visible">
					{ ( cellProps ) => (
						<Button
							{ ...cellProps }
							className="block-editor-list-view-block__menu"
							icon={ action.icon }
							label={ action.label }
							onClick={ action.onClick }
							size="small"
						/>
					) }
				</TreeGridCell>
			) }
		</TreeGridRow>
	);
}

/**
 * A block's row inside a section, named and drawn as core's list view
 * names and draws it.
 *
 * @param {Object} props
 * @param {Object} props.row  Its row, `{ clientId, hasChildren, level }`.
 * @param {Object} props.rest Passed to the row.
 * @return {Element} The row.
 */
function BlockRow( { row, ...rest } ) {
	const information = useBlockDisplayInformation( row.clientId );

	return (
		<LayerRow clientId={ row.clientId } level={ row.level } { ...rest }>
			<BlockIcon icon={ information?.icon } showColors />
			<span className="block-editor-list-view-block-select-button__label-wrapper cnl-canvas-overview__title">
				<BlockTitle
					clientId={ row.clientId }
					context="list-view"
					maximumLength={ 0 }
				/>
			</span>
		</LayerRow>
	);
}

/**
 * A section's row, and the rows of its blocks under it when it is open.
 *
 * @param {Object}   props
 * @param {Object}   props.row          The section's row.
 * @param {Array}    props.children     Its blocks' rows, while it is open.
 * @param {boolean}  props.hasChildren  Whether it has blocks to list.
 * @param {Set}      props.expanded     The rows open in the list.
 * @param {?string}  props.selectedId   The key of the row picked.
 * @param {number}   props.index        Its place in its group, from 1.
 * @param {number}   props.count        How many rows its group has.
 * @param {Function} props.onPick       Picks a section on the canvas.
 * @param {Function} props.onPickBlock  Picks a block in a section.
 * @param {Function} props.onToggle     Opens or closes a row.
 * @param {Function} props.onEditPart   Opens a header or footer, as Edit
 *                                      header or Edit footer does.
 * @param {?string}  props.openPartId   The header or footer open.
 * @param {string}   props.layoutNoteId ID of the layout items' note.
 * @return {Element} The rows.
 */
function SectionRows( {
	row,
	children = EMPTY_ARRAY,
	hasChildren,
	expanded,
	selectedId,
	index,
	count,
	onPick,
	onPickBlock,
	onToggle,
	onEditPart,
	openPartId,
	layoutNoteId,
} ) {
	const isExpanded = hasChildren ? expanded.has( row.key ) : undefined;

	return (
		<>
			<LayerRow
				action={
					row.isPart && row.clientId !== openPartId
						? {
								icon: pencilIcon,
								label: getPartModeLabel( row.title ),
								onClick: () => onEditPart( row.clientId ),
							}
						: undefined
				}
				buttonProps={ {
					'aria-describedby': row.isLayoutItem
						? layoutNoteId
						: undefined,
				} }
				className={ [
					( row.isPart || row.isLayoutItem ) && 'is-global',
					// Locked, it has nothing to open, and no room for a chevron.
					row.isPart && ! hasChildren && 'is-locked-part',
				]
					.filter( Boolean )
					.join( ' ' ) }
				clientId={ row.clientId }
				isExpanded={ isExpanded }
				isSelected={ row.key === selectedId }
				level={ 1 }
				onPick={ () => onPick( row.clientId ) }
				onToggle={ hasChildren && ( () => onToggle( row.key ) ) }
				position={ index }
				rowKey={ row.key }
				setSize={ count }
			>
				<BlockIcon icon={ row.icon } />
				<span className="block-editor-list-view-block-select-button__label-wrapper cnl-canvas-overview__title">
					{ row.title }
				</span>
				{ row.isLayoutItem && (
					<Tooltip.Root>
						<Tooltip.Trigger
							className="cnl-canvas-overview__lock"
							render={ <span /> }
						>
							<BlockIcon icon={ lockSmallIcon } />
						</Tooltip.Trigger>
						<Tooltip.Popup>
							{ __(
								'Part of the layout',
								'create-not-learn-editor'
							) }
						</Tooltip.Popup>
					</Tooltip.Root>
				) }
			</LayerRow>
			{ isExpanded &&
				children.map( ( child ) => (
					<BlockRow
						isExpanded={
							child.hasChildren
								? expanded.has( child.clientId )
								: undefined
						}
						isSelected={ child.clientId === selectedId }
						key={ child.clientId }
						onPick={ () =>
							onPickBlock( row.clientId, child.clientId )
						}
						onToggle={
							child.hasChildren &&
							( () => onToggle( child.clientId ) )
						}
						position={ child.position }
						row={ child }
						setSize={ child.setSize }
					/>
				) ) }
		</>
	);
}

/**
 * A group of rows under its heading.
 *
 * @param {Object}   props
 * @param {string}   props.label    The group's heading.
 * @param {Array}    props.rows     Its sections' rows.
 * @param {Object}   props.nested   `{ hasChildren, children }`, from
 *                                  `useNestedRows()`.
 * @param {Function} props.onToggle Opens or closes a row.
 * @param {?Element} props.children Shown below the rows.
 * @return {Element} The group.
 */
function OverviewGroup( {
	label,
	rows,
	nested,
	onToggle,
	children,
	...rowProps
} ) {
	const headingId = useId();
	const toggleRow = ( row, isOpen ) => {
		const key = row?.dataset.row;

		if ( key && rowProps.expanded.has( key ) !== isOpen ) {
			onToggle( key );
		}
	};

	return (
		<section className="cnl-canvas-overview__group">
			<Text
				className="cnl-canvas-overview__heading"
				id={ headingId }
				render={ <h2 /> }
				variant="heading-sm"
			>
				{ label }
			</Text>
			{ rows.length > 0 && (
				<TreeGrid
					aria-labelledby={ headingId }
					className="block-editor-list-view-tree cnl-canvas-overview__tree"
					onCollapseRow={ ( row ) => toggleRow( row, false ) }
					onExpandRow={ ( row ) => toggleRow( row, true ) }
				>
					{ rows.map( ( row, index ) => (
						<SectionRows
							{ ...rowProps }
							count={ rows.length }
							hasChildren={ nested.hasChildren.has( row.key ) }
							index={ index + 1 }
							key={ row.key }
							onToggle={ onToggle }
							row={ row }
						>
							{ nested.children[ row.key ] }
						</SectionRows>
					) ) }
				</TreeGrid>
			) }
			{ children }
		</section>
	);
}

/**
 * The list, in Document Overview's List View tab, in place of core's.
 *
 * @param {Object}   props
 * @param {Object}   props.editorRef       Ref to the editor's container.
 * @param {?string}  props.currentId       The block picked on the canvas.
 * @param {Function} props.getTitle        The layer's name for a block.
 * @param {Function} props.isTextSection   Whether a section is a run of text.
 * @param {Object}   props.layoutItemsById The layout items, by ID.
 * @param {Object}   props.partsById       The template parts, by ID.
 * @param {string[]} props.sectionIds      The sections, runs of text grouped.
 * @param {Function} props.onPick          Picks a block on the canvas.
 * @param {Function} props.onAddSection    Adds a section at the page's end.
 * @return {?Element} The list, while Document Overview's List View is open.
 */
export function CanvasOverview( { editorRef, ...props } ) {
	const isOpen = useSelect(
		( select ) => Boolean( select( EDITOR_STORE )?.isListViewOpened?.() ),
		[]
	);
	const [ host, setHost ] = useState( null );

	// The List View tab's panel is core's, and goes while Outline is shown.
	useEffect( () => {
		if ( ! isOpen || ! editorRef.current ) {
			setHost( null );
			return undefined;
		}

		return observeHost(
			LIST_PANEL,
			HOST_CLASS,
			setHost,
			editorRef.current
		);
	}, [ editorRef, isOpen ] );

	return host ? createPortal( <OverviewList { ...props } />, host ) : null;
}

function OverviewList( {
	currentId,
	getMembers,
	getTitle,
	isTextSection,
	layoutItemsById,
	onAddSection,
	onPick,
	onEditPart,
	onPickBlock,
	openPartId,
	partsById,
	sectionIds,
} ) {
	const ref = useRef();
	const registry = useRegistry();
	const layoutNoteId = useId();
	const rows = useOverviewRows( {
		getTitle,
		isTextSection,
		layoutItemsById,
		partsById,
		sectionIds,
	} );
	const { header, content, footer } = groupOverviewRows( rows );
	// The rows open, by key. Closed to begin with, as in core's list view.
	const [ expanded, setExpanded ] = useState( () => new Set() );
	const nested = useNestedRows( { expanded, getMembers, openPartId, rows } );
	const selectedBlockId = useSelect(
		( select ) => select( blockEditorStore ).getSelectedBlockClientId(),
		[]
	);

	const toggle = ( key ) =>
		setExpanded( ( previous ) => {
			const next = new Set( previous );

			if ( next.has( key ) ) {
				next.delete( key );
			} else {
				next.add( key );
			}

			return next;
		} );

	const open = ( keys ) =>
		setExpanded( ( previous ) =>
			keys.every( ( key ) => previous.has( key ) )
				? previous
				: new Set( [ ...previous, ...keys ] )
		);

	// The header or footer opened with Edit header or Edit footer opens
	// here too, as that is when its blocks can be reached.
	useEffect( () => {
		if ( openPartId ) {
			open( [ openPartId ] );
		}
	}, [ openPartId ] );

	/*
	 * A block selected inside a section opens the rows down to it, as core's
	 * list view does, so its row shows. A section's own block, selected as
	 * the section is picked, opens nothing.
	 */
	useEffect( () => {
		if ( ! selectedBlockId ) {
			return;
		}

		const chain = [
			...registry
				.select( blockEditorStore )
				.getBlockParents( selectedBlockId ),
			selectedBlockId,
		];
		const textRow = rows.find(
			( row ) =>
				row.isText &&
				getMembers( row.clientId ).some( ( id ) =>
					chain.includes( id )
				)
		);
		const sectionIndex = textRow
			? chain.indexOf( textRow.clientId )
			: chain.findIndex( ( id ) =>
					rows.some( ( row ) => row.key === id )
				);

		if ( textRow ) {
			const memberIndex = chain.findIndex( ( id ) =>
				getMembers( textRow.clientId ).includes( id )
			);

			open( [ textRow.key, ...chain.slice( memberIndex, -1 ) ] );
		} else if ( sectionIndex !== -1 ) {
			open( chain.slice( sectionIndex, -1 ) );
		}
		// Only as the selection moves.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ selectedBlockId ] );

	/*
	 * The row picked: the block selected inside a section, or the section
	 * picked when nothing in it is.
	 */
	const currentRow = rows.find( ( row ) => row.clientId === currentId );
	const selectedId =
		selectedBlockId &&
		( ! currentRow ||
			currentRow.isText ||
			selectedBlockId !== currentRow.clientId )
			? selectedBlockId
			: currentRow?.key;

	// Core moves focus into its list as it opens; ours stands in for it.
	useEffect( () => {
		const target =
			ref.current?.querySelector(
				'.is-selected .cnl-canvas-overview__select'
			) || ref.current?.querySelector( '.cnl-canvas-overview__select' );

		target?.focus();
		// Only as the list opens.
	}, [] );

	const groupProps = {
		expanded,
		layoutNoteId,
		nested,
		onPick,
		onEditPart,
		onPickBlock,
		onToggle: toggle,
		openPartId,
		selectedId,
	};

	return (
		<div className="cnl-canvas-overview" ref={ ref }>
			<VisuallyHidden id={ layoutNoteId }>
				{ __( 'Part of the layout', 'create-not-learn-editor' ) }
			</VisuallyHidden>
			{ header.length > 0 && (
				<OverviewGroup
					{ ...groupProps }
					label={ __( 'Header', 'create-not-learn-editor' ) }
					rows={ header }
				/>
			) }
			<OverviewGroup
				{ ...groupProps }
				label={ __( 'Content', 'create-not-learn-editor' ) }
				rows={ content }
			>
				<Button
					className="cnl-canvas-overview__add"
					icon={ plusIcon }
					onClick={ onAddSection }
					size="compact"
					variant="tertiary"
				>
					{ __( 'Add section', 'create-not-learn-editor' ) }
				</Button>
			</OverviewGroup>
			{ footer.length > 0 && (
				<OverviewGroup
					{ ...groupProps }
					label={ __( 'Footer', 'create-not-learn-editor' ) }
					rows={ footer }
				/>
			) }
		</div>
	);
}
