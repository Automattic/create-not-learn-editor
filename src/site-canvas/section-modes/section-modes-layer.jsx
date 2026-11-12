/**
 * Edit's section layer. A section is worked on a level at a time, a click
 * at a time:
 *
 * 1. A click anywhere on a section picks it: outlined, named, and with its
 *    bar of Add, Edit design and its moves, which stays while it is worked
 *    on.
 * 2. A click on a row of cards in it, like three services side by side,
 *    opens the row: its tools to add a card, remove one and set how many
 *    sit in a row. A click on anything not in a row skips this step.
 * 3. A click on a block in it reaches the block: the caret where the click
 *    landed in text, or a picture selected, with core's own tools.
 *
 * Escape steps back a level at a time. A double click goes straight to the
 * text. Only one section is worked on at a time.
 *
 * - Edit design turns the bar into the section's design choices, Layout,
 *   Colour, Width and More control, each drilled into in the same bar, and
 *   applied as soon as it is picked. More control is Freeform: core's own
 *   unlock, for core's full block tools, left with Done.
 * - A header or footer shows on every page, so its words aren't reached by
 *   clicking: until it is opened it is locked. Edit header or Edit
 *   footer, alone on its bar, opens it, in the spotlight, for its words and
 *   pictures only, with Edit design's bar under it, left with Done.
 * - What the page's layout puts around its sections that the page can
 *   change, like its title and featured image, is picked and clicked into
 *   as a section is, dashed and named as part of the layout, with no bar.
 *   See `layout-items.js`.
 *
 * Internally, a section whose blocks are reached is in "Edit content".
 *
 * Compose uses the same layer over the editor zoomed out. Sections are
 * dragged there to reorder them, and their layouts, colours and place on
 * the page change without leaving. Anything else goes back to Edit to do it.
 *
 * Each container on a page is a section, and each run of plain blocks
 * between them, like paragraphs and headings, one section of text, so a page
 * that is mostly words isn't a section for every paragraph. Writing, like a
 * post, is edited without the layer, and only arranged with it, in Compose,
 * where its text is grouped the same way. See `writing-mode.js`.
 *
 * Drawn inside the editor's content region, as core's own toolbars are, so
 * it sits under core's block toolbars. Changes go to the editor's blocks, so
 * they are undone like any other edit.
 */

/**
 * WordPress dependencies
 */
import { createPortal, Fragment } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { GlobalScope } from '../../global-scope';
import { openSectionPicker } from '../../editor-layer/section-picker';
import { unlock } from '../../lock-unlock';
import {
	blockEditorStore,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useRegistry,
	useSelect,
	useState,
} from '../../wordpress-packages';
import { scrollCanvasTo, useBlockRects } from '../compose/use-block-rects';
import { useComposeStructure } from '../compose/use-compose-structure';
import { afterZoomIn, whenZoomSettles } from '../compose/use-compose-zoom';
import {
	PART_CONTENT,
	PART_FREEFORM,
	setOpenPart,
	setPickedSection as setSharedPickedSection,
} from '../mode';
import { useCanvasDocument } from '../use-canvas-document';
import { useCanvasStyles } from '../use-canvas-styles';
import { getBlockIndex } from '../writing-mode';
import { EmptyPage } from './empty-page';
import { useLayoutName } from './layout-items';
import { RemoveControl } from './remove-control';
import { getParentView } from './design-bar';
import {
	LayoutScope,
	MODE_CONTENT,
	MODE_FREEFORM,
	MODE_DESIGN,
} from './section-chrome';
import { PostsNotice } from './posts-notice';
import { usePostsSection } from './posts-section';
import { getTargetOf, useCanvasHover } from './use-canvas-events';
import { useSectionDrag } from './use-section-drag';
import { useSectionItems } from './use-section-items';
import { getBlocksBeside, INSET, isAtPageEdge, local } from './placement';
import { EMPTY_SPACE, getCanvasCss } from './canvas-css';
import { RowHandles } from './row-handles';
import { useRowActions, useSectionRows } from './use-section-rows';
import {
	STYLE_ID,
	INLINE_ADD_GAP,
	INLINE_ADD_HEIGHT,
	EMPTY_ARRAY,
} from './layer-constants';
import { getLayerTitle, mergeRunRects, useContentHost } from './layer-helpers';
import { useGroupedSections } from './use-grouped-sections';
import { useSectionClicks } from './use-section-clicks';
import { useModeSync } from './use-mode-sync';
import { usePostsTripBack } from './use-posts-trip-back';
import { useLayerEffects } from './use-layer-effects';
import { getSectionActions } from './section-actions';
import { InlineAdd } from './inline-add';
import { HoverChrome } from './hover-chrome';
import { PickedChrome } from './picked-chrome';
import { DragChrome } from './drag-chrome';
import { ActiveChrome } from './active-chrome';

