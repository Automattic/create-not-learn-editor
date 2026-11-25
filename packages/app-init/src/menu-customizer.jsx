/**
 * Customize sidebar: the sidebar's menu, laid out to be rearranged.
 *
 * It takes the menu's place in the expanded sidebar, after the RSM
 * prototype's "Customize navigation". Each section is a card: drag a card by
 * its handle to move the section, and an item by its own to move it within
 * its section or into another. A switch per item lists it in its section or
 * keeps it behind the section's "…", so nothing switched off is ever out of
 * reach. Handles move with the arrow keys too.
 *
 * Every change is saved as it is made, for the active workspace, so there is
 * nothing to lose and Done only closes. Reset to default forgets the
 * workspace's layout. See `src/menu-layout.js` for the layout itself, and
 * `menu-sections.jsx` for how the sidebar lists it.
 */

/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { Button, Dashicon, FormToggle } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import {
	createRoot,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { dragHandle } from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	findItem,
	moveItem,
	moveSection,
	nudgeItem,
	setItemShown,
} from '../../../src/menu-layout';
import { getActiveWorkspace } from '../../../src/workspaces';
import {
	getEditableMenuLayout,
	getMenuSectionLabel,
	isMenuCustomized,
	saveMenuLayout,
} from './menu-sections';

const CUSTOMIZING_CLASS = 'cnl-sidebar-is-customizing';

const ROOT_CLASS = 'cnl-menu-customizer';

// How far, in pixels, a handle is pulled before it is a drag.
const DRAG_THRESHOLD = 4;

/*
 * Whether the customizer is open, shown as a class on <body>, which hides
 * the menu and the sidebar's foot in its favour.
 */
export const customizing = {
	listeners: new Set(),
	isOpen: false,
	get: () => customizing.isOpen,
	set( isOpen ) {
		if ( isOpen === customizing.isOpen ) {
			return;
		}
		customizing.isOpen = isOpen;
		document.body.classList.toggle( CUSTOMIZING_CLASS, isOpen );
		customizing.listeners.forEach( ( listener ) => listener() );
	},
	subscribe( listener ) {
		customizing.listeners.add( listener );
		return () => customizing.listeners.delete( listener );
	},
};

/**
 * The item's icon: an icon, or a dashicon's name, as PHP registers some.
 *
 * @param {Object} props      Props.
 * @param {*}      props.icon Menu item's icon.
 * @return {?Element} The icon.
 */
function ItemIcon( { icon } ) {
	if ( typeof icon === 'string' ) {
		return (
			<Dashicon
				className={ `${ ROOT_CLASS }__icon` }
				icon={ icon.replace( /^dashicons-/, '' ) }
			/>
		);
	}

	return icon ? (
		<Icon className={ `${ ROOT_CLASS }__icon` } icon={ icon } size={ 24 } />
	) : (
		<span className={ `${ ROOT_CLASS }__icon` } />
	);
}

/**
 * Where a dragged item or section would land under the pointer.
 *
 * @param {Object} layout   Layout.
 * @param {Object} dragging What is dragged: `{ kind, id }`.
 * @param {number} x        Pointer's x.
 * @param {number} y        Pointer's y.
 * @return {?Object} The drop: `{ sectionId, index }` for an item, `{ index }`
 *                   for a section, with `before` naming the row it lands
 *                   before, or `after` the row it lands after.
 */
function findDrop( layout, dragging, x, y ) {
	const element = document.elementFromPoint( x, y );
	const card = element?.closest( `.${ ROOT_CLASS }__section` );

	if ( ! card ) {
		return null;
	}

	const sectionId = card.dataset.sectionId;

	if ( dragging.kind === 'section' ) {
		const box = card.getBoundingClientRect();
		const isAfter = y > box.top + box.height / 2;
		const without = layout.sections.filter(
			( section ) => section.id !== dragging.id
		);
		const targetIndex = without.findIndex(
			( section ) => section.id === sectionId
		);

		if ( sectionId === dragging.id ) {
			return null;
		}

		return {
			index: targetIndex + ( isAfter ? 1 : 0 ),
			[ isAfter ? 'after' : 'before' ]: sectionId,
		};
	}

	const items = layout.sections
		.find( ( section ) => section.id === sectionId )
		.items.filter( ( item ) => item.id !== dragging.id );
	const rows = [
		...card.querySelectorAll( `.${ ROOT_CLASS }__item` ),
	].filter( ( row ) => row.dataset.itemId !== dragging.id );

	// Before the first row whose middle is below the pointer.
	const index = rows.findIndex( ( row ) => {
		const box = row.getBoundingClientRect();
		return y < box.top + box.height / 2;
	} );

	if ( index === -1 ) {
		return {
			sectionId,
			index: items.length,
			after: items.length ? items[ items.length - 1 ].id : sectionId,
		};
	}

	return { sectionId, index, before: items[ index ].id };
}

