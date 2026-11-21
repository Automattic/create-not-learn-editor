<?php
/**
 * Tests for falling back to core's editor.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Core_Editor_Test extends WP_UnitTestCase {
	public function set_up() {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		cnl_editor_reset_meta_box_cache();
	}

	public function tear_down() {
		cnl_editor_reset_meta_box_cache();
		parent::tear_down();
	}

	/**
	 * A screen's meta boxes as `$wp_meta_boxes` keeps them.
	 *
	 * @param array $boxes Boxes by ID, each its arguments.
	 * @return array The screen's entry.
	 */
	private function screen_with( $boxes ) {
		$entry = array();
		foreach ( $boxes as $id => $args ) {
			$entry['normal']['default'][ $id ] = false === $args ? false : array(
				'id'    => $id,
				'title' => ucfirst( $id ),
				'args'  => $args,
			);
		}

		return $entry;
	}

	public function test_no_boxes_stay_in_the_editor() {
		$this->assertFalse( cnl_editor_has_plugin_meta_boxes( array() ) );
		$this->assertFalse( cnl_editor_should_use_core_editor( true, false ) );
	}

	public function test_a_plugin_box_opens_core_editor() {
		$this->assertTrue( cnl_editor_has_plugin_meta_boxes( $this->screen_with( array( 'seo-box' => array() ) ) ) );
		$this->assertTrue( cnl_editor_should_use_core_editor( true, true ) );
	}

	public function test_only_core_boxes_stay_in_the_editor() {
		$screen = $this->screen_with(
			array(
				'submitdiv'           => array( '__back_compat_meta_box' => true ),
				'categorydiv'         => array( '__back_compat_meta_box' => true ),
				'tagsdiv-genre'       => array( '__back_compat_meta_box' => true ),
				'postimagediv'        => array( '__back_compat_meta_box' => true ),
				// Shown in core's editor once Custom Fields is turned on.
				'postcustom'          => array( '__back_compat_meta_box' => false ),
				'removed-by-a-plugin' => false,
			)
		);

		$this->assertFalse( cnl_editor_has_plugin_meta_boxes( $screen ) );
	}

	public function test_a_plugin_box_is_found_on_the_post_type_screen() {
		$this->assertFalse( cnl_editor_post_type_has_meta_boxes( 'post' ) );

		cnl_editor_reset_meta_box_cache();
		$add = static function () {
			add_meta_box( 'cnl-test-box', 'Event details', '__return_null', 'post' );
		};
		add_action( 'add_meta_boxes', $add );

		$this->assertTrue( cnl_editor_post_type_has_meta_boxes( 'post' ) );
		$this->assertFalse( cnl_editor_post_type_has_meta_boxes( 'page' ) );

		remove_action( 'add_meta_boxes', $add );
	}

	public function test_the_post_type_screen_is_cached_and_restored() {
		global $wp_meta_boxes, $current_screen;
		$wp_meta_boxes  = array( 'kept' => array() ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		$current_screen = null; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited

		$calls = 0;
		$add   = static function () use ( &$calls ) {
			++$calls;
			add_meta_box( 'cnl-test-box', 'Event details', '__return_null' );
		};
		add_action( 'add_meta_boxes_post', $add );

		$this->assertTrue( cnl_editor_post_type_has_meta_boxes( 'post' ) );
		$this->assertTrue( cnl_editor_post_type_has_meta_boxes( 'post' ) );
		$this->assertSame( 1, $calls );
		$this->assertSame( array( 'kept' => array() ), $wp_meta_boxes );
		$this->assertNull( $current_screen );

		remove_action( 'add_meta_boxes_post', $add );
	}

	public function test_the_filter_overrides_per_post() {
		$forced = self::factory()->post->create();
		$other  = self::factory()->post->create();
		$filter = static function ( $use_core_editor, $post ) use ( $forced ) {
			return $post->ID === $forced ? true : $use_core_editor;
		};
		add_filter( CNL_EDITOR_SLUG . '_use_core_editor', $filter, 10, 2 );

		$this->assertTrue( cnl_editor_post_uses_core_editor( $forced ) );
		$this->assertFalse( cnl_editor_post_uses_core_editor( $other ) );
		$this->assertNull( cnl_editor_get_core_editor_override( get_post( $other ) ) );

		remove_filter( CNL_EDITOR_SLUG . '_use_core_editor', $filter );

		// And can keep a post with meta boxes in the editor.
		$this->assertFalse( cnl_editor_should_use_core_editor( true, true, false ) );
	}

	public function test_the_classic_editor_opens_core_editor() {
		$this->assertTrue( cnl_editor_should_use_core_editor( false, false ) );
		// Even a post that asks to stay can't be edited here.
		$this->assertTrue( cnl_editor_should_use_core_editor( false, false, false ) );

		add_filter( 'use_block_editor_for_post_type', '__return_false' );
		$data = cnl_editor_get_post_type_data( get_post_type_object( 'post' ) );
		remove_filter( 'use_block_editor_for_post_type', '__return_false' );

		$this->assertTrue( cnl_editor_post_type_uses_block_editor( 'post' ) );
		$this->assertFalse( $data['blockEditor'] );
		$this->assertSame( 'classic', $data['coreEditor'] );
	}

	public function test_post_type_data_says_which_open_in_core_editor() {
		$add = static function () {
			add_meta_box( 'cnl-test-box', 'Event details', '__return_null', 'post' );
		};
		add_action( 'add_meta_boxes', $add );

		$post = cnl_editor_get_post_type_data( get_post_type_object( 'post' ) );
		$page = cnl_editor_get_post_type_data( get_post_type_object( 'page' ) );

		remove_action( 'add_meta_boxes', $add );

		$this->assertTrue( $post['hasMetaBoxes'] );
		$this->assertSame( 'meta-boxes', $post['coreEditor'] );
		$this->assertFalse( $page['hasMetaBoxes'] );
		$this->assertNull( $page['coreEditor'] );
	}

	public function test_the_rest_record_carries_only_the_filter_answer() {
		$post_id = self::factory()->post->create();
		do_action( 'rest_api_init' );

		$request = new WP_REST_Request( 'GET', '/wp/v2/posts/' . $post_id );
		$request->set_param( 'context', 'edit' );
		$data = rest_get_server()->dispatch( $request )->get_data();
		$this->assertArrayHasKey( CNL_EDITOR_CORE_EDITOR_REST_FIELD, $data );
		$this->assertNull( $data[ CNL_EDITOR_CORE_EDITOR_REST_FIELD ] );

		add_filter( CNL_EDITOR_SLUG . '_use_core_editor', '__return_true' );
		$data = rest_get_server()->dispatch( $request )->get_data();
		remove_filter( CNL_EDITOR_SLUG . '_use_core_editor', '__return_true' );
		$this->assertTrue( $data[ CNL_EDITOR_CORE_EDITOR_REST_FIELD ] );
	}

	public function test_a_post_type_filter_keeps_its_posts_in_the_editor() {
		$post_id = self::factory()->post->create();
		add_filter( 'use_block_editor_for_post_type', '__return_false' );

		$this->assertSame( 'classic', cnl_editor_get_post_type_core_editor_reason( 'post' ) );
		$this->assertTrue( cnl_editor_post_uses_core_editor( $post_id ) );

		add_filter( CNL_EDITOR_SLUG . '_post_type_uses_core_editor', '__return_false' );
		$this->assertNull( cnl_editor_get_post_type_core_editor_reason( 'post' ) );
		$this->assertFalse( cnl_editor_post_uses_core_editor( $post_id ) );

		remove_filter( CNL_EDITOR_SLUG . '_post_type_uses_core_editor', '__return_false' );
		remove_filter( 'use_block_editor_for_post_type', '__return_false' );
	}

	public function test_the_editor_keeps_its_own_post_types() {
		$add = static function () {
			add_meta_box( 'cnl-test-box', 'Event details', '__return_null' );
		};
		add_action( 'add_meta_boxes', $add );

		foreach ( array( 'wp_block', 'wp_navigation', 'wp_template', 'wp_template_part' ) as $post_type ) {
			$this->assertNull( cnl_editor_get_post_type_core_editor_reason( $post_type ) );
		}

		remove_action( 'add_meta_boxes', $add );
	}

	public function test_products_stay_in_the_editor_only_with_a_shop() {
		$this->assertTrue( cnl_editor_keep_products_in_editor( true, 'post' ) );
		// No WooCommerce in the tests site, so no shop to keep them in.
		$this->assertTrue( cnl_editor_keep_products_in_editor( true, 'product' ) );
	}

	public function test_the_sandbox_leaves_nothing_on_the_page() {
		$queue = wp_scripts()->queue;
		$add   = static function () {
			wp_enqueue_script( 'cnl-test-box-script', 'https://example.test/box.js', array(), '1', true );
			add_action( 'admin_footer', 'cnl_test_box_footer' );
			echo 'printed by a box';
			add_meta_box( 'cnl-test-box', 'Event details', '__return_null', 'post' );
		};
		add_action( 'add_meta_boxes', $add );

		ob_start();
		$this->assertTrue( cnl_editor_post_type_has_meta_boxes( 'post' ) );
		$this->assertSame( '', ob_get_clean() );

		remove_action( 'add_meta_boxes', $add );

		$this->assertSame( $queue, wp_scripts()->queue );
		$this->assertFalse( has_action( 'admin_footer', 'cnl_test_box_footer' ) );
		$this->assertFalse( isset( $GLOBALS['pagenow'] ) && 'post-new.php' === $GLOBALS['pagenow'] );
	}
}
