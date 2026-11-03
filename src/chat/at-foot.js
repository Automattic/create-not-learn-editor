/**
 * Whether an element is the last in its parent, but for elements allowed to
 * follow it.
 *
 * Boot adds a screen's element to the stage when the screen opens, after
 * anything already there, so the way in to the chat, kept at the foot of the
 * stage, can find itself above the screen. Kept free of packages so it can be
 * tested on its own.
 *
 * @param {Element}   element The element.
 * @param {Element[]} ignored Elements that may follow it.
 * @return {boolean} Whether nothing else follows it.
 */
export function isAtFoot( element, ignored = [] ) {
	for (
		let next = element.nextElementSibling;
		next;
		next = next.nextElementSibling
	) {
		if ( ! ignored.includes( next ) ) {
			return false;
		}
	}

	return true;
}
