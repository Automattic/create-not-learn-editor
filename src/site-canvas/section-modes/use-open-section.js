/**
 * Internal dependencies
 */
import { useEffect } from '../../wordpress-packages';
import { setEditableSection } from '../mode';
import { MODE_DESIGN } from './section-chrome';

/**
 * The section open for editing in place, if any. Code outside the layer,
 * such as dragging a block from anywhere on it, is told where presses reach
 * the page: that section, but not the rows of cards in it that a press goes
 * into first.
 *
 * @param {?Object}  active     The section mode on, `{ id, mode }`, if any.
 * @param {Function} getMembers Called with a section's client ID, returns its
 *                              blocks: one, but for a run of text.
 * @param {Object[]} rows       The section's rows of cards.
 * @param {?string}  openRowId  The row a press goes through, if any.
 * @return {?string} The open section's client ID.
 */
export function useOpenSection( active, getMembers, rows, openRowId ) {
	const openId = active && active.mode !== MODE_DESIGN ? active.id : null;
	const idsKey = openId ? getMembers( openId ).join() : '';
	const closedRowsKey = openId
		? rows
				.filter( ( row ) => row.clientId !== openRowId )
				.map( ( row ) => row.clientId )
				.join()
		: '';

	useEffect( () => {
		setEditableSection( {
			ids: idsKey ? idsKey.split( ',' ) : [],
			closedRows: closedRowsKey ? closedRowsKey.split( ',' ) : [],
		} );
	}, [ idsKey, closedRowsKey ] );

	useEffect( () => () => setEditableSection( null ), [] );

	return openId;
}
