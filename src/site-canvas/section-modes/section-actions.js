/**
 * What the section layer's bars and buttons do to the page.
 */

/**
 * WordPress dependencies
 */

/**
 * Internal dependencies
 */
import {
	addPatternSection,
	openSectionPicker,
} from '../../editor-layer/section-picker';
import {
	__,
	blockEditorStore,
	coreDataStore,
	noticesStore,
	sprintf,
} from '../../wordpress-packages';
import { scrollCanvasTo } from '../compose/use-block-rects';
import { createBlankSection } from '../../section-picker';
import { MODE_CONTENT, MODE_DESIGN } from './section-chrome';

// Takes the layer's state and actions it needs, by name.
export function getSectionActions( {
	active,
	activeRowId,
	editorRef,
	enterMode,
	exitMode,
	focusSoon,
	getInsertIndex,
	getMembers,
	getTitle,
	groupedSections,
	inlineAdd,
	isTextSection,
	items,
	layoutItemsById,
	leaveCompose,
	moveSectionTo,
	partsById,
	pickedSection,
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
	setPickedSection,
} ) {
	// Add a block to the end of a section, and open it in Edit content with
	// the caret in the new block, or the new picture selected. A run of text
	// takes it after its last block, as one more of its own.
	const addItem = ( ownerId, type, media ) => {
		const isText = isTextSection( ownerId );
		const added = items.add(
			isText ? getMembers( ownerId ).at( -1 ) : ownerId,
			type,
			media
		);

		if ( ! added ) {
			return;
		}

		setFreshId( added.blockId );
		enterMode( isText ? ownerId : added.sectionId, MODE_CONTENT );

		if ( type === 'image' ) {
			registry.dispatch( blockEditorStore ).selectBlock( added.blockId );
			return;
		}

		registry
			.dispatch( blockEditorStore )
			.selectBlock( added.editableId, 0 );
		focusSoon( added.editableId );
	};

	// A blank section, opened in Edit content with the caret in its text.
	const startBlank = ( index = 0 ) => {
		const section = createBlankSection();

		registry
			.dispatch( blockEditorStore )
			.insertBlocks( [ section ], index, rootClientId, false );
		enterMode( section.clientId, MODE_CONTENT );

		const paragraphId = section.innerBlocks[ 0 ].clientId;

		registry.dispatch( blockEditorStore ).selectBlock( paragraphId, 0 );
		focusSoon( paragraphId );
	};

	const deleteSection = ( clientId ) => {
		const title = getTitle( clientId );

		registry
			.dispatch( blockEditorStore )
			.removeBlocks( getMembers( clientId ), false );
		release();
		registry.dispatch( noticesStore ).createSuccessNotice(
			sprintf(
				/* translators: %s: section name. */
				__( '“%s” deleted.', 'create-not-learn-editor' ),
				title
			),
			{
				actions: [
					{
						label: __( 'Undo', 'create-not-learn-editor' ),
						onClick: () =>
							registry.dispatch( coreDataStore ).undo(),
					},
				],
				id: 'cnl-section-modes-deleted',
				type: 'snackbar',
			}
		);
	};

	const moveSection = ( clientId, direction ) => {
		const actions = registry.dispatch( blockEditorStore );

		// Past a whole run of text, or a whole run past a section.
		if ( groupedSections ) {
			moveSectionTo(
				clientId,
				sectionIds.indexOf( clientId ) + direction
			);
		} else if ( direction < 0 ) {
			actions.moveBlocksUp( [ clientId ], rootClientId || '' );
		} else {
			actions.moveBlocksDown( [ clientId ], rootClientId || '' );
		}

		window.requestAnimationFrame( () =>
			scrollCanvasTo( editorRef, clientId )
		);
	};

	// A copy of a row's card added after it, highlighted a moment. A grid
	// that grows to take it has a new client ID.
	const addRowItem = ( rowId, index, options ) => {
		const added = rowActions.addItem( rowId, index, options );

		if ( ! added ) {
			return;
		}

		setFreshId( added.addedId );

		if ( rowId === activeRowId ) {
			setActiveRowId( added.rowId );
		}
	};

	const removeRowItem = ( rowId, index ) => {
		registry.dispatch( blockEditorStore ).clearSelectedBlock();
		rowActions.removeItem( rowId, index );
	};

	const onLayoutReplace = ( next ) => {
		items.rename( active.id, next.clientId );
		setActive( ( current ) => ( { ...current, id: next.clientId } ) );
	};

	// Adding a section in place, in a gap opened where it goes, rather than
	// in the modal, which "View all sections" opens for the same gap.
	const openInlineAdd = ( index ) => {
		setMenuOpenFor( null );
		setInlineAdd( { index } );
	};

	const inlineAddActions = {
		onClose: () => setInlineAdd( null ),
		onPick: ( pattern ) => {
			setInlineAdd( null );
			addPatternSection( registry, pattern, {
				index: getInsertIndex( inlineAdd.index ),
				rootClientId: rootClientId || '',
			} );
		},
		// Typed into straight away, which is done in Edit.
		onStartBlank: () => {
			const index = getInsertIndex( inlineAdd.index );

			setInlineAdd( null );
			leaveCompose( () => startBlank( index ) );
		},
		onViewAll: () => {
			const index = getInsertIndex( inlineAdd.index );

			setInlineAdd( null );
			openSectionPicker( {
				index,
				onStartBlank: () => leaveCompose( () => startBlank( index ) ),
				rootClientId: rootClientId || '',
			} );
		},
	};

	/*
	 * Document Overview's list, whose rows pick on the canvas as a click
	 * there does, and whose Add section adds at the end of the page, in
	 * place, as the canvas's own Add does.
	 */
	const overviewProps = {
		currentId: active?.id ?? pickedSection,
		editorRef,
		getMembers,
		getTitle,
		isTextSection,
		layoutItemsById,
		// The header or footer opened with Edit header or Edit footer, the
		// only time its blocks are listed.
		openPartId:
			active && partsById[ active.id ] && active.mode !== MODE_DESIGN
				? active.id
				: null,
		partsById,
		sectionIds,
		onAddSection: () => {
			if ( active ) {
				exitMode();
			}

			setPickedSection( null );

			if ( sectionIds.length ) {
				openInlineAdd( sectionIds.length );
				return;
			}

			openSectionPicker( {
				index: 0,
				onStartBlank: () => leaveCompose( () => startBlank() ),
				rootClientId: rootClientId || '',
			} );
		},
		onPick: ( clientId ) => {
			// The section a block was picked in steps back out to the section,
			// as the toolbar's parent selector does. An open header or footer
			// stays open, with nothing in it selected.
			if ( active?.id === clientId && partsById[ clientId ] ) {
				registry.dispatch( blockEditorStore ).clearSelectedBlock();
			} else if ( active ) {
				exitMode();
			}

			setInlineAdd( null );
			setActiveRowId( null );
			setPickedSection( clientId );
			scrollCanvasTo( editorRef, clientId );
		},
		// A header or footer's edit button in Layers: opened, as Edit header
		// or Edit footer opens it.
		onEditPart: ( clientId ) =>
			leaveCompose( () => {
				setInlineAdd( null );
				setActiveRowId( null );
				enterMode( clientId, MODE_CONTENT );
				scrollCanvasTo( editorRef, clientId );
			} ),
		// A block inside a section, picked in Layers: into the section, as
		// a double click on the block does, with the block selected and the
		// focus left in the list, as core's list view leaves it.
		onPickBlock: ( sectionId, clientId ) => {
			const select = () => {
				registry
					.dispatch( blockEditorStore )
					.selectBlock( clientId, null );
				scrollCanvasTo( editorRef, clientId );
			};

			setInlineAdd( null );

			if ( active?.id === sectionId && active.mode !== MODE_DESIGN ) {
				select();
				return;
			}

			leaveCompose( () => {
				setActiveRowId( null );
				enterMode( sectionId, MODE_CONTENT );

				// Once the section takes clicks, and core has opened it.
				window.requestAnimationFrame( () =>
					window.requestAnimationFrame( select )
				);
			} );
		},
	};

	return {
		addItem,
		startBlank,
		deleteSection,
		moveSection,
		addRowItem,
		removeRowItem,
		onLayoutReplace,
		openInlineAdd,
		inlineAddActions,
		overviewProps,
	};
}
