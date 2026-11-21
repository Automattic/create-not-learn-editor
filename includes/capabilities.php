<?php
/**
 * Who can do what in the editor.
 *
 * Anyone who can write content gets in. Each screen, sidebar item and Home
 * item then names the capability it needs, from the map below, and is only
 * offered to people who have it. See `docs/architecture.md`.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Get the capability that opens the editor and lists it in WP Admin's menu.
 *
 * @return string Capability.
 */
function cnl_editor_get_access_capability() {
	/**
	 * Filters the capability that opens the full-page editor.
	 *
	 * Each screen inside checks its own capability as well, so lowering
	 * this doesn't offer anyone more than they can already do.
	 *
	 * @param string $capability Capability. Default `edit_posts`.
	 */
	$capability = apply_filters( CNL_EDITOR_SLUG . '_access_capability', 'edit_posts' );

	return is_string( $capability ) && '' !== $capability ? $capability : 'edit_posts';
}

/**
 * Get what each area of the editor needs.
 *
 * A requirement is a capability, a list of capabilities that are all
 * needed, or a closure that answers for the current user. A string is
 * always a capability, never a function's name.
 *
 * - `access`: opening the editor at all.
 * - `site`: the screens that change the whole site, whatever page is on
 *   show: Design, Colors, Fonts, Styles, Templates, Site parts, Header,
 *   Footer, Menus, Patterns, All site parts and Site overview.
 * - `identity`: the site's name and logo, which are site settings.
 * - `homepage`: what the homepage shows, and the explicit setup action,
 *   which changes the reading settings and the menus too.
 * - `media`: the Media screen and uploads.
 * - `shop`: any of the shop's screens.
 * - `editHomepage`: changing the homepage itself, which is a page, or, when
 *   it lists the latest posts, a layout.
 *
 * @return array Requirements by area.
 */
function cnl_editor_get_capability_map() {
	$map = array(
		'access'       => cnl_editor_get_access_capability(),
		'site'         => 'edit_theme_options',
		// `/wp/v2/settings` takes `manage_options` for the title and logo.
		'identity'     => 'manage_options',
		// The same as `POST /setup-defaults` (`includes/rest-api.php`).
		'homepage'     => array( 'edit_theme_options', 'manage_options' ),
		'media'        => 'upload_files',
		// WooCommerce's own capabilities, as `includes/shop.php` reads them.
		'shop'         => static function () {
			return current_user_can( 'edit_products' ) ||
				current_user_can( 'edit_shop_orders' ) ||
				current_user_can( 'manage_woocommerce' );
		},
		'editHomepage' => static function () {
			return cnl_editor_user_can_edit_homepage();
		},
	);

	/**
	 * Filters what each area of the editor needs.
	 *
	 * @param array $map Requirements by area: a capability, a list of
	 *                   capabilities that are all needed, or a closure.
	 */
	return apply_filters( CNL_EDITOR_SLUG . '_capability_map', $map );
}

/**
 * Check whether the current user can change the homepage itself.
 *
 * The same as the homepage's `canEdit` on Site overview
 * (`cnl_editor_get_site_overview_home_node()`).
 *
 * @return bool Whether they can.
 */
function cnl_editor_user_can_edit_homepage() {
	$page_on_front = (int) get_option( 'page_on_front' );

	if ( 'page' === get_option( 'show_on_front' ) && $page_on_front ) {
		return current_user_can( 'edit_post', $page_on_front );
	}

	return current_user_can( 'edit_theme_options' );
}

/**
 * Check whether the current user meets a requirement.
 *
 * @param string|string[]|Closure $requirement An area of the capability map,
 *                                              a capability, a list of
 *                                              capabilities that are all
 *                                              needed, or a closure. Empty
 *                                              means anyone who can open the
 *                                              editor.
 * @return bool Whether the current user meets it.
 */
function cnl_editor_user_can( $requirement ) {
	if ( empty( $requirement ) ) {
		return true;
	}

	if ( is_string( $requirement ) ) {
		$map = cnl_editor_get_capability_map();

		if ( isset( $map[ $requirement ] ) && $map[ $requirement ] !== $requirement ) {
			return cnl_editor_user_can( $map[ $requirement ] );
		}

		return current_user_can( $requirement );
	}

	if ( is_object( $requirement ) && is_callable( $requirement ) ) {
		return (bool) call_user_func( $requirement );
	}

	if ( is_array( $requirement ) ) {
		foreach ( $requirement as $capability ) {
			if ( ! cnl_editor_user_can( $capability ) ) {
				return false;
			}
		}

		return true;
	}

	return false;
}

/**
 * Get which areas of the capability map the current user can use, for the
 * editor app to hide what they can't.
 *
 * @return bool[] Whether the user can use each area, by area.
 */
function cnl_editor_get_user_capabilities() {
	$capabilities = array();

	foreach ( array_keys( cnl_editor_get_capability_map() ) as $area ) {
		$capabilities[ $area ] = cnl_editor_user_can( $area );
	}

	return $capabilities;
}
