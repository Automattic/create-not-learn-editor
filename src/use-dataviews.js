/**
 * DataViews, from the dataviews module, loaded the first time a list is
 * shown. See `packages/dataviews`.
 */

/**
 * Internal dependencies
 */
import { createModuleLoader } from './module-loader';
import { useLoadedModule } from './use-loaded-module';

/*
 * Held in a variable so the build leaves the import for the browser to
 * resolve through the import map, where PHP registers the module.
 */
const DATAVIEWS_MODULE = '@create-not-learn-editor/dataviews';

const loader = createModuleLoader(
	() => import( /* webpackIgnore: true */ DATAVIEWS_MODULE )
);

/**
 * @param {boolean} [shouldLoad=true] Whether the caller shows a list now.
 *                                    Pass `false` to wait until it does.
 * @return {?Object} The dataviews module, with `DataViews`,
 *                   `DataViewsPicker` and `filterSortAndPaginate`, or
 *                   `null` until it has loaded.
 */
export function useDataViews( shouldLoad = true ) {
	return useLoadedModule( loader, shouldLoad );
}