/**
 * Drag items and sections by their handles with the pointer.
 *
 * @param {Object}   layout   Layout.
 * @param {Function} onChange Takes the new layout.
 * @return {Object} What is dragged, where it would land, the pointer, and
 *                  `start( event, dragging )` for handles' pointerdown.
 */
function useDrag( layout, onChange ) {
	// The handle pressed, and where; a drag once the pointer moves away.
	const [ pressed, setPressed ] = useState( null );
	const [ dragging, setDragging ] = useState( null );
	const [ drop, setDrop ] = useState( null );
	const [ pointer, setPointer ] = useState( null );

	useEffect( () => {
		if ( ! pressed ) {
			return;
		}

		const stop = () => {
			setPressed( null );
			setDragging( null );
			setDrop( null );
			setPointer( null );
		};
		const move = ( event ) => {
			if (
				! dragging &&
				Math.hypot(
					event.clientX - pressed.x,
					event.clientY - pressed.y
				) < DRAG_THRESHOLD
			) {
				return;
			}
			event.preventDefault();
			setDragging( pressed.target );
			setPointer( { x: event.clientX, y: event.clientY } );
			setDrop(
				findDrop( layout, pressed.target, event.clientX, event.clientY )
			);
		};
		const end = ( event ) => {
			const landing =
				dragging &&
				findDrop( layout, dragging, event.clientX, event.clientY );

			if ( landing ) {
				onChange(
					dragging.kind === 'section'
						? moveSection( layout, dragging.id, landing.index )
						: moveItem(
								layout,
								dragging.id,
								landing.sectionId,
								landing.index
							)
				);
			}
			stop();
		};
		const cancel = ( event ) => {
			if ( event.key === 'Escape' ) {
				event.stopPropagation();
				stop();
			}
		};

		window.addEventListener( 'pointermove', move );
		window.addEventListener( 'pointerup', end );
		window.addEventListener( 'keydown', cancel, true );

		return () => {
			window.removeEventListener( 'pointermove', move );
			window.removeEventListener( 'pointerup', end );
			window.removeEventListener( 'keydown', cancel, true );
		};
	}, [ pressed, dragging, layout, onChange ] );

	return {
		dragging,
		drop,
		pointer,
		start( event, target ) {
			if ( event.button !== 0 ) {
				return;
			}
			// No text selection while dragging, but the handle still takes
			// focus, for the arrow keys.
			event.preventDefault();
			event.currentTarget.focus();
			setPressed( { target, x: event.clientX, y: event.clientY } );
		},
	};
}

/**
 * A handle to drag by, or to move with the arrow keys.
 *
 * @param {Object}   props          Props.
 * @param {string}   props.label    What it moves, said aloud.
 * @param {string}   props.handleId Finds it again to keep focus on it.
 * @param {Function} props.onDrag   Starts dragging.
 * @param {Function} props.onNudge  Moves one place: -1 up, 1 down.
 * @return {Element} The handle.
 */
function Handle( { label, handleId, onDrag, onNudge } ) {
	return (
		<button
			type="button"
			className={ `${ ROOT_CLASS }__handle` }
			aria-label={ label }
			aria-describedby={ `${ ROOT_CLASS }-instructions` }
			data-handle-id={ handleId }
			onPointerDown={ onDrag }
			onKeyDown={ ( event ) => {
				const step = { ArrowUp: -1, ArrowDown: 1 }[ event.key ];

				if ( step ) {
					event.preventDefault();
					onNudge( step );
				}
			} }
		>
			<Icon icon={ dragHandle } size={ 24 } />
		</button>
	);
}

function dropClass( drop, id ) {
	if ( drop?.before === id ) {
		return 'is-drop-before';
	}
	if ( drop?.after === id ) {
		return 'is-drop-after';
	}
	return '';
}

/**
 * The customizer.
 *
 * @param {Object}     props        Props.
 * @param {() => void} props.onDone Closes it.
 * @return {Element} The customizer.
 */
