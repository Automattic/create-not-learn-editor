<?php
/**
 * Tests for working out what a previewed URL shows.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Preview_Context_Test extends WP_UnitTestCase {
	public function set_up() {
		parent::set_up();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
	}

	public function test_url_helpers() {
		$this->assertSame( '/', cnl_editor_normalize_url_path( 'https://example.org' ) );
		$this->assertSame( '/about', cnl_editor_normalize_url_path( 'https://example.org/about/' ) );
		$this->assertSame( 443, cnl_editor_get_url_port( array( 'scheme' => 'https' ) ) );
		$this->assertSame( 8080, cnl_editor_get_url_port( array( 'scheme' => 'http', 'port' => '8080' ) ) );
		$this->assertNull( cnl_editor_get_url_port( array() ) );
	}

	public function test_local_urls() {
		$this->assertTrue( cnl_editor_is_local_url( '/about' ) );
		$this->assertTrue( cnl_editor_is_local_url( home_url( '/about' ) ) );
		$this->assertFalse( cnl_editor_is_local_url( 'https://wordpress.org/' ) );
		$this->assertSame( home_url( '/about' ), cnl_editor_get_local_preview_url( '/about' ) );
		$this->assertSame( '', cnl_editor_get_local_preview_url( 'https://wordpress.org/' ) );
	}

	/**
	 * @dataProvider data_home_titles
	 */
	public function test_home_equivalent_titles( $title, $expected ) {
		$this->assertSame( $expected, cnl_editor_is_home_equivalent_title( $title ) );
	}

	public function data_home_titles() {
		return array(
			array( 'Home', true ),
			array( 'Home page', true ),
			array( 'Front-Page', true ),
			array( '<b>HOME</b>', true ),
			array( 'Homework', false ),
			array( 'About', false ),
		);
	}

	public function test_status_labels() {
		$this->assertSame( 'Published', cnl_editor_get_preview_status_label( 'publish' ) );
		$this->assertSame( 'Draft', cnl_editor_get_preview_status_label( 'auto-draft' ) );
		$this->assertSame( 'Preview', cnl_editor_get_preview_status_label( 'unknown' ) );
	}

	public function test_external_urls_have_no_context() {
		$this->assertSame( array(), cnl_editor_get_preview_context( 'https://wordpress.org/' ) );
	}

	public function test_a_post_url_gives_its_post() {
		$post_id = self::factory()->post->create( array( 'post_title' => 'Hello there' ) );

		$context = cnl_editor_get_preview_context( get_permalink( $post_id ) . '?cnl-editor-preview=1' );

		$this->assertSame( $post_id, $context['editPostId'] );
		$this->assertSame( 'Hello there', $context['previewLabel'] );
		$this->assertSame( 'post', $context['previewType'] );
		$this->assertTrue( $context['previewCanEdit'] );
	}

	public function test_a_static_front_page_is_the_homepage() {
		$page_id = self::factory()->post->create( array( 'post_type' => 'page' ) );
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $page_id );

		$context = cnl_editor_get_preview_context( home_url( '/' ) );

		$this->assertSame( $page_id, $context['editPostId'] );
	}

	public function test_edit_route_needs_permission() {
		$post_id = self::factory()->post->create();
		$this->assertNotSame( '', cnl_editor_get_post_edit_route( $post_id ) );

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$this->assertSame( '', cnl_editor_get_post_edit_route( $post_id ) );
	}
}
