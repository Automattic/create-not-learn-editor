<?php
/**
 * Translations for the editor's script modules.
 *
 * The editor's strings are in its own text domain. WordPress finds a module's
 * translations by the md5 of its unminified path, as it does for scripts, in
 * the plugin's language pack (`wp-content/languages/plugins`). See
 * "Translations" in CONTRIBUTING.md for how the files are made.
 *
 * @package create-not-learn-editor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Look up a module's translations in the editor's text domain.
 *
 * Only the editor's own modules. The compatibility wrapper the editor
 * registers as `@wordpress/lazy-editor` has no strings of its own.
 *
 * @param string $id Module ID.
 * @return bool Whether the module's translations are the editor's.
 */
function cnl_editor_set_script_module_translations( $id ) {
	$is_own = 0 === strpos( $id, '@' . CNL_EDITOR_SLUG . '/' )
		|| 0 === strpos( $id, CNL_EDITOR_SLUG . '/' );

	return $is_own && wp_set_script_module_translations( $id, CNL_EDITOR_SLUG );
}

/**
 * Print the translations of every module on the page, before they run.
 *
 * Core prints them on `admin_print_footer_scripts`, which the full-page
 * editor doesn't fire, so the editor prints them itself.
 */
function cnl_editor_print_script_module_translations() {
	wp_script_modules()->print_script_module_translations();
}

/**
 * Falls back to core's translation for a string the editor's language pack
 * doesn't have yet.
 *
 * Many of the editor's strings, like "Save" or "Draft", are also core's.
 * Before they had a text domain they were looked up in core's, so this keeps
 * them translated on sites whose language pack for the editor is missing or
 * behind. A translation in the editor's own domain always wins.
 *
 * Added after `wp-i18n`, so it is in place before any module runs.
 *
 * @return string JavaScript.
 */
function cnl_editor_get_core_translation_fallback_script() {
	return sprintf(
		<<<'JS'
( function ( i18n, hooks, domain ) {
	var namespace = domain + '/core-translations';
	var has = function ( text, context ) {
		return i18n.hasTranslation( text, context, domain );
	};
	hooks.addFilter( 'i18n.gettext_' + domain, namespace, function ( translation, text ) {
		return has( text ) ? translation : i18n.__( text );
	} );
	hooks.addFilter( 'i18n.gettext_with_context_' + domain, namespace, function ( translation, text, context ) {
		return has( text, context ) ? translation : i18n._x( text, context );
	} );
	hooks.addFilter( 'i18n.ngettext_' + domain, namespace, function ( translation, single, plural, number ) {
		return has( single ) ? translation : i18n._n( single, plural, number );
	} );
	hooks.addFilter( 'i18n.ngettext_with_context_' + domain, namespace, function ( translation, single, plural, number, context ) {
		return has( single, context ) ? translation : i18n._nx( single, plural, number, context );
	} );
} )( window.wp.i18n, window.wp.hooks, %s );
JS
		,
		wp_json_encode( CNL_EDITOR_SLUG )
	);
}
