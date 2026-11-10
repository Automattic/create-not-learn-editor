/**
 * DataViews, in a module of its own. It is the editor's biggest package and
 * only the lists under Advanced, Posts, all pages, the menu picker and a
 * page's details use it, so the screens import this module the first time
 * they show one rather than each bundling a copy. See `src/use-dataviews.js`.
 */
export {
	DataForm,
	DataViews,
	DataViewsPicker,
	filterSortAndPaginate,
} from '@wordpress/dataviews';
