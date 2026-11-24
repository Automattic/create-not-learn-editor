<?php
/**
 * Tests for the route the editor loads the Classic block's editor from.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Classic_Block_Test extends WP_UnitTestCase {
	private static $contributor_id;
	private static $subscriber_id;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$contributor_id = $factory->user->create( array( 'role' => 'contributor' ) );
		self::$subscriber_id  = $factory->user->create( array( 'role' => 'subscriber' ) );
	}

	public function set_up() {
		parent::set_up();
		do_action( 'rest_api_init', rest_get_server() );
	}

	private function dispatch() {
		return rest_get_server()->dispatch(
			new WP_REST_Request( 'GET', '/' . CNL_EDITOR_REST_NAMESPACE . '/classic-block-assets' )
		);
	}

	public function test_is_only_for_people_who_edit_posts() {
		wp_set_current_user( 0 );
		$this->assertSame( 401, $this->dispatch()->get_status() );

		wp_set_current_user( self::$subscriber_id );
		$this->assertSame( 403, $this->dispatch()->get_status() );
	}

	public function test_prints_what_the_post_editor_loads_for_the_classic_block() {
		// TinyMCE is only printed for browsers that can use it.
		add_filter( 'user_can_richedit', '__return_true' );
		wp_set_current_user( self::$contributor_id );

		$response = $this->dispatch();
		$html     = $response->get_data()['html'];

		$this->assertSame( 200, $response->get_status() );
		// The settings the Classic block gives TinyMCE.
		$this->assertStringContainsString( 'window.wpEditorL10n', $html );
		// The old editor's defaults, and TinyMCE itself.
		$this->assertStringContainsString( 'window.wp.editor.getDefaultSettings', $html );
		$this->assertStringContainsString( "id='wp-tinymce-js'", str_replace( '"', "'", $html ) );
		// Each script by itself, so the page can skip those it has.
		$this->assertStringContainsString( "id='editor-js'", str_replace( '"', "'", $html ) );
		$this->assertStringNotContainsString( 'load-scripts.php', $html );
		// The link dialog TinyMCE's link button opens.
		$this->assertStringContainsString( 'id="wp-link-wrap"', $html );
		// What was added ahead of the block library goes back as it was.
		$this->assertStringNotContainsString(
			'wpEditorL10n',
			implode( '', (array) wp_scripts()->get_data( 'wp-block-library', 'before' ) )
		);
	}
}
