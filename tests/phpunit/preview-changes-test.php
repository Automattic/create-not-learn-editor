<?php
/**
 * Tests for unsaved changes in the canvas preview.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Preview_Changes_Test extends WP_UnitTestCase {
	const SESSION = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

	private static $admin_id;
	private static $editor_id;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$admin_id  = $factory->user->create( array( 'role' => 'administrator' ) );
		self::$editor_id = $factory->user->create( array( 'role' => 'editor' ) );
	}

	public function set_up() {
		parent::set_up();
		do_action( 'rest_api_init', rest_get_server() );
		wp_set_current_user( self::$admin_id );
	}

	public function tear_down() {
		wp_suspend_cache_addition( false );
		delete_user_option( self::$admin_id, CNL_EDITOR_PREVIEW_CHANGES_OPTION );
		parent::tear_down();
	}

	private function send( $params ) {
		$request = new WP_REST_Request( 'POST', '/' . CNL_EDITOR_REST_NAMESPACE . '/preview-changes' );
		$request->set_body_params( array_merge( array( 'session' => self::SESSION ), $params ) );

		return rest_get_server()->dispatch( $request );
	}

	private function as_preview_of( $session ) {
		add_filter( CNL_EDITOR_SLUG . '_is_preview_frame_request', '__return_true' );
		add_filter(
			CNL_EDITOR_SLUG . '_preview_changes_session',
			static function () use ( $session ) {
				return $session;
			}
		);
	}

	public function test_only_those_who_can_open_the_editor_send_changes() {
		wp_set_current_user( self::$editor_id );

		$this->assertSame( 403, $this->send( array() )->get_status() );
	}

	public function test_keeps_changes_and_says_when_they_change() {
		$changes = array( 'site' => array( 'title' => 'Unsaved name' ) );

		$first = $this->send( $changes )->get_data();
		$this->assertTrue( $first['kept'] );
		$this->assertTrue( $first['changed'] );

		$again = $this->send( $changes )->get_data();
		$this->assertTrue( $again['kept'] );
		$this->assertFalse( $again['changed'] );

		$records = cnl_editor_get_kept_preview_changes( self::$admin_id );
		$this->assertSame( 'Unsaved name', $records[ self::SESSION ]['changes']['site']['title'] );
	}

	public function test_forgets_changes_when_there_are_none() {
		$this->send( array( 'site' => array( 'title' => 'Unsaved name' ) ) );

		$data = $this->send( array() )->get_data();

		$this->assertFalse( $data['kept'] );
		$this->assertTrue( $data['changed'] );
		$this->assertFalse( get_user_option( CNL_EDITOR_PREVIEW_CHANGES_OPTION, self::$admin_id ) );
	}

	public function test_expired_changes_are_dropped() {
		update_user_option(
			self::$admin_id,
			CNL_EDITOR_PREVIEW_CHANGES_OPTION,
			array(
				'old' => array(
					'time'    => time() - CNL_EDITOR_PREVIEW_CHANGES_LIFETIME - 1,
					'changes' => array(),
				),
			)
		);

		$this->assertSame( array(), cnl_editor_get_kept_preview_changes( self::$admin_id ) );
	}

	public function test_posts_the_user_cannot_edit_are_left_out() {
		$post_id = self::factory()->post->create( array( 'post_author' => self::$admin_id ) );

		// Cleaning checks each post, whoever is sending.
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'author' ) ) );

		$changes = cnl_editor_clean_preview_changes(
			array( 'posts' => array( $post_id => array( 'title' => 'Mine now' ) ) )
		);

		$this->assertSame( array(), $changes['posts'] );
	}

	public function test_preview_shows_kept_changes() {
		$page_id = self::factory()->post->create(
			array(
				'post_type'    => 'page',
				'post_title'   => 'Saved title',
				'post_content' => '<!-- wp:paragraph --><p>Saved words</p><!-- /wp:paragraph -->',
			)
		);

		$this->send(
			array(
				'posts' => array(
					$page_id => array(
						'title'    => 'Unsaved title',
						'content'  => '<!-- wp:paragraph --><p>Unsaved words</p><!-- /wp:paragraph -->',
						'template' => 'page-wide',
					),
				),
				'site'  => array( 'title' => 'Unsaved name' ),
			)
		);

		$this->as_preview_of( self::SESSION );
		cnl_editor_apply_preview_changes( new WP() );

		$found = ( new WP_Query( array( 'page_id' => $page_id ) ) )->posts[0];

		$this->assertSame( 'Unsaved title', $found->post_title );
		$this->assertStringContainsString( 'Unsaved words', $found->post_content );
		$this->assertSame( 'page-wide', get_page_template_slug( $page_id ) );
		$this->assertSame( 'Unsaved name', get_option( 'blogname' ) );
	}

	public function test_another_session_sees_the_saved_site() {
		$this->send( array( 'site' => array( 'title' => 'Unsaved name' ) ) );

		$this->as_preview_of( 'some-other-session' );
		cnl_editor_apply_preview_changes( new WP() );

		$this->assertNotSame( 'Unsaved name', get_option( 'blogname' ) );
	}

	public function test_only_preview_requests_show_changes() {
		$this->send( array( 'site' => array( 'title' => 'Unsaved name' ) ) );

		add_filter(
			CNL_EDITOR_SLUG . '_preview_changes_session',
			static function () {
				return self::SESSION;
			}
		);
		cnl_editor_apply_preview_changes( new WP() );

		$this->assertNotSame( 'Unsaved name', get_option( 'blogname' ) );
	}

	public function test_site_settings_are_only_for_those_who_could_save_them() {
		$user_id = self::factory()->user->create( array( 'role' => 'editor' ) );
		get_userdata( $user_id )->add_cap( 'edit_theme_options' );
		wp_set_current_user( $user_id );

		$changes = cnl_editor_clean_preview_changes(
			array(
				'site' => array(
					'title'         => 'Unsaved name',
					'page_on_front' => 5,
				),
			)
		);

		$this->assertSame( array(), $changes['site'] );
	}

	public function test_posts_per_page_is_capped() {
		$changes = cnl_editor_clean_preview_changes( array( 'site' => array( 'posts_per_page' => 100000 ) ) );
		$this->assertSame( CNL_EDITOR_PREVIEW_MAX_POSTS_PER_PAGE, $changes['site']['posts_per_page'] );

		$changes = cnl_editor_clean_preview_changes( array( 'site' => array( 'posts_per_page' => 0 ) ) );
		$this->assertArrayNotHasKey( 'posts_per_page', $changes['site'] );
	}

	public function test_only_the_latest_sessions_are_kept() {
		for ( $index = 0; $index <= CNL_EDITOR_PREVIEW_CHANGES_MAX_SESSIONS; $index++ ) {
			$this->send(
				array(
					'session' => 'session-' . $index,
					'site'    => array( 'title' => 'Unsaved name' ),
				)
			);
		}

		$records = cnl_editor_get_kept_preview_changes( self::$admin_id );

		$this->assertCount( CNL_EDITOR_PREVIEW_CHANGES_MAX_SESSIONS, $records );
		$this->assertArrayNotHasKey( 'session-0', $records );
		$this->assertArrayHasKey( 'session-' . CNL_EDITOR_PREVIEW_CHANGES_MAX_SESSIONS, $records );
	}

	public function test_changes_too_large_to_keep_are_refused() {
		$this->send( array( 'site' => array( 'title' => 'Unsaved name' ) ) );

		$post_id  = self::factory()->post->create();
		$response = $this->send(
			array(
				'posts' => array(
					$post_id => array( 'content' => str_repeat( 'a', CNL_EDITOR_PREVIEW_CHANGES_MAX_BYTES ) ),
				),
			)
		);

		$this->assertSame( 413, $response->get_status() );
		// What was kept before still is.
		$records = cnl_editor_get_kept_preview_changes( self::$admin_id );
		$this->assertSame( 'Unsaved name', $records[ self::SESSION ]['changes']['site']['title'] );
	}

	public function test_expired_changes_are_forgotten_when_the_editor_opens() {
		$expired = array(
			'time'    => time() - CNL_EDITOR_PREVIEW_CHANGES_LIFETIME - 1,
			'changes' => array(),
		);
		$current = array(
			'time'    => time(),
			'changes' => array(),
		);

		update_user_option(
			self::$admin_id,
			CNL_EDITOR_PREVIEW_CHANGES_OPTION,
			array(
				'old' => $expired,
				'new' => $current,
			)
		);
		cnl_editor_forget_expired_preview_changes();
		$this->assertSame( array( 'new' => $current ), get_user_option( CNL_EDITOR_PREVIEW_CHANGES_OPTION, self::$admin_id ) );

		update_user_option( self::$admin_id, CNL_EDITOR_PREVIEW_CHANGES_OPTION, array( 'old' => $expired ) );
		cnl_editor_forget_expired_preview_changes();
		$this->assertFalse( get_user_option( CNL_EDITOR_PREVIEW_CHANGES_OPTION, self::$admin_id ) );
	}

	public function test_changes_are_forgotten_on_logout() {
		$this->send( array( 'site' => array( 'title' => 'Unsaved name' ) ) );

		do_action( 'wp_logout', self::$admin_id );

		$this->assertFalse( get_user_option( CNL_EDITOR_PREVIEW_CHANGES_OPTION, self::$admin_id ) );
	}
}
