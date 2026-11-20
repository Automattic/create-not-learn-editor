/**
 * Internal dependencies
 */
import { SaveControls } from './save-controls';
import { useChanges } from './use-changes';

/**
 * Save at the top right of a screen beside the canvas, for what it edits,
 * only while some of that is unsaved. See `src/save-scopes.js`.
 *
 * @param {Object}   props
 * @param {Function} props.only What the screen edits: true for its records.
 * @return {?Element} Save, or nothing while there's nothing of its to save.
 */
export function ScreenSave( { only } ) {
	const { changes, isSaving } = useChanges( { only } );

	if ( ! changes.length && ! isSaving ) {
		return null;
	}

	return <SaveControls only={ only } />;
}
