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
import { groupOverviewRows } from './overview-groups';
import {
	__,
	BlockIcon,
	blockEditorStore,
	Button,
	footerIcon,
	getBlockType,
	headerIcon,
	lockSmallIcon,
	plusIcon,
	Text,
	Tooltip,
	TreeGrid,
	TreeGridCell,
	TreeGridRow,
	useEffect,
	useId,
	useMemo,
	useRef,
	useSelect,
	useState,
	VisuallyHidden,
} from '../../wordpress-packages';

const EDITOR_STORE = 'core/editor';
const LIST_PANEL = '.editor-list-view-sidebar__list-view-panel-content';
const HOST_CLASS = 'cnl-canvas-overview-host';
const PART_ICONS = { footer: footerIcon, header: headerIcon };

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
							? 'core/paragraph'
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
								getBlockType( name )?.icon,
							isLayoutItem: Boolean(
								layoutItemsById[ clientId ]
							),
							isPart: Boolean( partsById[ clientId ] ),
							title,
						};
					} )
				: [],
		[ layoutItemsById, partsById, rowsKey ]
	);
}

/**
 * One row, as the list view draws its rows.
 *
 * @param {Object}   props
 * @param {Object}   props.row          The row.
 * @param {boolean}  props.isCurrent    Whether it is picked on the canvas.
 * @param {number}   props.index        Its place in its group, from 1.
 * @param {number}   props.count        How many rows its group has.
 * @param {Function} props.onPick       Picks it on the canvas.
 * @param {string}   props.layoutNoteId ID of the layout items' note.
 * @return {Element} The row.
 */
function OverviewRow( { row, isCurrent, index, count, onPick, layoutNoteId } ) {
	return (
		<TreeGridRow
			aria-selected={ isCurrent }
			className={ [
				'cnl-canvas-overview__row',
				isCurrent && 'is-selected',
				( row.isPart || row.isLayoutItem ) && 'is-global',
			]
				.filter( Boolean )
				.join( ' ' ) }
			level={ 1 }
			positionInSet={ index }
			setSize={ count }
		>
			<TreeGridCell>
				{ ( cellProps ) => (
					<button
						{ ...cellProps }
						aria-describedby={
							row.isLayoutItem ? layoutNoteId : undefined
						}
						className="cnl-canvas-overview__select"
						onClick={ () => onPick( row.clientId ) }
						type="button"
					>
						<BlockIcon icon={ row.icon } />
						<span className="cnl-canvas-overview__title">
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
									{ __( 'Part of the layout' ) }
								</Tooltip.Popup>
							</Tooltip.Root>
						) }
					</button>
				) }
			</TreeGridCell>
		</TreeGridRow>
	);
}

/**
 * A group of rows under its heading.
 *
 * @param {Object}   props
 * @param {string}   props.label        The group's heading.
 * @param {Array}    props.rows         Its rows.
 * @param {?string}  props.currentId    The block picked on the canvas.
 * @param {Function} props.onPick       Picks a block on the canvas.
 * @param {string}   props.layoutNoteId ID of the layout items' note.
 * @param {?Element} props.children     Shown below the rows.
 * @return {Element} The group.
 */
function OverviewGroup( {
	label,
	rows,
	currentId,
	onPick,
	layoutNoteId,
	children,
} ) {
	const headingId = useId();

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
					className="cnl-canvas-overview__tree"
				>
					{ rows.map( ( row, index ) => (
						<OverviewRow
							count={ rows.length }
							index={ index + 1 }
							isCurrent={ row.clientId === currentId }
							key={ row.clientId }
							layoutNoteId={ layoutNoteId }
							onPick={ onPick }
							row={ row }
						/>
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
	getTitle,
	isTextSection,
	layoutItemsById,
	onAddSection,
	onPick,
	partsById,
	sectionIds,
} ) {
	const ref = useRef();
	const layoutNoteId = useId();
	const rows = useOverviewRows( {
		getTitle,
		isTextSection,
		layoutItemsById,
		partsById,
		sectionIds,
	} );
	const { header, content, footer } = groupOverviewRows( rows );

	// Core moves focus into its list as it opens; ours stands in for it.
	useEffect( () => {
		const target =
			ref.current?.querySelector(
				'.is-selected .cnl-canvas-overview__select'
			) || ref.current?.querySelector( '.cnl-canvas-overview__select' );

		target?.focus();
		// Only as the list opens.
	}, [] );

	const groupProps = { currentId, layoutNoteId, onPick };

	return (
		<div className="cnl-canvas-overview" ref={ ref }>
			<VisuallyHidden id={ layoutNoteId }>
				{ __( 'Part of the layout' ) }
			</VisuallyHidden>
			{ header.length > 0 && (
				<OverviewGroup
					{ ...groupProps }
					label={ __( 'Header' ) }
					rows={ header }
				/>
			) }
			<OverviewGroup
				{ ...groupProps }
				label={ __( 'Content' ) }
				rows={ content }
			>
				<Button
					className="cnl-canvas-overview__add"
					icon={ plusIcon }
					onClick={ onAddSection }
					size="compact"
					variant="tertiary"
				>
					{ __( 'Add section' ) }
				</Button>
			</OverviewGroup>
			{ footer.length > 0 && (
				<OverviewGroup
					{ ...groupProps }
					label={ __( 'Footer' ) }
					rows={ footer }
				/>
			) }
		</div>
	);
}
