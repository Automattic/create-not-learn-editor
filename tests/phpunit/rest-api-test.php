<?php
/**
 * Tests for the plugin's REST routes and fields.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_REST_API_Test extends WP_UnitTestCase {
	private static $admin_id;
	private static $editor_id;
	private static $contributor_id;
	private static $subscriber_id;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$admin_id       = $factory->user->create( array( 'role' => 'administrator' ) );
		self::$editor_id      = $factory->user->create( array( 'role' => 'editor' ) );
		self::$contributor_id = $factory->user->create( array( 'role' => 'contributor' ) );
		self::$subscriber_id  = $factory->user->create( array( 'role' => 'subscriber' ) );
	}

	public function set_up() {
		parent::set_up();
		do_action( 'rest_api_init', rest_get_server() );
	}

	private function dispatch( $method, $route, $params = array() ) {
		$request = new WP_REST_Request( $method, '/' . CNL_EDITOR_REST_NAMESPACE . $route );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}
		return rest_get_server()->dispatch( $request );
	}

	public function test_routes_are_registered() {
		$routes = rest_get_server()->get_routes();
		foreach ( array( '/preview-context', '/site-overview', '/setup-defaults', '/auto-drafts' ) as $route ) {
			$this->assertArrayHasKey( '/' . CNL_EDITOR_REST_NAMESPACE . $route, $routes );
		}
	}

	/**
	 * @dataProvider data_permissions
	 */
	public function test_permissions( $method, $route, $params, $role, $status ) {
		$users = array(
			'logged-out'  => 0,
			'subscriber'  => self::$subscriber_id,
			'contributor' => self::$contributor_id,
			'editor'      => self::$editor_id,
			'admin'       => self::$admin_id,
		);
		wp_set_current_user( $users[ $role ] );

		$this->assertSame( $status, $this->dispatch( $method, $route, $params )->get_status() );
	}

	public function data_permissions() {
		$url = array( 'url' => '/' );
		return array(
			'preview-context logged out'  => array( 'GET', '/preview-context', $url, 'logged-out', 401 ),
			'preview-context subscriber'  => array( 'GET', '/preview-context', $url, 'subscriber', 403 ),
			'preview-context contributor' => array( 'GET', '/preview-context', $url, 'contributor', 200 ),
			'preview-context without url' => array( 'GET', '/preview-context', array(), 'contributor', 400 ),
			'site-overview editor'        => array( 'GET', '/site-overview', array(), 'editor', 403 ),
			'site-overview admin'         => array( 'GET', '/site-overview', array(), 'admin', 200 ),
			'setup-defaults editor'       => array( 'POST', '/setup-defaults', array(), 'editor', 403 ),
			'setup-defaults admin'        => array( 'POST', '/setup-defaults', array(), 'admin', 200 ),
			'auto-draft subscriber'       => array( 'POST', '/auto-drafts', array( 'type' => 'page' ), 'subscriber', 403 ),
			'auto-draft unknown type'     => array( 'POST', '/auto-drafts', array( 'type' => 'nope' ), 'admin', 404 ),
		);
	}

	public function test_auto_draft_is_created_for_the_current_user() {
		wp_set_current_user( self::$editor_id );

		$response = $this->dispatch( 'POST', '/auto-drafts', array( 'type' => 'page' ) );
		$data     = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'page', $data['type'] );
		$this->assertSame( 'auto-draft', $data['status'] );

		$post = get_post( $data['id'] );
		$this->assertSame( 'auto-draft', $post->post_status );
		$this->assertSame( self::$editor_id, (int) $post->post_author );
	}

	public function test_auto_draft_needs_a_block_editor_type() {
		register_post_type(
			'cnl_classic',
			array(
				'public'       => true,
				'show_in_rest' => true,
				'supports'     => array( 'title' ),
			)
		);
		wp_set_current_user( self::$admin_id );

		$this->assertSame( 400, $this->dispatch( 'POST', '/auto-drafts', array( 'type' => 'cnl_classic' ) )->get_status() );

		unregister_post_type( 'cnl_classic' );
	}

	public function test_comment_count_field_on_types_with_comments() {
		wp_set_current_user( self::$admin_id );
		$post_id = self::factory()->post->create();
		self::factory()->comment->create_post_comments( $post_id, 2 );

		$request  = new WP_REST_Request( 'GET', '/wp/v2/posts/' . $post_id );
		$response = rest_get_server()->dispatch( $request );

		$this->assertSame( 2, $response->get_data()['comment_count'] );
	}
}
