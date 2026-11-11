/**
 * Finding one of a list of choices by the name an agent gave it.
 */

function normalise( value ) {
	return String( value ?? '' )
		.toLowerCase()
		.replace( /\s+/g, ' ' )
		.trim();
}

/**
 * The choice with a name, matched without regard to case: exactly, or else
 * the only one whose name starts with, or holds, what was given. Anything
 * else is an error listing the names there are.
 *
 * @param {Array}    items   The choices.
 * @param {string}   name    The name given.
 * @param {Function} getName Returns a choice's name.
 * @param {string}   what    What the choices are, for the error.
 * @return {*} The choice.
 */
export function findByName( items, name, getName, what ) {
	const wanted = normalise( name );
	const names = items.map( ( item ) => normalise( getName( item ) ) );
	const find = ( test ) => {
		const found = items.filter( ( item, index ) => test( names[ index ] ) );

		return found.length === 1 ? found : null;
	};
	const exact = items.filter( ( item, index ) => names[ index ] === wanted );
	const found =
		( exact.length && exact ) ||
		find( ( itemName ) => itemName.startsWith( wanted ) ) ||
		find( ( itemName ) => itemName.includes( wanted ) );

	if ( wanted && found ) {
		return found[ 0 ];
	}

	throw new Error(
		`No ${ what } is called "${ name }". There are: ${ items
			.map( getName )
			.join( ', ' ) }.`
	);
}
