<?php
/**
 * Tests for wp-admin's menu as the editor's sidebar.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Admin_Menu_Test extends WP_UnitTestCase {
	private $saved_menu;
	private $saved_submenu;

	public static function set_up_before_class() {
		parent::set_up_before_class();
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
	}

	public function set_up() {
		parent::set_up();
		$this->saved_menu    = $GLOBALS['menu'] ?? null;
		$this->saved_submenu = $GLOBALS['submenu'] ?? null;
		$GLOBALS['menu']     = array( 2 => array( 'Dashboard', 'read', 'index.php', '', 'menu-top', 'menu-dashboard', 'dashicons-dashboard' ) );
		$GLOBALS['submenu']  = array();
	}

	public function tear_down() {
		$GLOBALS['menu']    = $this->saved_menu;
		$GLOBALS['submenu'] = $this->saved_submenu;
		parent::tear_down();
	}

	private function as_admin() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	public function test_adds_the_editor_after_dashboard() {
		$this->as_admin();
		cnl_editor_add_editor_menu();

		ksort( $GLOBALS['menu'], SORT_NUMERIC );
		$slugs = array_column( array_values( $GLOBALS['menu'] ), 2 );

		$this->assertSame( array( 'index.php', 'admin.php?page=' . CNL_EDITOR_SLUG ), $slugs );
	}

	public function test_editor_submenu_is_the_editors_screens() {
		$this->as_admin();
		cnl_editor_add_editor_menu();

		$parent = 'admin.php?page=' . CNL_EDITOR_SLUG;
		$items  = $GLOBALS['submenu'][ $parent ];
		$labels = array_column( $items, 0 );

		$this->assertSame( $parent, $items[0][2], 'Home is the section itself.' );
		$this->assertContains( 'Colors', $labels );
		$this->assertContains( 'Site Identity', $labels );
		$this->assertContains( $parent . '&p=' . rawurlencode( '/design/colors' ), array_column( $items, 2 ) );
	}

	public function test_no_editor_for_people_who_cannot_edit_the_theme() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );
		cnl_editor_add_editor_menu();

		$this->assertCount( 1, $GLOBALS['menu'] );
		$this->assertArrayNotHasKey( 'admin.php?page=' . CNL_EDITOR_SLUG, $GLOBALS['submenu'] );
	}

	public function test_moves_aside_for_an_item_in_its_place() {
		$this->as_admin();
		$GLOBALS['menu'][3] = array( 'Other', 'read', 'other.php' );
		cnl_editor_add_editor_menu();

		$this->assertSame( 'other.php', $GLOBALS['menu'][3][2] );
		$this->assertContains( 'admin.php?page=' . CNL_EDITOR_SLUG, array_column( $GLOBALS['menu'], 2 ) );
	}

	public function test_routes_for_wp_admin_urls() {
		$this->assertSame( '/', cnl_editor_get_admin_menu_route( 'index.php' ) );
		$this->assertSame( '/media', cnl_editor_get_admin_menu_route( 'upload.php' ) );
		$this->assertSame( '/types/post', cnl_editor_get_admin_menu_route( 'edit.php' ) );
		$this->assertSame( '/types/page', cnl_editor_get_admin_menu_route( 'edit.php?post_type=page' ) );
		$this->assertSame( '/types/page/new', cnl_editor_get_admin_menu_route( 'post-new.php?post_type=page' ) );
		$this->assertSame( '/patterns', cnl_editor_get_admin_menu_route( 'edit.php?post_type=wp_block' ) );
		$this->assertSame( '/site-overview', cnl_editor_get_admin_menu_route( 'site-editor.php' ) );
		$this->assertSame( '/templates', cnl_editor_get_admin_menu_route( 'site-editor.php?p=/template' ) );
		$this->assertSame( '/design/fonts', cnl_editor_get_admin_menu_route( 'font-library.php' ) );
	}

	public function test_routes_for_links_into_the_editor() {
		$this->assertSame( '/', cnl_editor_get_admin_menu_route( 'admin.php?page=' . CNL_EDITOR_SLUG ) );
		$this->assertSame(
			'/design/colors',
			cnl_editor_get_admin_menu_route( 'admin.php?page=' . CNL_EDITOR_SLUG . '&p=' . rawurlencode( '/design/colors' ) )
		);
	}

	public function test_no_route_for_screens_the_editor_lacks() {
		$this->assertNull( cnl_editor_get_admin_menu_route( 'edit-comments.php' ) );
		$this->assertNull( cnl_editor_get_admin_menu_route( 'options-general.php' ) );
		$this->assertNull( cnl_editor_get_admin_menu_route( 'edit.php?post_type=not_a_type' ) );
	}

	public function test_route_map_covers_the_menu() {
		$this->as_admin();
		$GLOBALS['submenu']['index.php'] = array( array( 'Home', 'read', 'index.php' ) );
		cnl_editor_add_editor_menu();

		$routes = cnl_editor_get_admin_menu_routes();

		$this->assertSame( '/', $routes['index.php'] );
		$this->assertSame( '/design/colors', $routes[ 'admin.php?page=' . CNL_EDITOR_SLUG . '&p=' . rawurlencode( '/design/colors' ) ] );
	}

	public function test_plugin_submenu_urls() {
		$this->assertSame( 'edit-comments.php', cnl_editor_get_admin_submenu_url( 'edit-comments.php', 'edit-comments.php' ) );

		$GLOBALS['admin_page_hooks']['themes.php'] = 'appearance';
		add_action( 'appearance_page_example', '__return_null' );
		$this->assertSame( 'themes.php?page=example', cnl_editor_get_admin_submenu_url( 'example', 'themes.php' ) );
	}
}
