/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';

/**
 * The module a loader from `createModuleLoader()` imports, once it has.
 *
 * Imported straight from `@wordpress/element`, rather than through
 * `wordpress-packages.js`, as the chat uses it from app init.
 *
 * @param {Object}  loader            From `createModuleLoader()`.
 * @param {boolean} [shouldLoad=true] Whether the caller needs it now. Pass
 *                                    `false` to wait until it does.
 * @return {?Object} The module, or `null` until it has loaded.
 */
export function useLoadedModule( loader, shouldLoad = true ) {
	const [ module, setModule ] = useState( () => loader.getLoaded() );

	useEffect( () => {
		if ( module || ! shouldLoad ) {
			return undefined;
		}

		let isCurrent = true;

		// A failed import is forgotten by the loader, so the next caller
		// tries again rather than waiting on it for the rest of the page.
		loader.load().then( ( loaded ) => {
			if ( isCurrent ) {
				setModule( () => loaded );
			}
		} );

		return () => {
			isCurrent = false;
		};
	}, [ loader, module, shouldLoad ] );

	return module;
}
