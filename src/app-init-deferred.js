/**
 * The parts of app init that nothing needs until someone opens them: the
 * editor's section picker, and what the WebMCP tools do. They come from the app-init-deferred script
 * module, so page boot doesn't wait for them. See
 * `packages/app-init-deferred`.
 *
 * App init asks for the module once the page has settled after boot, so it
 * has normally loaded before anyone opens the picker.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because app init imports it. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { createModuleLoader } from './module-loader';

/*
 * Held in a variable so the build leaves the import for the browser to
 * resolve through the import map, where PHP registers the module.
 */
const DEFERRED_MODULE = '@create-not-learn-editor/app-init-deferred';

const loader = createModuleLoader(
	() => import( /* webpackIgnore: true */ DEFERRED_MODULE )
);

/**
 * Fetch the module once the page has loaded and the browser is idle.
 */
export const preloadDeferredWhenIdle = loader.preloadWhenIdle;

/**
 * The module, for code outside a component, once it has loaded.
 *
 * @return {Promise<Object>} The module.
 */
export const loadDeferred = loader.load;

/**
 * Load the module, if it hasn't loaded yet.
 *
 * @return {Object} `{ deferred, error, retry }`: the module, or `null` until
 *                  it has loaded; the error if it didn't load; and a function
 *                  to try again.
 */
export function useDeferred() {
	const [ state, setState ] = useState( () => ( {
		deferred: loader.getLoaded(),
		error: null,
	} ) );
	const [ attempt, setAttempt ] = useState( 0 );

	useEffect( () => {
		if ( state.deferred ) {
			return undefined;
		}

		let isCurrent = true;

		loader.load().then(
			( deferred ) => {
				if ( isCurrent ) {
					setState( { deferred, error: null } );
				}
			},
			( error ) => {
				if ( isCurrent ) {
					setState( { deferred: null, error } );
				}
			}
		);

		return () => {
			isCurrent = false;
		};
	}, [ state.deferred, attempt ] );

	const retry = useCallback( () => {
		setState( { deferred: null, error: null } );
		setAttempt( ( count ) => count + 1 );
	}, [] );

	return { ...state, retry };
}
