<?php
/**
 * Tests for the explicit "set up site defaults" action.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Setup_Defaults_Test extends WP_UnitTestCase {
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

	public function test_loading_the_plugin_does_not_change_the_front_page() {
		$this->assertSame( 'posts', get_option( 'show_on_front' ) );
	}
}
