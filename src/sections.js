/**
 * Whether a post is built from sections, and so edited as a page is, with
 * Add section, Edit design and Compose, or block by block with core's own
 * tools.
 *
 * The site answers for each post, on its REST record (`includes/sections.php`):
 * a post type is built from sections when it supports
 * `create-not-learn-editor-sections`, as pages do, and the
 * `create-not-learn-editor_has_sections` filter changes the answer for one
 * post. Everything in the editor that offers section editing asks here,
 * rather than checking for pages itself. Layouts (templates) and template
 * parts answer the same way, and by default don't have sections. See
 * `docs/architecture.md`.
 *
 * Reads core-data by its store name rather than through
 * `src/wordpress-packages`, so modules registered from app init can use it
 * without bringing the editor into page boot.
 */

/**
 * The REST field with each post's answer.
 */
export const HAS_SECTIONS_FIELD = 'cnl_has_sections';

/**
 * @param {(store: string) => Object} select   Data registry `select`.
 * @param {?string}                   postType The post's type.
 * @param {?(number|string)}          postId   The post's ID.
 * @return {boolean} Whether the post is built from sections. False until its
 *                   record has loaded.
 */
export function hasSections( select, postType, postId ) {
	if ( ! postType || postId === null || postId === undefined ) {
		return false;
	}

	return (
		select( 'core' ).getEntityRecord( 'postType', postType, postId )?.[
			HAS_SECTIONS_FIELD
		] === true
	);
}
