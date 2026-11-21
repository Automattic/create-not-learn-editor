<?php
/**
 * Tests for what the Plugins menu reads from the server.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Plugin_Ui_Test extends WP_UnitTestCase {
	public function tear_down() {
		remove_all_actions( 'add_meta_boxes' );
		parent::tear_down();
	}

	public function test_lists_meta_boxes_plugins_add_to_a_post() {
		$post_id = self::factory()->post->create();

		add_action(
			'add_meta_boxes',
			static function () {
				add_meta_box( 'legacy', 'Legacy fields', '__return_null', 'post' );
				// Replaced in the block editor, so left out as core leaves it out.
				add_meta_box( 'replaced', 'Replaced', '__return_null', 'post', 'side', 'default', array( '__back_compat_meta_box' => true ) );
			}
		);

		$this->assertSame(
			array(
				array(
					'id'    => 'legacy',
					'title' => 'Legacy fields',
				),
			),
			cnl_editor_get_meta_boxes( get_post( $post_id ) )
		);
	}

	public function test_lists_none_for_a_post_type_without_boxes() {
		$page_id = self::factory()->post->create( array( 'post_type' => 'page' ) );

		add_action(
			'add_meta_boxes',
			static function () {
				add_meta_box( 'legacy', 'Legacy fields', '__return_null', 'post' );
			}
		);

		$this->assertSame( array(), cnl_editor_get_meta_boxes( get_post( $page_id ) ) );
	}

	public function test_leaves_the_global_boxes_as_they_were() {
		global $wp_meta_boxes;

		$wp_meta_boxes = array( 'dashboard' => array( 'normal' => array() ) ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		cnl_editor_get_meta_boxes( get_post( self::factory()->post->create() ) );

		$this->assertSame( array( 'dashboard' => array( 'normal' => array() ) ), $wp_meta_boxes );
	}
}