/**
 * @param {Object}   props
 * @param {Object}   props.editorRef     Ref to the editor's container.
 * @param {Object}   props.entity        `{ postType, postId }`, what the
 *                                       editor has open.
 * @param {?string}  props.focusId       The one section, header or footer a
 *                                       canvas about it works on, like the
 *                                       Header screen's. Only it can be
 *                                       pointed at, picked and edited, and
 *                                       it starts picked, so its bar shows
 *                                       straight away.
 * @param {boolean}  props.isComposing   Whether the canvas is in Compose,
 *                                       zoomed out: the same controls, with
 *                                       sections dragged to move them, and
 *                                       anything but a section's layout,
 *                                       colours or place on the page done
 *                                       back in Edit.
 * @param {boolean}  props.hasSections   Whether what is edited is built from
 *                                       sections, as a page is. Without,
 *                                       like a layout or a post, the layer
 *                                       only opens its template parts, and
 *                                       every other click reaches the
 *                                       blocks, as core's editor has them.
 * @param {Function} props.onExitCompose Leaves Compose for Edit.
 * @return {?Element} The layer.
 */
export function SectionModesLayer( {
	editorRef,
	entity,
	focusId = null,
	hasSections = true,
	isComposing = false,
	onExitCompose,
} ) {
	const registry = useRegistry();
	const layerRef = useRef();
	const host = useContentHost( editorRef );
	const structure = useComposeStructure( { hasSections } );
	const { layoutItems, parts, rootClientId } = structure;
	/*
	 * Without sections, only the template parts are the layer's: a click
	 * anywhere else reaches the blocks, and what core selects there stays
	 * selected. A canvas about one part keeps the rest of the page out of
	 * reach, as it does on a page.
	 */
	const passesOtherClicks = ! hasSections && ! focusId;
	const layoutName = useLayoutName( layoutItems.length > 0 );
	const {
		groupedSections,
		sectionIds,
		groupedById,
		getMembers,
		isTextSection,
	} = useGroupedSections( { focusId, hasSections, structure } );
	const items = useSectionItems();
	const rowActions = useRowActions();
	// `{ id, mode, view }` for the section in a mode, `view` being the
	// design choice drilled into in Edit design.
	const [ active, setActive ] = useState( null );
	const [ menuOpenFor, setMenuOpenFor ] = useState( null );
	// The section picked, by a click or by leaving a mode, shown as if it
	// were pointed at while nothing else is.
	const [ pickedSection, setPickedSection ] = useState( null );
	const pickedRef = useRef( pickedSection );
	// The row of cards open in the section, the second level in.
	const [ activeRowId, setActiveRowId ] = useState( null );
	const activeRowRef = useRef( activeRowId );
	// The rows in the section picked, read by the click handlers.
	const rowsRef = useRef( EMPTY_ARRAY );
	const [ freshId, setFreshId ] = useState( null );
	const [ chromeNode, setChromeNode ] = useState( null );
	const [ chromeSize, setChromeSize ] = useState( null );
	// `{ index }` of the gap a section is being added to in place, among
	// the sections.
	const [ inlineAdd, setInlineAdd ] = useState( null );
	const [ inlineAddNode, setInlineAddNode ] = useState( null );
	const [ inlineAddHeight, setInlineAddHeight ] = useState( null );
	const activeRef = useRef( active );

	activeRef.current = active;
	pickedRef.current = pickedSection;
	activeRowRef.current = activeRowId;

	const partsById = useMemo(
		() =>
			Object.fromEntries(
				parts.map( ( part ) => [ part.clientId, part ] )
			),
		[ parts ]
	);
	const layoutItemsById = useMemo(
		() =>
			Object.fromEntries(
				layoutItems.map( ( item ) => [ item.clientId, item ] )
			),
		[ layoutItems ]
	);
	// The section at the very top of the page, whose name goes under it.
	const pageTopId = useSelect(
		( select ) =>
			[ ...parts.map( ( part ) => part.clientId ), ...sectionIds ].find(
				( clientId ) => isAtPageEdge( select, clientId, false )
			) ?? null,
		[ parts, sectionIds ]
	);
	const targets = useMemo(
		() =>
			new Set(
				focusId
					? [ focusId ]
					: [
							...sectionIds,
							...parts.map( ( part ) => part.clientId ),
							...layoutItems.map( ( item ) => item.clientId ),
						]
			),
		[ focusId, layoutItems, parts, sectionIds ]
	);
	// Every block of the runs of text, which stand for their run.
	const memberTargets = useMemo(
		() =>
			groupedSections
				? new Set( [
						...targets,
						...groupedSections.flatMap(
							( section ) => section.clientIds
						),
					] )
				: targets,
		[ targets, groupedSections ]
	);
	const findTarget = useCallback(
		( clientId ) => {
			const target = getTargetOf(
				registry.select( blockEditorStore ),
				memberTargets,
				clientId
			);

			return (
				groupedSections?.find( ( section ) =>
					section.clientIds.includes( target )
				)?.clientIds[ 0 ] ?? target
			);
		},
		[ memberTargets, registry, groupedSections ]
	);

	const exitMode = useCallback( () => {
		const store = unlock( registry.select( blockEditorStore ) );
		const actions = unlock( registry.dispatch( blockEditorStore ) );

		if ( store.getEditedContentOnlySection() ) {
			actions.stopEditingContentOnlySection();
		}

		actions.clearSelectedBlock();
		// The section stays picked, ready for the other mode.
		setPickedSection( activeRef.current?.id ?? null );
		setActive( null );
	}, [ registry ] );

	const enterMode = useCallback(
		( clientId, mode ) => {
			const store = unlock( registry.select( blockEditorStore ) );
			const actions = unlock( registry.dispatch( blockEditorStore ) );
			const part = partsById[ clientId ];

			if ( store.getEditedContentOnlySection() ) {
				actions.stopEditingContentOnlySection();
			}

			actions.clearSelectedBlock();

			// A header's or footer's blocks can't be changed until core opens
			// it, for their words and images only.
			if ( part && mode === MODE_CONTENT ) {
				setOpenPart( clientId, PART_CONTENT );
				actions.editContentOnlySection( clientId );
			}

			setMenuOpenFor( null );
			setInlineAdd( null );
			setActive( { id: clientId, mode, view: null } );
		},
		[ partsById, registry ]
	);

	// Composing, anything but a section's layout, colours or place on the
	// page is done in Edit: Compose zooms back in first, then does it.
	const leaveCompose = ( then = () => {} ) => {
		if ( ! isComposing ) {
			then();
			return;
		}

		afterZoomIn( () => then() );
		onExitCompose();
	};

	// Compose's Edit content: back into Edit with the section picked, as a
	// click there picks it, and in view, as the page moves as it zooms in.
	const zoomInTo = ( clientId ) => {
		setMenuOpenFor( null );
		setInlineAdd( null );
		setActiveRowId( null );
		setPickedSection( clientId );
		leaveCompose( () =>
			whenZoomSettles( editorRef, () =>
				scrollCanvasTo( editorRef, clientId )
			)
		);
	};

	// From Edit design's More control into Freeform, which Done, Escape or a
	// click elsewhere leaves, as Edit content.
	const enterFreeform = useCallback( () => {
		const actions = unlock( registry.dispatch( blockEditorStore ) );
		const { id } = activeRef.current;

		actions.clearSelectedBlock();

		// A header or footer opens completely, as a section does.
		if ( partsById[ id ] ) {
			setOpenPart( id, PART_FREEFORM );
		}

		actions.editContentOnlySection( id );
		setActive( ( current ) => ( {
			...current,
			mode: MODE_FREEFORM,
			view: null,
		} ) );
	}, [ partsById, registry ] );

	// The design choice drilled into in Edit design's bar, or null for the
	// choices. In an open header or footer, a block picked in it lets go,
	// so its own tools, like a link's, don't sit over the choice.
	const setDesignView = useCallback(
		( view ) => {
			if ( view && partsById[ activeRef.current?.id ] ) {
				registry.dispatch( blockEditorStore ).clearSelectedBlock();
			}

			setActive( ( current ) => current && { ...current, view } );
		},
		[ partsById, registry ]
	);

	// Escape leaves the mode, or steps back from a design choice to the
	// choices, in Edit design or an open header or footer.
	const escapeMode = useCallback( () => {
		if ( activeRef.current?.view ) {
			setDesignView( getParentView( activeRef.current.view ) );
		} else {
			exitMode();
		}
	}, [ exitMode, setDesignView ] );

	// One for both, so a section never lights up before its clicks are
	// kept off the page.
	const canvasDocument = useCanvasDocument( editorRef );
	const { hold, hoveredId, release } = useCanvasHover( {
		canvasDocument,
		findTarget,
		isActive: true,
	} );

	const { isOpen, getRowOf, focusSoon } = useSectionClicks( {
		activeRef,
		activeRowRef,
		canvasDocument,
		editorRef,
		enterMode,
		escapeMode,
		exitMode,
		findTarget,
		inlineAdd,
		isComposing,
		leaveCompose,
		onExitCompose,
		partsById,
		passesOtherClicks,
		pickedRef,
		pickedSection,
		registry,
		rowsRef,
		setActiveRowId,
		setInlineAdd,
		setPickedSection,
	} );

	const { editedSection, exists, selectedId } = useSelect(
		( select ) => {
			const store = unlock( select( blockEditorStore ) );

			return {
				editedSection: store.getEditedContentOnlySection(),
				exists: active
					? Boolean( store.getBlockName( active.id ) )
					: true,
				selectedId: store.getSelectedBlockClientId(),
			};
		},
		[ active ]
	);
	/*
	 * A run of text is known by its first block, which changes as blocks are
	 * typed in or taken out at its start, so the run open or picked follows
	 * along, before anything reads it. A run open whose first block went
	 * follows the block being typed in.
	 */
	const getRunOf = ( clientId ) =>
		groupedSections?.find( ( section ) =>
			section.clientIds.includes( clientId )
		)?.clientIds[ 0 ];
	const activeRun =
		active &&
		( getRunOf( active.id ) ??
			( ! exists && active.mode === MODE_CONTENT
				? getRunOf( selectedId )
				: null ) );
	const pickedRun = pickedSection && getRunOf( pickedSection );

	if ( activeRun && activeRun !== active.id ) {
		setActive( { ...active, id: activeRun } );
	}

	if ( pickedRun && pickedRun !== pickedSection ) {
		setPickedSection( pickedRun );
	}

	const activePart = active ? partsById[ active.id ] : null;

	useModeSync( {
		active,
		activePart,
		activeRef,
		editedSection,
		editorRef,
		enterMode,
		exists,
		exitMode,
		findTarget,
		groupedById,
		isComposing,
		isOpen,
		isTextSection,
		parts,
		passesOtherClicks,
		registry,
		selectedId,
		setActive,
		setPickedSection,
		targets,
	} );

	// In Edit content, a block of the section selected can be removed from
	// core's toolbar; Restore on the small bar puts it back. A run of text's
	// blocks aren't locked, so core's toolbar removes them itself.
	const canRemoveSelected =
		active?.mode === MODE_CONTENT &&
		! isTextSection( active.id ) &&
		Boolean( selectedId ) &&
		selectedId !== active.id &&
		findTarget( selectedId ) === active.id;

	// A canvas about one section keeps it picked while nothing else is.
	const picked = pickedSection || focusId;
	// A section whose blocks are reached is still picked, its bar kept.
	const isWorkedOn =
		active?.mode === MODE_CONTENT && ! partsById[ active.id ];
	const pickedId =
		( isWorkedOn && active.id ) ||
		( ! active && picked && targets.has( picked ) ? picked : null );
	// The section picked or in a mode, shared so code outside the canvas can
	// read it. A header or footer isn't one.
	const pickedOrActiveId = active?.id || pickedId;
	const sharedSectionId =
		sectionIds.includes( pickedOrActiveId ) &&
		! isTextSection( pickedOrActiveId )
			? pickedOrActiveId
			: null;
	useEffect( () => {
		setSharedPickedSection( sharedSectionId );
	}, [ sharedSectionId ] );
	useEffect( () => () => setSharedPickedSection( null ), [] );

	const pointedId = hoveredId || null;
	const shownHoverId =
		menuOpenFor ||
		( pointedId && pointedId !== active?.id ? pointedId : null ) ||
		pickedId;
	const hoverPosts = usePostsSection(
		shownHoverId &&
			! partsById[ shownHoverId ] &&
			! layoutItemsById[ shownHoverId ]
			? shownHoverId
			: null
	);

	const { postsNotice, setPostsNotice, goToPosts, editPosts } =
		usePostsTripBack( {
			editorRef,
			entity,
			registry,
			sectionIds,
			setPickedSection,
		} );

	const isEmpty =
		hasSections &&
		! focusId &&
		Boolean( rootClientId ) &&
		sectionIds.length === 0;

	/*
	 * The section whose rows of cards can be opened: the one picked, or
	 * worked on. Not a header or footer, nor a section in Edit design or
	 * Freeform, which have their own tools, nor while composing.
	 */
	const rowsSectionId =
		! isComposing &&
		pickedId &&
		! partsById[ pickedId ] &&
		! layoutItemsById[ pickedId ]
			? pickedId
			: null;

	const rows = useSectionRows( rowsSectionId );
	rowsRef.current = rows;

	// Working on a section's blocks, the row of cards open follows the
	// block selected, as a click outside the rows still reaches the page.
	useEffect( () => {
		if ( active?.mode !== MODE_CONTENT || ! selectedId ) {
			return;
		}

		const row = getRowOf( selectedId );

		if ( row !== activeRowRef.current ) {
			setActiveRowId( row );
		}
		// `getRowOf` reads the rows from their ref, set as they are.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ active?.mode, rows, selectedId ] );
	const openRowId = rows.some( ( row ) => row.clientId === activeRowId )
		? activeRowId
		: null;
	const rowIds = useMemo(
		() => rows.flatMap( ( row ) => [ row.clientId, ...row.itemIds ] ),
		[ rows ]
	);

	const measuredIds = useMemo(
		() => [
			...( rootClientId ? [ rootClientId ] : EMPTY_ARRAY ),
			...memberTargets,
			...( freshId ? [ freshId ] : EMPTY_ARRAY ),
			...rowIds,
		],
		[ freshId, memberTargets, rootClientId, rowIds ]
	);
	const { frame, rects: blockRects } = useBlockRects( {
		clientIds: measuredIds,
		editorRef,
		isActive: true,
		layerRef,
	} );
	// A run of text is drawn round all of its blocks, under its first's ID.
	const rects = useMemo(
		() => mergeRunRects( blockRects, groupedSections ),
		[ blockRects, groupedSections ]
	);

	const { moveBlocksToPosition } = useDispatch( blockEditorStore );

	// Move a section to a new place among the sections.
	const moveSectionTo = ( clientId, to ) => {
		const from = sectionIds.indexOf( clientId );

		moveBlocksToPosition(
			getMembers( clientId ),
			rootClientId || '',
			rootClientId || '',
			groupedSections ? getBlockIndex( groupedSections, from, to ) : to
		);
	};

	// Where a section added at a place among the sections goes among the
	// blocks.
	const getInsertIndex = ( index ) =>
		groupedSections ? getBlockIndex( groupedSections, -1, index ) : index;

	const drag = useSectionDrag( {
		canvasDocument,
		getLatest: () => ( { findTarget, frame, rects, sectionIds } ),
		isActive: isComposing && ! active,
		onDrop: moveSectionTo,
	} );

	const draggedBlocks = useSelect(
		( select ) =>
			drag
				? select( blockEditorStore )
						.getBlocksByClientId( getMembers( drag.clientId ) )
						.filter( Boolean )
				: null,
		// `getMembers` reads the sections, as `groupedById` holds them.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[ drag?.clientId, groupedById ]
	);
	const draggedBlock = draggedBlocks?.length ? draggedBlocks : null;

	/*
	 * The sections locked to their content, which take no new block but a
	 * line of text: not one core has opened, nor a blank section or a run of
	 * text, which take any. Joined, so the selector returns a value that only
	 * changes when they do.
	 */
	const lockedKey = useSelect(
		( select ) => {
			const { getTemplateLock } = select( blockEditorStore );

			return sectionIds
				.filter(
					( clientId ) =>
						clientId !== editedSection &&
						getTemplateLock( clientId ) === 'contentOnly'
				)
				.join();
		},
		[ editedSection, sectionIds ]
	);
	const lockedIds = useMemo(
		() => ( lockedKey ? lockedKey.split( ',' ) : EMPTY_ARRAY ),
		[ lockedKey ]
	);

	const openId = active && active.mode !== MODE_DESIGN ? active.id : null;
	// Joined, so the selector returns a value that only changes when they do.
	const fadedIds = useSelect(
		( select ) =>
			openId && editedSection === openId
				? getBlocksBeside( select, openId ).join()
				: '',
		[ editedSection, openId ]
	);

	// The section the gap for adding in place opens before, or after at the
	// end of the page.
	const inlineAddPlace = useMemo( () => {
		if ( ! inlineAdd || drag ) {
			return null;
		}

		const next = sectionIds[ inlineAdd.index ];
		const previous = sectionIds[ inlineAdd.index - 1 ];

		if ( next ) {
			return { clientId: next, isAfter: false };
		}

		// After a run of text, the gap opens after its last block.
		return previous
			? { clientId: getMembers( previous ).at( -1 ), isAfter: true }
			: null;
		// `getMembers` reads the sections, as `groupedById` holds them.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ drag, inlineAdd, sectionIds, groupedById ] );

	useCanvasStyles(
		STYLE_ID,
		getCanvasCss(
			openId ? getMembers( openId ) : EMPTY_ARRAY,
			rootClientId,
			isEmpty,
			isComposing && ( drag ? 'dragging' : 'grab' ),
			fadedIds ? fadedIds.split( ',' ) : EMPTY_ARRAY,
			inlineAddPlace && {
				...inlineAddPlace,
				height:
					( inlineAddHeight ?? INLINE_ADD_HEIGHT ) +
					INLINE_ADD_GAP * 2,
			},
			lockedIds
		)
	);

	useLayerEffects( {
		active,
		activePart,
		activeRowRef,
		canvasDocument,
		chromeNode,
		drag,
		editorRef,
		escapeMode,
		exitMode,
		focusId,
		freshId,
		host,
		inlineAdd,
		inlineAddNode,
		isComposing,
		layerRef,
		lockedIds,
		onExitCompose,
		pickedSection,
		sectionIds,
		setActiveRowId,
		setChromeSize,
		setFreshId,
		setInlineAdd,
		setInlineAddHeight,
		setPickedSection,
	} );

	const getTitle = ( clientId ) =>
		getLayerTitle( registry, clientId, {
			isTextSection,
			layoutItemsById,
			partsById,
		} );

	const {
		addItem,
		startBlank,
		deleteSection,
		moveSection,
		addRowItem,
		removeRowItem,
		onLayoutReplace,
		openInlineAdd,
		inlineAddActions,
	} = getSectionActions( {
		active,
		activeRowId,
		editorRef,
		enterMode,
		focusSoon,
		getInsertIndex,
		getMembers,
		getTitle,
		groupedSections,
		inlineAdd,
		isTextSection,
		items,
		leaveCompose,
		moveSectionTo,
		registry,
		release,
		rootClientId,
		rowActions,
		sectionIds,
		setActive,
		setActiveRowId,
		setFreshId,
		setInlineAdd,
		setMenuOpenFor,
	} );

	if ( ! host ) {
		return null;
	}

	/*
	 * Purple for a header or footer, which every page shares. Grey and dashed
	 * for a layout item, which the page's layout places.
	 */
	const getScope = ( clientId ) => {
		if ( partsById[ clientId ] ) {
			return GlobalScope;
		}

		return layoutItemsById[ clientId ] ? LayoutScope : Fragment;
	};

	/*
	 * A tab hangs under the section at the page's top, with nothing above to
	 * sit on, and under a layout item while its block is reached, as core's
	 * toolbar for the block sits over its top edge.
	 */
	const hangsTabBelow = ( clientId ) =>
		clientId === pageTopId ||
		( isWorkedOn &&
			clientId === active.id &&
			Boolean( layoutItemsById[ clientId ] ) );

	const freshRect = freshId && frame && rects[ freshId ];
	const getLevel = () => {
		if ( isWorkedOn ) {
			return 'blocks';
		}

		if ( openRowId ) {
			return 'cards';
		}

		return pickedId ? 'section' : 'none';
	};

	const layer = createPortal(
		<div
			className="cnl-section-modes"
			// How far into the section picked the clicks have gone.
			data-level={ getLevel() }
			onKeyDown={ ( event ) => {
				if ( event.key === 'Escape' && inlineAdd ) {
					event.stopPropagation();
					setInlineAdd( null );
				} else if ( event.key === 'Escape' && active ) {
					event.stopPropagation();
					escapeMode();
				} else if ( event.key === 'Escape' && activeRowId ) {
					event.stopPropagation();
					setActiveRowId( null );
				} else if ( event.key === 'Escape' && pickedSection ) {
					event.stopPropagation();
					setPickedSection( null );
				}
			} }
			ref={ layerRef }
			role="presentation"
		>
			{ frame && (
				<div className="cnl-section-modes__clip" style={ frame }>
					{ isEmpty && rects[ rootClientId ] && (
						<EmptyPage
							onAddSection={ () =>
								openSectionPicker( {
									index: 0,
									onStartBlank: () => startBlank(),
									rootClientId,
								} )
							}
							onStartBlank={ () => startBlank() }
							style={ {
								height: Math.max(
									rects[ rootClientId ].height - INSET * 2,
									EMPTY_SPACE - INSET * 2
								),
								left: INSET,
								top:
									rects[ rootClientId ].top -
									frame.top +
									INSET,
								width: frame.width - INSET * 2,
							} }
						/>
					) }
					<PickedChrome
						drag={ drag }
						frame={ frame }
						getScope={ getScope }
						getTitle={ getTitle }
						hangsTabBelow={ hangsTabBelow }
						layoutItemsById={ layoutItemsById }
						layoutName={ layoutName }
						partsById={ partsById }
						pickedId={ pickedId }
						rects={ rects }
						shownHoverId={ shownHoverId }
					/>
					{ /* Under the section being edited, so another section
					pointed at never covers its Done. */ }
					<HoverChrome
						active={ active }
						addItem={ addItem }
						deleteSection={ deleteSection }
						drag={ drag }
						editPosts={ editPosts }
						enterMode={ enterMode }
						frame={ frame }
						getMembers={ getMembers }
						getScope={ getScope }
						getTitle={ getTitle }
						hangsTabBelow={ hangsTabBelow }
						hold={ hold }
						hoverPosts={ hoverPosts }
						inlineAdd={ inlineAdd }
						isComposing={ isComposing }
						isTextSection={ isTextSection }
						layoutItemsById={ layoutItemsById }
						layoutName={ layoutName }
						leaveCompose={ leaveCompose }
						menuOpenFor={ menuOpenFor }
						moveSection={ moveSection }
						openInlineAdd={ openInlineAdd }
						partsById={ partsById }
						pickedId={ pickedId }
						rects={ rects }
						registry={ registry }
						release={ release }
						sectionIds={ sectionIds }
						setMenuOpenFor={ setMenuOpenFor }
						shownHoverId={ shownHoverId }
						zoomInTo={ zoomInTo }
					/>
					<InlineAdd
						frame={ frame }
						inlineAdd={ inlineAdd }
						inlineAddActions={ inlineAddActions }
						inlineAddHeight={ inlineAddHeight }
						inlineAddPlace={ inlineAddPlace }
						rects={ rects }
						sectionIds={ sectionIds }
						setInlineAddNode={ setInlineAddNode }
					/>
					<ActiveChrome
						active={ active }
						activePart={ activePart }
						chromeSize={ chromeSize }
						enterFreeform={ enterFreeform }
						exitMode={ exitMode }
						frame={ frame }
						getTitle={ getTitle }
						isWorkedOn={ isWorkedOn }
						items={ items }
						leaveCompose={ leaveCompose }
						onLayoutReplace={ onLayoutReplace }
						pageTopId={ pageTopId }
						rects={ rects }
						setChromeNode={ setChromeNode }
						setDesignView={ setDesignView }
					/>
					{ rowsSectionId && ! drag && rects[ rowsSectionId ] && (
						<RowHandles
							activeRowId={ openRowId }
							canvasDocument={ canvasDocument }
							frame={ frame }
							holdHover={ {
								onBlur: release,
								onFocus: () => hold( rowsSectionId ),
								onPointerEnter: () => hold( rowsSectionId ),
								onPointerLeave: release,
							} }
							onAdd={ addRowItem }
							onPerRow={ ( rowId, count ) => {
								const nextId = rowActions.setPerRow(
									rowId,
									count
								);

								if ( nextId && rowId === activeRowId ) {
									setActiveRowId( nextId );
								}
							} }
							onRemove={ removeRowItem }
							rects={ rects }
							rows={ rows }
							section={ local( rects[ rowsSectionId ], frame ) }
						/>
					) }
					<DragChrome
						drag={ drag }
						draggedBlock={ draggedBlock }
						frame={ frame }
						rects={ rects }
						sectionIds={ sectionIds }
					/>
					{ freshRect && (
						<div
							className="cnl-section-modes__fresh"
							style={ local( freshRect, frame ) }
						/>
					) }
				</div>
			) }
			{ canRemoveSelected && (
				<RemoveControl
					onRemove={ () => {
						registry
							.dispatch( blockEditorStore )
							.clearSelectedBlock();
						items.remove( active.id, selectedId );
					} }
				/>
			) }
		</div>,
		host
	);

	return (
		<>
			{ layer }
			{ /* Outside the layer, so its keys aren't the layer's. */ }
			{ postsNotice && (
				<PostsNotice
					label={ postsNotice.posts.label }
					type={ postsNotice.posts.name }
					onCancel={ () => setPostsNotice( null ) }
					onGo={ () =>
						goToPosts( postsNotice.clientId, postsNotice.posts )
					}
				/>
			) }
		</>
	);
}
