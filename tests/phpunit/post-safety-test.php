<?php
/**
 * Tests for autosaves and post locks (`includes/post-safety.php`).
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Post_Safety_Test extends WP_UnitTestCase {
	private static $admin_id;
	private static $other_admin_id;
	private static $subscriber_id;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$admin_id       = $factory->user->create( array( 'role' => 'administrator' ) );
		self::$other_admin_id = $factory->user->create(
			array(
				'display_name' => 'Other Admin',
				'role'         => 'administrator',
			)
		);
		self::$subscriber_id  = $factory->user->create( array( 'role' => 'subscriber' ) );
	}

	public function set_up() {
		parent::set_up();
		require_once ABSPATH . 'wp-admin/includes/post.php';
		do_action( 'rest_api_init', rest_get_server() );
		wp_set_current_user( self::$admin_id );
	}

	public function tear_down() {
		unset( $_GET['get-post-lock'], $_SERVER['HTTP_REFERER'] );
		remove_all_filters( 'get_edit_post_link' );
		remove_all_filters( CNL_EDITOR_SLUG . '_has_post_safety' );
		parent::tear_down();
	}

	private function open_post( $post_id ) {
		$request = new WP_REST_Request( 'POST', '/' . CNL_EDITOR_REST_NAMESPACE . '/post-lock/' . $post_id );
		return rest_get_server()->dispatch( $request );
	}

	private function make_post( $args = array() ) {
		return self::factory()->post->create(
			array_merge(
				array(
					'post_author'   => self::$admin_id,
					'post_date'     => '2020-01-01 00:00:00',
					'post_date_gmt' => '2020-01-01 00:00:00',
					'post_status'   => 'publish',
					'post_type'     => 'page',
				),
				$args
			)
		);
	}

	public function test_opening_a_post_locks_it_for_the_current_user() {
		$post_id = $this->make_post();

		$data = $this->open_post( $post_id )->get_data();

		$this->assertTrue( $data['supported'] );
		$this->assertFalse( $data['postLock']['isLocked'] );
		$this->assertStringEndsWith( ':' . self::$admin_id, $data['postLock']['activePostLock'] );
		$this->assertSame( AUTOSAVE_INTERVAL, $data['autosaveInterval'] );
		$this->assertSame( admin_url( 'admin-ajax.php' ), $data['postLockUtils']['ajaxUrl'] );
		$this->assertSame( 1, wp_verify_nonce( $data['postLockUtils']['nonce'], 'lock-post_' . $post_id ) );
		$this->assertSame( 1, wp_verify_nonce( $data['postLockUtils']['unlockNonce'], 'update-post_' . $post_id ) );
		$this->assertSame( 1, wp_verify_nonce( $data['heartbeatNonce'], 'heartbeat-nonce' ) );

		// Someone else opening it now finds it locked.
		wp_set_current_user( self::$other_admin_id );
		$this->assertSame( self::$admin_id, (int) wp_check_post_lock( $post_id ) );
	}

	public function test_a_post_someone_else_has_open_is_locked_and_says_who() {
		$post_id = $this->make_post();
		wp_set_current_user( self::$other_admin_id );
		wp_set_post_lock( $post_id );
		wp_set_current_user( self::$admin_id );

		$data = $this->open_post( $post_id )->get_data();

		$this->assertTrue( $data['postLock']['isLocked'] );
		$this->assertSame( 'Other Admin', $data['postLock']['user']['name'] );
		$this->assertArrayNotHasKey( 'activePostLock', $data['postLock'] );
		// The lock is left with them.
		$this->assertSame( self::$other_admin_id, (int) wp_check_post_lock( $post_id ) );
	}

	public function test_the_locked_dialog_can_be_turned_off() {
		$post_id = $this->make_post();
		wp_set_current_user( self::$other_admin_id );
		wp_set_post_lock( $post_id );
		wp_set_current_user( self::$admin_id );
		add_filter( 'show_post_locked_dialog', '__return_false' );

		$data = $this->open_post( $post_id )->get_data();

		remove_filter( 'show_post_locked_dialog', '__return_false' );
		$this->assertFalse( $data['postLock']['isLocked'] );
	}

	public function test_only_what_core_s_post_editor_opens_is_kept_safe() {
		$menu_id = $this->make_post( array( 'post_type' => 'wp_navigation' ) );

		$data = $this->open_post( $menu_id )->get_data();

		$this->assertSame( array( 'supported' => false ), $data );
		$this->assertFalse( wp_check_post_lock( $menu_id ) );
		$this->assertEmpty( get_post_meta( $menu_id, '_edit_lock', true ) );
	}

	public function test_which_posts_are_kept_safe_is_filterable() {
		$post_id = $this->make_post();
		add_filter( CNL_EDITOR_SLUG . '_has_post_safety', '__return_false' );

		$this->assertFalse( $this->open_post( $post_id )->get_data()['supported'] );
	}

	public function test_a_newer_autosave_of_the_user_s_is_offered() {
		$post_id     = $this->make_post();
		$autosave_id = _wp_put_post_revision(
			array(
				'ID'           => $post_id,
				'post_content' => 'Autosaved words',
				'post_excerpt' => 'Autosaved excerpt',
				'post_title'   => 'Autosaved title',
			),
			true
		);

		$autosave = $this->open_post( $post_id )->get_data()['autosave'];

		$this->assertSame( $autosave_id, $autosave['id'] );
		$this->assertSame( 'Autosaved words', $autosave['content'] );
		$this->assertSame( 'Autosaved title', $autosave['title'] );
		$this->assertSame( 'Autosaved excerpt', $autosave['excerpt'] );
	}

	public function test_an_autosave_older_than_the_post_is_not_offered() {
		$post_id     = $this->make_post();
		$autosave_id = _wp_put_post_revision( array( 'ID' => $post_id ), true );
		global $wpdb;
		$wpdb->update(
			$wpdb->posts,
			array( 'post_modified_gmt' => '2019-01-01 00:00:00' ),
			array( 'ID' => $autosave_id )
		);
		clean_post_cache( $autosave_id );

		$this->assertNull( $this->open_post( $post_id )->get_data()['autosave'] );
	}

	public function test_discarding_deletes_the_user_s_autosave() {
		$post_id     = $this->make_post();
		$autosave_id = _wp_put_post_revision( array( 'ID' => $post_id ), true );

		$request = new WP_REST_Request( 'DELETE', '/' . CNL_EDITOR_REST_NAMESPACE . '/autosave/' . $post_id );
		$data    = rest_get_server()->dispatch( $request )->get_data();

		$this->assertTrue( $data['deleted'] );
		$this->assertNull( get_post( $autosave_id ) );
		$this->assertNotNull( get_post( $post_id ) );
	}

	public function test_only_people_who_can_edit_the_post_can_open_or_discard_it() {
		$post_id = $this->make_post();
		wp_set_current_user( self::$subscriber_id );

		$this->assertSame( 403, $this->open_post( $post_id )->get_status() );
		$request = new WP_REST_Request( 'DELETE', '/' . CNL_EDITOR_REST_NAMESPACE . '/autosave/' . $post_id );
		$this->assertSame( 403, rest_get_server()->dispatch( $request )->get_status() );
		$this->assertFalse( wp_check_post_lock( $post_id ) );
	}

	public function test_taking_over_from_the_editor_comes_back_to_it() {
		$post_id                 = $this->make_post();
		$referer                 = admin_url( 'admin.php?page=' . CNL_EDITOR_SLUG . '&p=%2Ftypes%2Fpage%2Fedit%2F' . $post_id );
		$_GET['get-post-lock']   = '1';
		$_SERVER['HTTP_REFERER'] = $referer;

		cnl_editor_return_after_post_lock_takeover();

		$this->assertSame( $referer, get_edit_post_link( $post_id, 'url' ) );
	}

	public function test_taking_over_from_elsewhere_goes_to_core_s_editor() {
		$post_id                 = $this->make_post();
		$_GET['get-post-lock']   = '1';
		$_SERVER['HTTP_REFERER'] = admin_url( 'edit.php?post_type=page' );

		cnl_editor_return_after_post_lock_takeover();

		$this->assertStringContainsString( 'post.php?post=' . $post_id, get_edit_post_link( $post_id, 'url' ) );
	}
}
