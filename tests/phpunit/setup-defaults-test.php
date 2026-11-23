<?php
/**
 * Tests for the explicit "set up site defaults" action.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Setup_Defaults_Test extends WP_UnitTestCase {
	public function set_up() {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	public function tear_down() {
		cnl_editor_release_navigation_lock();
		parent::tear_down();
	}

	private function lock_exists() {
		global $wpdb;

		return null !== $wpdb->get_var(
			$wpdb->prepare( "SELECT option_value FROM $wpdb->options WHERE option_name = %s", CNL_EDITOR_NAVIGATION_LOCK )
		);
	}

	private function hold_lock_elsewhere( $locked_at ) {
		global $wpdb;

		$wpdb->insert(
			$wpdb->options,
			array(
				'option_name'  => CNL_EDITOR_NAVIGATION_LOCK,
				'option_value' => (string) $locked_at,
				'autoload'     => 'off',
			)
		);
	}

	private function count_posts( $type ) {
		return count(
			get_posts(
				array(
					'post_type'   => $type,
					'post_status' => 'any',
					'numberposts' => -1,
					'fields'      => 'ids',
				)
			)
		);
	}

	public function test_sets_a_static_home_page_and_a_menu() {
		$result = cnl_editor_setup_site_defaults();

		$this->assertTrue( $result['success'] );
		$this->assertSame( 'page', get_option( 'show_on_front' ) );
		$this->assertSame( $result['homePageId'], (int) get_option( 'page_on_front' ) );
		$this->assertSame( 'publish', get_post_status( $result['homePageId'] ) );
		$this->assertTrue( cnl_editor_has_navigation_menu() );
	}

	public function test_is_idempotent() {
		$first = cnl_editor_setup_site_defaults();
		$pages = $this->count_posts( 'page' );
		$menus = $this->count_posts( 'wp_navigation' );

		$second = cnl_editor_setup_site_defaults();

		$this->assertSame( $first['homePageId'], $second['homePageId'] );
		$this->assertFalse( $second['navigationCreated'] );
		$this->assertSame( $pages, $this->count_posts( 'page' ) );
		$this->assertSame( $menus, $this->count_posts( 'wp_navigation' ) );
	}

	public function test_reuses_and_publishes_an_existing_draft_home_page() {
		$home_id = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_title'  => 'Home',
				'post_status' => 'draft',
			)
		);

		$this->assertSame( $home_id, cnl_editor_setup_site_defaults()['homePageId'] );
		$this->assertSame( 'publish', get_post_status( $home_id ) );
	}

	public function test_keeps_an_existing_menu() {
		$menu_id = self::factory()->post->create(
			array(
				'post_type'   => 'wp_navigation',
				'post_status' => 'publish',
			)
		);

		$navigation = cnl_editor_ensure_default_navigation_menu();

		$this->assertFalse( $navigation['created'] );
		$this->assertSame( 1, $this->count_posts( 'wp_navigation' ) );
		$this->assertNotNull( get_post( $menu_id ) );
	}

	public function test_makes_a_main_menu_listing_the_pages_when_there_is_none() {
		$navigation = cnl_editor_ensure_default_navigation_menu();
		$menu       = get_post( $navigation['id'] );

		$this->assertTrue( $navigation['created'] );
		$this->assertSame( 1, $this->count_posts( 'wp_navigation' ) );
		$this->assertSame( 'Main menu', $menu->post_title );
		$this->assertSame( 'main-menu', $menu->post_name );
		$this->assertSame( 'publish', $menu->post_status );
		$this->assertSame( '<!-- wp:page-list /-->', $menu->post_content );
		$this->assertFalse( $this->lock_exists() );
	}

	public function test_a_second_visit_makes_nothing() {
		$first  = cnl_editor_ensure_default_navigation_menu();
		$second = cnl_editor_ensure_default_navigation_menu();

		$this->assertTrue( $first['created'] );
		$this->assertFalse( $second['created'] );
		$this->assertSame( 1, $this->count_posts( 'wp_navigation' ) );
	}

	public function test_converts_an_existing_classic_menu() {
		$classic_id = wp_create_nav_menu( 'Classic header' );
		wp_update_nav_menu_item(
			$classic_id,
			0,
			array(
				'menu-item-title'  => 'About us',
				'menu-item-url'    => 'https://example.org/about',
				'menu-item-status' => 'publish',
			)
		);

		$navigation = cnl_editor_ensure_default_navigation_menu();
		$menu       = get_post( $navigation['id'] );

		$this->assertSame( 1, $this->count_posts( 'wp_navigation' ) );
		$this->assertSame( 'Classic header', $menu->post_title );
		$this->assertStringContainsString( 'About us', $menu->post_content );
		$this->assertStringNotContainsString( 'wp:page-list', $menu->post_content );
	}

	public function test_makes_nothing_for_someone_who_cannot_create_menus() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$navigation = cnl_editor_ensure_default_navigation_menu();

		$this->assertFalse( $navigation['created'] );
		$this->assertSame( 0, $this->count_posts( 'wp_navigation' ) );
	}

	public function test_makes_nothing_for_a_logged_out_request() {
		wp_set_current_user( 0 );

		cnl_editor_ensure_default_navigation_menu();

		$this->assertSame( 0, $this->count_posts( 'wp_navigation' ) );
	}

	public function test_respects_a_site_turning_the_fallback_off() {
		add_filter( 'wp_navigation_should_create_fallback', '__return_false' );

		$navigation = cnl_editor_ensure_default_navigation_menu();

		$this->assertFalse( $navigation['created'] );
		$this->assertSame( 0, $this->count_posts( 'wp_navigation' ) );
	}

	public function test_waits_for_and_uses_a_menu_another_request_is_making() {
		// Another request holds the lock and has just published its menu.
		$this->hold_lock_elsewhere( time() );
		$menu_id = self::factory()->post->create(
			array(
				'post_type'   => 'wp_navigation',
				'post_status' => 'publish',
			)
		);
		// Past the cheap check, as if the menu landed after it ran.
		add_filter( 'pre_get_posts', array( $this, 'hide_menus_from_the_first_check' ) );

		$navigation = cnl_editor_ensure_default_navigation_menu();

		$this->assertFalse( $navigation['created'] );
		$this->assertSame( $menu_id, $navigation['id'] );
		$this->assertSame( 1, $this->count_posts( 'wp_navigation' ) );
		// The lock is the other request's to let go of.
		$this->assertTrue( $this->lock_exists() );
	}

	public function hide_menus_from_the_first_check( $query ) {
		remove_filter( 'pre_get_posts', array( $this, 'hide_menus_from_the_first_check' ) );
		$query->set( 'post__in', array( 0 ) );
	}

	public function test_gives_up_rather_than_racing_a_request_that_holds_the_lock() {
		$this->hold_lock_elsewhere( time() );
		add_filter( 'create-not-learn-editor_navigation_lock_wait', '__return_zero' );

		$navigation = cnl_editor_ensure_default_navigation_menu();

		$this->assertFalse( $navigation['created'] );
		$this->assertSame( 0, $this->count_posts( 'wp_navigation' ) );
	}

	public function test_takes_over_a_lock_left_by_a_request_that_died() {
		$this->hold_lock_elsewhere( time() - 60 );

		$navigation = cnl_editor_ensure_default_navigation_menu();

		$this->assertTrue( $navigation['created'] );
		$this->assertSame( 1, $this->count_posts( 'wp_navigation' ) );
		$this->assertFalse( $this->lock_exists() );
	}

	public function test_core_fallback_and_the_editor_settle_on_one_menu() {
		$from_core   = WP_Navigation_Fallback::get_fallback();
		$from_editor = cnl_editor_ensure_default_navigation_menu();

		// Core's own call, for the block, made the menu; its lock is let go of.
		$this->assertFalse( $this->lock_exists() );
		$this->assertSame( 'Main menu', $from_core->post_title );
		$this->assertFalse( $from_editor['created'] );
		$this->assertSame( 1, $this->count_posts( 'wp_navigation' ) );
	}

	public function test_loading_the_plugin_does_not_change_the_front_page() {
		$this->assertSame( 'posts', get_option( 'show_on_front' ) );
	}
}