function MenuCustomizer( { onDone } ) {
	const [ layout, setLayout ] = useState( getEditableMenuLayout );
	const [ message, setMessage ] = useState( '' );
	const focusRef = useRef( null );
	const rootRef = useRef();
	const { items, workspaceLabel, isCustomized } = useSelect(
		( selectFn ) => ( {
			items: selectFn( bootStore )
				.getMenuItems()
				.filter( ( item ) => ! item.parent ),
			workspaceLabel: getActiveWorkspace( selectFn ).label,
			isCustomized: isMenuCustomized( selectFn ),
		} ),
		[]
	);
	const itemById = new Map( items.map( ( item ) => [ item.id, item ] ) );
	const unsectioned = items.filter(
		( item ) => ! findItem( layout, item.id )
	);

	const change = ( next ) => {
		setLayout( next );
		saveMenuLayout( next );
	};
	const drag = useDrag( layout, change );

	// Keep focus on a handle the keyboard moved, which may have remounted
	// in another section.
	useLayoutEffect( () => {
		if ( focusRef.current ) {
			rootRef.current
				?.querySelector( `[data-handle-id="${ focusRef.current }"]` )
				?.focus();
			focusRef.current = null;
		}
	} );

	useEffect( () => {
		rootRef.current?.querySelector( `.${ ROOT_CLASS }__handle` )?.focus();
	}, [] );

	const nudgeItemBy = ( id, step ) => {
		const next = nudgeItem( layout, id, step );
		const place = findItem( next, id );

		focusRef.current = `item-${ id }`;
		change( next );
		setMessage(
			sprintf(
				/* translators: 1: Menu item, 2: Section title, 3: Position. */
				__(
					'%1$s moved to %2$s, position %3$d.',
					'create-not-learn-editor'
				),
				itemById.get( id )?.label ?? id,
				getMenuSectionLabel( next.sections[ place.sectionIndex ].id ),
				place.index + 1
			)
		);
	};

	const nudgeSectionBy = ( id, step ) => {
		const index = layout.sections.findIndex(
			( section ) => section.id === id
		);
		const next = moveSection( layout, id, index + step );

		focusRef.current = `section-${ id }`;
		change( next );
		setMessage(
			sprintf(
				/* translators: 1: Section title, 2: Position. */
				__( '%1$s moved to position %2$d.', 'create-not-learn-editor' ),
				getMenuSectionLabel( id ),
				next.sections.findIndex( ( section ) => section.id === id ) + 1
			)
		);
	};

	const reset = () => {
		saveMenuLayout( null );
		// The sidebar as the workspace has it, which the reset has brought back.
		setLayout( getEditableMenuLayout() );
		setMessage(
			__( 'Sidebar reset to default.', 'create-not-learn-editor' )
		);
	};

	return (
		// Escape anywhere in the panel closes it, as Done does.
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div
			ref={ rootRef }
			className={ `${ ROOT_CLASS }__panel` }
			onKeyDown={ ( event ) => {
				if ( event.key === 'Escape' && ! drag.dragging ) {
					event.preventDefault();
					onDone();
				}
			} }
		>
			<div className={ `${ ROOT_CLASS }__header` }>
				<h2 className={ `${ ROOT_CLASS }__title` }>
					{ __( 'Customize sidebar', 'create-not-learn-editor' ) }
				</h2>
				<p
					className={ `${ ROOT_CLASS }__description` }
					id={ `${ ROOT_CLASS }-instructions` }
				>
					{ sprintf(
						/* translators: %s: Workspace name. */
						__(
							'Drag to reorder. Switch off what you rarely use and it waits under "…". Saved for the %s workspace.',
							'create-not-learn-editor'
						),
						workspaceLabel
					) }
				</p>
			</div>

			<div className={ `${ ROOT_CLASS }__list` }>
				{ unsectioned.length > 0 && (
					<div className={ `${ ROOT_CLASS }__fixed` }>
						{ unsectioned.map( ( item ) => (
							<div
								key={ item.id }
								className={ `${ ROOT_CLASS }__row is-fixed` }
								title={ __(
									'Always first.',
									'create-not-learn-editor'
								) }
							>
								<ItemIcon icon={ item.icon } />
								<span className={ `${ ROOT_CLASS }__label` }>
									{ item.label }
								</span>
							</div>
						) ) }
					</div>
				) }

				{ layout.sections.map( ( section ) => {
					const label = getMenuSectionLabel( section.id );

					return (
						<div
							key={ section.id }
							className={ [
								`${ ROOT_CLASS }__section`,
								drag.dragging?.id === section.id
									? 'is-dragging'
									: '',
								dropClass( drag.drop, section.id ),
								drag.dragging?.kind === 'item' &&
								drag.drop?.sectionId === section.id
									? 'is-drop-target'
									: '',
							]
								.filter( Boolean )
								.join( ' ' ) }
							data-section-id={ section.id }
						>
							<div
								className={ `${ ROOT_CLASS }__row is-section` }
							>
								<Handle
									label={ sprintf(
										/* translators: %s: Section title. */
										__(
											'Move %s section',
											'create-not-learn-editor'
										),
										label
									) }
									handleId={ `section-${ section.id }` }
									onDrag={ ( event ) =>
										drag.start( event, {
											kind: 'section',
											id: section.id,
										} )
									}
									onNudge={ ( step ) =>
										nudgeSectionBy( section.id, step )
									}
								/>
								<span
									className={ `${ ROOT_CLASS }__section-label` }
								>
									{ label }
								</span>
							</div>

							{ section.items.length === 0 && (
								<p className={ `${ ROOT_CLASS }__empty` }>
									{ __(
										'Drag items here',
										'create-not-learn-editor'
									) }
								</p>
							) }

							{ section.items.map( ( entry ) => {
								const item = itemById.get( entry.id );

								if ( ! item ) {
									return null;
								}

								return (
									<div
										key={ entry.id }
										className={ [
											`${ ROOT_CLASS }__row`,
											`${ ROOT_CLASS }__item`,
											entry.shown ? '' : 'is-off',
											drag.dragging?.id === entry.id
												? 'is-dragging'
												: '',
											dropClass( drag.drop, entry.id ),
										]
											.filter( Boolean )
											.join( ' ' ) }
										data-item-id={ entry.id }
									>
										<Handle
											label={ sprintf(
												/* translators: %s: Menu item. */
												__(
													'Move %s',
													'create-not-learn-editor'
												),
												item.label
											) }
											handleId={ `item-${ entry.id }` }
											onDrag={ ( event ) =>
												drag.start( event, {
													kind: 'item',
													id: entry.id,
												} )
											}
											onNudge={ ( step ) =>
												nudgeItemBy( entry.id, step )
											}
										/>
										<ItemIcon icon={ item.icon } />
										<span
											className={ `${ ROOT_CLASS }__label` }
										>
											{ item.label }
										</span>
										<FormToggle
											className={ `${ ROOT_CLASS }__toggle` }
											aria-label={ sprintf(
												/* translators: %s: Menu item. */
												__(
													'Show %s',
													'create-not-learn-editor'
												),
												item.label
											) }
											checked={ entry.shown }
											onChange={ ( event ) =>
												change(
													setItemShown(
														layout,
														entry.id,
														event.target.checked
													)
												)
											}
										/>
									</div>
								);
							} ) }
						</div>
					);
				} ) }
			</div>

			<div className={ `${ ROOT_CLASS }__footer` }>
				<Button
					__next40pxDefaultSize
					variant="tertiary"
					disabled={ ! isCustomized }
					accessibleWhenDisabled
					onClick={ reset }
				>
					{ __( 'Reset to default', 'create-not-learn-editor' ) }
				</Button>
				<Button
					__next40pxDefaultSize
					variant="primary"
					onClick={ onDone }
				>
					{ __( 'Done', 'create-not-learn-editor' ) }
				</Button>
			</div>

			<div className="screen-reader-text" aria-live="polite">
				{ message }
			</div>

			{ drag.dragging && drag.pointer && (
				<div
					className={ `${ ROOT_CLASS }__ghost` }
					style={ {
						transform: `translate3d(${ drag.pointer.x + 12 }px, ${
							drag.pointer.y + 12
						}px, 0)`,
					} }
					aria-hidden="true"
				>
					{ drag.dragging.kind === 'section'
						? getMenuSectionLabel( drag.dragging.id )
						: itemById.get( drag.dragging.id )?.label }
				</div>
			) }
		</div>
	);
}

/**
 * The customizer, rendered only while it is open, so it starts from the
 * sidebar as it is each time.
 *
 * @return {?Element} The customizer.
 */
function MenuCustomizerRoot() {
	const isOpen = useSyncExternalStore(
		customizing.subscribe,
		customizing.get
	);

	return isOpen ? (
		<MenuCustomizer onDone={ () => customizing.set( false ) } />
	) : null;
}

/**
 * The customizer's place in the sidebar, which `sidebar.js` puts after the
 * menu.
 *
 * @return {Element} Its container.
 */
export function createMenuCustomizer() {
	const container = document.createElement( 'div' );
	container.className = ROOT_CLASS;
	createRoot( container ).render( <MenuCustomizerRoot /> );

	return container;
}
