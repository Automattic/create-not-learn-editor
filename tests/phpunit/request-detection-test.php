<?php
/**
 * Tests for telling preview frame and full-page editor requests apart.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Request_Detection_Test extends WP_UnitTestCase {
	public function tear_down() {
		unset( $GLOBALS['pagenow'] );
		set_current_screen( 'front' );
		parent::tear_down();
	}

	private function as_preview() {
		add_filter( CNL_EDITOR_SLUG . '_is_preview_frame_request', '__return_true' );
	}

	public function test_preview_needs_the_query_arg() {
		$this->assertFalse( cnl_editor_is_preview_frame_request() );

		$this->as_preview();
		$this->assertTrue( cnl_editor_is_preview_frame_request() );
	}

	public function test_admin_is_never_a_preview() {
		$this->as_preview();
		set_current_screen( 'dashboard' );

		$this->assertFalse( cnl_editor_is_preview_frame_request() );
	}

	public function test_preview_hides_the_admin_bar() {
		$this->assertTrue( cnl_editor_hide_admin_bar_in_preview( true ) );

		$this->as_preview();
		$this->assertFalse( cnl_editor_hide_admin_bar_in_preview( true ) );
	}

	public function test_preview_names_blocks() {
		$block = array( 'blockName' => 'core/paragraph' );

		$this->assertSame( '<p>Hi</p>', cnl_editor_name_preview_block( '<p>Hi</p>', $block ) );

		$this->as_preview();
		$this->assertSame(
			'<p data-cnl-block="core/paragraph">Hi</p>',
			cnl_editor_name_preview_block( '<p>Hi</p>', $block )
		);
		$this->assertSame(
			'<p data-cnl-block="core/group">Hi</p>',
			cnl_editor_name_preview_block( '<p data-cnl-block="core/group">Hi</p>', $block )
		);
	}

	public function test_preview_frame_styles_only_in_previews() {
		ob_start();
		cnl_editor_output_preview_frame_styles();
		$this->assertSame( '', ob_get_clean() );

		$this->as_preview();
		ob_start();
		cnl_editor_output_preview_frame_styles();
		$this->assertStringContainsString( 'cnl-editor-preview-frame-styles', ob_get_clean() );
	}

	public function test_full_page_needs_admin_php() {
		$GLOBALS['pagenow'] = 'index.php';
		add_filter( CNL_EDITOR_SLUG . '_is_full_page_request', '__return_true' );

		$this->assertFalse( cnl_editor_is_full_page_request() );
	}

	public function test_full_page_is_filterable() {
		$GLOBALS['pagenow'] = 'admin.php';
		$this->assertFalse( cnl_editor_is_full_page_request() );

		add_filter( CNL_EDITOR_SLUG . '_is_full_page_request', '__return_true' );
		$this->assertTrue( cnl_editor_is_full_page_request() );
	}
}
