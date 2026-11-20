<?php
/**
 * Tests for the site history log.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Site_History_Test extends WP_UnitTestCase {
	private static $admin_id;
	private static $editor_id;

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		self::$admin_id  = $factory->user->create(
			array(
				'role'         => 'administrator',
				'display_name' => 'Ada Admin',
			)
		);
		self::$editor_id = $factory->user->create( array( 'role' => 'editor' ) );
	}

	public function set_up() {
		parent::set_up();
		delete_option( CNL_EDITOR_SITE_HISTORY_OPTION );
		do_action( 'rest_api_init', rest_get_server() );
	}

	private function make_menu( $content ) {
		$menu_id = self::factory()->post->create(
			array(
				'post_type'    => 'wp_navigation',
				'post_status'  => 'publish',
				'post_title'   => 'Main menu',
				'post_content' => 'First',
			)
		);
		wp_update_post(
			array(
				'ID'           => $menu_id,
				'post_content' => $content,
			)
		);

		return $menu_id;
	}

	public function test_an_entry_has_the_time_the_person_and_each_change() {
		$menu_id = $this->make_menu( 'Second' );

		$entry = cnl_editor_record_site_history(
			array(
				array(
					'kind'  => 'postType',
					'name'  => 'wp_navigation',
					'key'   => $menu_id,
					'label' => 'Main menu',
				),
				array(
					'kind'   => 'root',
					'name'   => 'site',
					'label'  => 'Site name',
					'values' => array( 'title' => 'New name' ),
				),
			),
			self::$admin_id
		);

		$this->assertSame( self::$admin_id, $entry['user_id'] );
		$this->assertEqualsWithDelta( time(), $entry['time'], 5 );
		$this->assertCount( 2, $entry['changes'] );
		$this->assertSame( array( 'title' => 'New name' ), $entry['changes'][1]['values'] );
	}

	public function test_a_change_keeps_the_revision_it_made() {
		$menu_id   = $this->make_menu( 'Second' );
		$revisions = wp_get_post_revisions( $menu_id, array( 'fields' => 'ids' ) );

		$entry = cnl_editor_record_site_history(
			array(
				array(
					'kind'  => 'postType',
					'name'  => 'wp_navigation',
					'key'   => (string) $menu_id,
					'label' => 'Main menu',
				),
			)
		);

		$this->assertNotEmpty( $revisions );
		$this->assertSame( (int) reset( $revisions ), $entry['changes'][0]['revision'] );
	}

	public function test_pages_and_posts_are_left_out() {
		$page_id = self::factory()->post->create( array( 'post_type' => 'page' ) );

		$entry = cnl_editor_record_site_history(
			array(
				array(
					'kind'  => 'postType',
					'name'  => 'page',
					'key'   => $page_id,
					'label' => 'About',
				),
			)
		);

		$this->assertNull( $entry );
		$this->assertSame( array(), cnl_editor_get_site_history() );
	}

	public function test_a_key_must_belong_to_the_type_it_is_logged_as() {
		$page_id = self::factory()->post->create( array( 'post_type' => 'page' ) );

		$this->assertNull(
			cnl_editor_record_site_history(
				array(
					array(
						'kind' => 'postType',
						'name' => 'wp_navigation',
						'key'  => $page_id,
					),
				)
			)
		);
	}

	public function test_history_is_newest_first_and_capped() {
		for ( $i = 1; $i <= CNL_EDITOR_SITE_HISTORY_LIMIT + 3; $i++ ) {
			cnl_editor_record_site_history(
				array(
					array(
						'kind'   => 'root',
						'name'   => 'site',
						'values' => array( 'posts_per_page' => $i ),
					),
				)
			);
		}

		$history = cnl_editor_get_site_history();

		$this->assertCount( CNL_EDITOR_SITE_HISTORY_LIMIT, $history );
		$this->assertSame( CNL_EDITOR_SITE_HISTORY_LIMIT + 3, $history[0]['changes'][0]['values']['posts_per_page'] );
	}

	public function test_the_log_is_not_autoloaded() {
		cnl_editor_record_site_history(
			array(
				array(
					'kind'   => 'root',
					'name'   => 'site',
					'values' => array( 'title' => 'A' ),
				),
			)
		);

		$autoloaded = wp_load_alloptions();

		$this->assertArrayNotHasKey( CNL_EDITOR_SITE_HISTORY_OPTION, $autoloaded );
	}

	public function test_rest_records_and_lists_for_people_who_can_edit_the_theme() {
		wp_set_current_user( self::$admin_id );

		$request = new WP_REST_Request( 'POST', '/' . CNL_EDITOR_REST_NAMESPACE . '/site-history' );
		$request->set_param(
			'changes',
			array(
				array(
					'kind'   => 'root',
					'name'   => 'site',
					'label'  => 'Tagline',
					'values' => array( 'description' => 'Hello' ),
				),
			)
		);
		$response = rest_get_server()->dispatch( $request );

		$this->assertSame( 201, $response->get_status() );
		$this->assertSame( 'Ada Admin', $response->get_data()['user']['name'] );

		$list = rest_get_server()->dispatch( new WP_REST_Request( 'GET', '/' . CNL_EDITOR_REST_NAMESPACE . '/site-history' ) );

		$this->assertCount( 1, $list->get_data() );

		wp_set_current_user( self::$editor_id );

		$this->assertSame(
			403,
			rest_get_server()->dispatch( new WP_REST_Request( 'GET', '/' . CNL_EDITOR_REST_NAMESPACE . '/site-history' ) )->get_status()
		);
	}

	public function test_rest_refuses_an_entry_with_nothing_to_keep() {
		wp_set_current_user( self::$admin_id );

		$request = new WP_REST_Request( 'POST', '/' . CNL_EDITOR_REST_NAMESPACE . '/site-history' );
		$request->set_param( 'changes', array( array( 'kind' => 'postType', 'name' => 'page', 'key' => 1 ) ) );

		$this->assertSame( 400, rest_get_server()->dispatch( $request )->get_status() );
	}

	public function test_a_change_keeps_what_it_changed_from_and_to() {
		$entry = cnl_editor_record_site_history(
			array(
				array(
					'kind'    => 'root',
					'name'    => 'site',
					'label'   => 'Site name',
					'values'  => array( 'title' => 'New' ),
					'summary' => 'Site name: Old → New',
					'details' => array(
						array(
							'label' => 'Site name',
							'kind'  => 'changed',
							'from'  => array( 'text' => 'Old' ),
							'to'    => array( 'text' => '<b>New</b>' ),
						),
						array(
							'label' => 'Background color',
							'kind'  => 'whatever',
							'from'  => array(
								'text'  => 'White',
								'color' => '#ffffff',
							),
							'to'    => array(
								'text'  => 'Evil',
								'color' => 'red;background:url(x)',
								'image' => 'javascript:alert(1)',
							),
						),
						array( 'kind' => 'added' ),
					),
				),
			)
		);

		$change = $entry['changes'][0];

		$this->assertSame( 'Site name: Old → New', $change['summary'] );
		$this->assertCount( 2, $change['details'] );
		$this->assertSame( 'New', $change['details'][0]['to']['text'] );
		$this->assertSame( '#ffffff', $change['details'][1]['from']['color'] );
		$this->assertSame( 'changed', $change['details'][1]['kind'] );
		$this->assertArrayNotHasKey( 'color', $change['details'][1]['to'] );
		$this->assertArrayNotHasKey( 'image', $change['details'][1]['to'] );
	}

	public function test_details_past_the_limit_are_counted_not_kept() {
		$details = array();
		for ( $i = 0; $i < CNL_EDITOR_SITE_HISTORY_DETAIL_LIMIT + 5; $i++ ) {
			$details[] = array(
				'label' => "Detail $i",
				'to'    => array( 'text' => 'x' ),
			);
		}

		$entry = cnl_editor_record_site_history(
			array(
				array(
					'kind'    => 'root',
					'name'    => 'site',
					'values'  => array( 'title' => 'A' ),
					'details' => $details,
					'more'    => 2,
				),
			)
		);

		$this->assertCount( CNL_EDITOR_SITE_HISTORY_DETAIL_LIMIT, $entry['changes'][0]['details'] );
		$this->assertSame( 7, $entry['changes'][0]['more'] );
	}

	public function test_a_change_keeps_the_revision_its_own_save_made_and_the_one_before() {
		wp_set_current_user( self::$admin_id );
		$menu_id = $this->make_menu( 'Second' );
		$ours    = (int) current( wp_get_post_revisions( $menu_id, array( 'fields' => 'ids' ) ) );
		$before  = cnl_editor_get_previous_revision( $menu_id, $ours );

		// Someone else saves the same menu before the entry is logged.
		wp_set_current_user( self::$editor_id );
		wp_update_post(
			array(
				'ID'           => $menu_id,
				'post_content' => 'Theirs',
			)
		);

		$entry = cnl_editor_record_site_history(
			array(
				array(
					'kind' => 'postType',
					'name' => 'wp_navigation',
					'key'  => $menu_id,
				),
			),
			self::$admin_id
		);

		$this->assertNotSame( 0, $before );
		$this->assertSame( $ours, $entry['changes'][0]['revision'] );
		$this->assertSame( $before, $entry['changes'][0]['previous_revision'] );
		$this->assertSame( 'First', get_post( $before )->post_content );
	}

	public function test_a_save_that_made_no_revision_is_the_same_before_and_after() {
		$menu_id = $this->make_menu( 'Second' );

		$entry = cnl_editor_record_site_history(
			array(
				array(
					'kind' => 'postType',
					'name' => 'wp_navigation',
					'key'  => $menu_id,
				),
			),
			self::$admin_id
		);

		$this->assertSame( $entry['changes'][0]['revision'], $entry['changes'][0]['previous_revision'] );
	}

	public function test_a_revision_is_claimed_by_one_entry_only() {
		wp_set_current_user( self::$admin_id );
		$menu_id = $this->make_menu( 'Second' );
		$change  = array(
			'kind' => 'postType',
			'name' => 'wp_navigation',
			'key'  => $menu_id,
		);

		$first  = cnl_editor_record_site_history( array( $change ) );
		$second = cnl_editor_record_site_history( array( $change ) );

		$this->assertNotSame( $first['changes'][0]['revision'], $first['changes'][0]['previous_revision'] );
		$this->assertSame( $second['changes'][0]['revision'], $second['changes'][0]['previous_revision'] );
	}

	public function test_site_settings_keep_what_they_were_before_and_only_known_settings() {
		$entry = cnl_editor_record_site_history(
			array(
				array(
					'kind'     => 'root',
					'name'     => 'site',
					'values'   => array(
						'title'       => 'New',
						'not_a_thing' => 'x',
					),
					'previous' => array(
						'title'       => 'Old',
						'description' => 'Not changed here',
					),
				),
			)
		);

		$this->assertSame( array( 'title' => 'New' ), $entry['changes'][0]['values'] );
		$this->assertSame( array( 'title' => 'Old' ), $entry['changes'][0]['previous'] );
	}

	public function test_an_autosave_is_not_claimed_as_the_revision_a_save_made() {
		wp_set_current_user( self::$admin_id );
		$menu_id = $this->make_menu( 'Second' );
		$saved   = (int) current( wp_get_post_revisions( $menu_id, array( 'fields' => 'ids' ) ) );

		wp_create_post_autosave(
			array(
				'post_ID'      => $menu_id,
				'post_content' => 'Autosaved',
				'post_title'   => 'Menu',
				'post_type'    => 'wp_navigation',
			)
		);

		$entry = cnl_editor_record_site_history(
			array(
				array(
					'kind' => 'postType',
					'name' => 'wp_navigation',
					'key'  => $menu_id,
				),
			)
		);

		$this->assertSame( $saved, $entry['changes'][0]['revision'] );
	}
}
