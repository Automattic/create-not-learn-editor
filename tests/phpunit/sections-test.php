<?php
/**
 * Tests for which content is built from sections.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Sections_Test extends WP_UnitTestCase {
	public function test_pages_have_sections_and_posts_do_not() {
		$this->assertTrue( cnl_editor_post_has_sections( self::factory()->post->create( array( 'post_type' => 'page' ) ) ) );
		$this->assertFalse( cnl_editor_post_has_sections( self::factory()->post->create() ) );
		$this->assertFalse( cnl_editor_post_has_sections( PHP_INT_MAX ) );
	}

	public function test_the_filter_decides_per_post() {
		$post_id = self::factory()->post->create();
		$seen    = null;
		add_filter(
			CNL_EDITOR_SLUG . '_has_sections',
			static function ( $has_sections, $post ) use ( &$seen ) {
				$seen = $post;
				return true;
			},
			10,
			2
		);

		$this->assertTrue( cnl_editor_post_has_sections( $post_id ) );
		$this->assertSame( $post_id, $seen->ID );
	}

	public function test_layouts_and_parts_follow_post_type_support() {
		$template       = new WP_Block_Template();
		$template->type = 'wp_template_part';
		$this->assertFalse( cnl_editor_post_has_sections( $template ) );

		add_post_type_support( 'wp_template_part', CNL_EDITOR_SECTIONS_FEATURE );
		$this->assertTrue( cnl_editor_post_has_sections( $template ) );
		remove_post_type_support( 'wp_template_part', CNL_EDITOR_SECTIONS_FEATURE );
	}

	public function test_rest_field() {
		do_action( 'rest_api_init', rest_get_server() );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$page_id = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$post_id = self::factory()->post->create();

		$page = rest_get_server()->dispatch( new WP_REST_Request( 'GET', '/wp/v2/pages/' . $page_id ) )->get_data();
		$post = rest_get_server()->dispatch( new WP_REST_Request( 'GET', '/wp/v2/posts/' . $post_id ) )->get_data();

		$this->assertTrue( $page['cnl_has_sections'] );
		$this->assertFalse( $post['cnl_has_sections'] );
	}
}
