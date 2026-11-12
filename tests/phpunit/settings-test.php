<?php
/**
 * Tests for the editor's settings, routes and sidebar.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Settings_Test extends WP_UnitTestCase {
	public function test_ui_theme_only_allows_known_themes() {
		$this->assertSame( 'default', cnl_editor_get_ui_theme() );

		$theme = 'modern';
		add_filter(
			CNL_EDITOR_SLUG . '_ui_theme',
			static function () use ( &$theme ) {
				return $theme;
			}
		);
		$this->assertSame( 'modern', cnl_editor_get_ui_theme() );

		$theme = 'neon';
		$this->assertSame( 'default', cnl_editor_get_ui_theme() );
	}

	public function test_greeting_name() {
		$user = (object) array(
			'first_name' => ' Ada ',
			'nickname'   => 'ada',
			'user_login' => 'ada',
		);
		$this->assertSame( 'Ada', cnl_editor_get_greeting_name( $user ) );

		$user->first_name = '';
		$this->assertSame( '', cnl_editor_get_greeting_name( $user ), 'An untouched nickname is the login.' );

		$user->nickname = 'Countess';
		$this->assertSame( 'Countess', cnl_editor_get_greeting_name( $user ) );
	}

	public function test_app_settings_reflect_the_site() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$page_id = self::factory()->post->create( array( 'post_type' => 'page' ) );
		update_option( 'page_on_front', $page_id );

		$settings = cnl_editor_get_app_settings();

		$this->assertSame( $page_id, $settings['pageOnFront'] );
		$this->assertNull( $settings['shop'] );
	}

	public function test_routes_and_menu_items_are_registered() {
		$paths = wp_list_pluck( cnl_editor_get_routes(), 'path' );
		$this->assertNotEmpty( $paths );
		$this->assertSame( array_unique( $paths ), $paths, 'Each path is registered once.' );

		$ids = wp_list_pluck( cnl_editor_get_menu_items(), 'id' );
		$this->assertNotEmpty( $ids );
		$this->assertSame( array_unique( $ids ), $ids, 'Each menu item is registered once.' );
	}

	public function test_appearance_menu_links_to_the_editor() {
		global $submenu;
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$submenu['themes.php'] = array();

		cnl_editor_register_admin_menu();

		$this->assertContains( 'admin.php?page=' . CNL_EDITOR_SLUG, wp_list_pluck( $submenu['themes.php'] ?? array(), 2 ) );
	}
}
