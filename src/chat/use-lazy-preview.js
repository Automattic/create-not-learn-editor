/**
 * Lazy-editor's design preview, loaded the first time the chat shows one.
 *
 * The chat is mounted from app init, so importing the preview directly would
 * make the editor a static dependency of page boot. Importing it when needed
 * keeps the editor loading lazily, as it does everywhere else.
 */

/**
 * Internal dependencies
 */
import { createModuleLoader } from '../module-loader';
import { useLoadedModule } from '../use-loaded-module';

const loader = createModuleLoader( () => import( '@wordpress/lazy-editor' ) );

// Stands in until the preview has loaded, with whatever placeholder the
// caller gives the real one.
function PreviewPlaceholder( { placeholder = null } ) {
	return placeholder;
}

/**
 * @return {Function} The preview component, or a placeholder until it loads.
 */
export function useLazyPreview() {
	return useLoadedModule( loader )?.Preview || PreviewPlaceholder;
}
