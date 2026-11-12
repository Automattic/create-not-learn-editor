<?php
/**
 * Tests for page defaults, Page List exclusions and post kinds.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Content_Test extends WP_UnitTestCase {
	public function test_new_pages_get_the_blank_layout() {
		$page_id = self::factory()->post->create( array( 'post_type' => 'page' ) );
		$this->assertSame( 'blank-page', get_post_meta( $page_id, '_wp_page_template', true ) );
	}

	public function test_an_explicit_layout_and_posts_are_left_alone() {
		$page_id = self::factory()->post->create(
			array(
				'post_type'     => 'page',
				'page_template' => 'page-no-title',
			)
		);
		$post_id = self::factory()->post->create();

		$this->assertNotSame( 'blank-page', get_post_meta( $page_id, '_wp_page_template', true ) );
		$this->assertSame( '', get_post_meta( $post_id, '_wp_page_template', true ) );
	}

	public function test_blank_layout_is_registered() {
		$this->assertNotNull( get_block_template( 'create-not-learn-editor//blank-page' ) );
	}

	public function test_page_list_excluded_ids_are_sanitised() {
		$this->assertSame( array( 3, 7 ), cnl_editor_get_page_list_excluded_ids( array( 'excludedPageIDs' => array( '3', 0, -7, 'x' ) ) ) );
		$this->assertSame( array(), cnl_editor_get_page_list_excluded_ids( array( 'excludedPageIDs' => 'nope' ) ) );
	}

	public function test_page_list_leaves_out_excluded_pages() {
		$kept     = self::factory()->post->create( array( 'post_type' => 'page', 'post_title' => 'Kept page' ) );
		$excluded = self::factory()->post->create( array( 'post_type' => 'page', 'post_title' => 'Hidden page' ) );

		$html = do_blocks( '<!-- wp:page-list {"excludedPageIDs":[' . $excluded . ']} /-->' );

		$this->assertStringContainsString( 'Kept page', $html );
		$this->assertStringNotContainsString( 'Hidden page', $html );
		$this->assertStringContainsString( 'Hidden page', do_blocks( '<!-- wp:page-list /-->' ) );
		$this->assertNotEmpty( $kept );
	}

	public function test_post_kinds_are_registered_for_posts_only() {
		$kinds = cnl_editor_get_post_kind_settings();
		$this->assertNotEmpty( $kinds );
		foreach ( $kinds as $kind ) {
			$pattern = WP_Block_Patterns_Registry::get_instance()->get_registered( $kind['name'] );
			$this->assertSame( array( 'post' ), $pattern['postTypes'] );
			$this->assertFalse( $pattern['inserter'] );
		}
	}

	public function test_content_post_types_sort_pages_then_posts() {
		$sorted = cnl_editor_sort_content_post_types(
			array(
				'zebra' => 1,
				'post'  => 1,
				'Apple' => 1,
				'page'  => 1,
			)
		);
		$this->assertSame( array( 'page', 'post', 'Apple', 'zebra' ), array_keys( $sorted ) );
	}
}
