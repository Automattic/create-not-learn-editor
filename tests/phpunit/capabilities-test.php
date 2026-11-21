<?php
/**
 * Tests for who can open the editor and what each person is offered in it.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Capabilities_Test extends WP_UnitTestCase {
	private static $users = array();

	/*
	 * The screens that change the whole site, for people who can change its
	 * look. `/styles`, `/font-list` and `/templates` are Gutenberg's, and
	 * there when the installed Gutenberg has them.
	 */
	const SITE_PATHS = array(
		'/site-overview',
		'/navigation',
		'/navigation/edit/$id',
		'/wp_template',
		'/wp_template_part',
		'/design',
		'/design/colors',
		'/design/fonts',
		'/site-parts',
		'/site-parts/header',
		'/site-parts/footer',
		'/patterns',
		'/template-parts',
	);

	const CONTENT_PATHS = array(
		'/',
		'/types/$type',
		'/types/$type/list/$view',
		'/types/$type/edit/$id',
		'/types/$type/new',
		'/not-available',
	);

	public static function wpSetUpBeforeClass( WP_UnitTest_Factory $factory ) {
		foreach ( array( 'administrator', 'editor', 'author', 'contributor', 'subscriber' ) as $role ) {
			self::$users[ $role ] = $factory->user->create( array( 'role' => $role ) );
		}
	}

	/**
	 * Register the editor's routes and menu items for a role, as the page
	 * does when it loads.
	 *
	 * @param string $role Role.
	 * @return array `routes`, path to route module, and `menu`, item IDs.
	 */
	private function register_for( $role ) {
		wp_set_current_user( self::$users[ $role ] );
		cnl_editor_reset_editor_registry();
		do_action( CNL_EDITOR_SLUG . '_init' );

		$routes = array();
		foreach ( cnl_editor_get_registered_routes() as $route ) {
			$routes[ $route['path'] ] = $route['route_module'] ?? '';
		}

		return array(
			'routes' => $routes,
			'menu'   => wp_list_pluck( cnl_editor_get_registered_menu_items(), 'id' ),
		);
	}

	private function is_not_available( $module ) {
		return 0 === strpos( $module, 'create-not-learn-editor/routes/not-available/' );
	}

	/**
	 * @dataProvider data_capability_map
	 */
	public function test_capability_map( $role, $expected ) {
		wp_set_current_user( self::$users[ $role ] );

		$this->assertSame( $expected, cnl_editor_get_user_capabilities() );
	}

	public function data_capability_map() {
		$all = array(
			'access'       => true,
			'site'         => true,
			'identity'     => true,
			'homepage'     => true,
			'media'        => true,
			'shop'         => false,
			'editHomepage' => true,
		);

		return array(
			'administrator' => array( 'administrator', $all ),
			'editor'        => array(
				'editor',
				array_merge(
					$all,
					array(
						'site'         => false,
						'identity'     => false,
						'homepage'     => false,
						// Latest posts, so the homepage is a layout.
						'editHomepage' => false,
					)
				),
			),
			'author'        => array(
				'author',
				array_merge(
					$all,
					array(
						'site'         => false,
						'identity'     => false,
						'homepage'     => false,
						'editHomepage' => false,
					)
				),
			),
			'contributor'   => array(
				'contributor',
				array_merge(
					$all,
					array(
						'site'         => false,
						'identity'     => false,
						'homepage'     => false,
						'media'        => false,
						'editHomepage' => false,
					)
				),
			),
		);
	}

	public function test_a_static_homepage_is_editable_by_whoever_can_edit_its_page() {
		$page_id = self::factory()->post->create(
			array(
				'post_type'   => 'page',
				'post_author' => self::$users['administrator'],
			)
		);
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $page_id );

		wp_set_current_user( self::$users['editor'] );
		$this->assertTrue( cnl_editor_user_can( 'editHomepage' ) );

		wp_set_current_user( self::$users['author'] );
		$this->assertFalse( cnl_editor_user_can( 'editHomepage' ) );
	}

	/**
	 * @dataProvider data_roles_that_open_the_editor
	 */
	public function test_every_role_that_writes_opens_the_editor( $role, $can_open ) {
		wp_set_current_user( self::$users[ $role ] );

		$this->assertSame( $can_open, current_user_can( cnl_editor_get_access_capability() ) );
	}

	public function data_roles_that_open_the_editor() {
		return array(
			'administrator' => array( 'administrator', true ),
			'editor'        => array( 'editor', true ),
			'author'        => array( 'author', true ),
			'contributor'   => array( 'contributor', true ),
			'subscriber'    => array( 'subscriber', false ),
		);
	}

	public function test_access_capability_is_filterable() {
		add_filter(
			CNL_EDITOR_SLUG . '_access_capability',
			static function () {
				return 'edit_pages';
			}
		);
		$this->assertSame( 'edit_pages', cnl_editor_get_access_capability() );

		wp_set_current_user( self::$users['author'] );
		$this->assertFalse( cnl_editor_user_can( 'access' ) );
	}

	public function test_access_capability_falls_back_when_filtered_to_nothing() {
		add_filter( CNL_EDITOR_SLUG . '_access_capability', '__return_empty_string' );

		$this->assertSame( 'edit_posts', cnl_editor_get_access_capability() );
	}

	public function test_requirements() {
		wp_set_current_user( self::$users['editor'] );

		$this->assertTrue( cnl_editor_user_can( '' ), 'Nothing asked of them.' );
		$this->assertTrue( cnl_editor_user_can( 'edit_pages' ), 'A capability.' );
		$this->assertFalse( cnl_editor_user_can( 'site' ), 'An area of the map.' );
		$this->assertFalse( cnl_editor_user_can( array( 'edit_pages', 'manage_options' ) ), 'All of a list.' );
		$this->assertTrue(
			cnl_editor_user_can(
				static function () {
					return true;
				}
			),
			'A closure.'
		);
		$this->assertFalse( cnl_editor_user_can( '__return_true' ), 'A string is a capability, never a function.' );
	}

	public function test_administrator_gets_every_route_and_menu_item() {
		$registered = $this->register_for( 'administrator' );

		foreach ( array_merge( self::SITE_PATHS, self::CONTENT_PATHS, array( '/media', '/design/identity' ) ) as $path ) {
			$this->assertArrayHasKey( $path, $registered['routes'] );
			if ( '/not-available' !== $path ) {
				$this->assertFalse( $this->is_not_available( $registered['routes'][ $path ] ), "{$path} opens its own screen." );
			}
		}

		foreach ( array( 'home', 'pages', 'content-post', 'site-overview', 'site-parts', 'navigation', 'identity', 'media', 'colors', 'fonts', 'styles', 'patterns', 'templateParts', 'templates' ) as $id ) {
			$this->assertContains( $id, $registered['menu'] );
		}
	}

	/**
	 * @dataProvider data_roles_without_site_screens
	 */
	public function test_site_screens_are_not_available( $role, $menu, $has_media ) {
		$registered = $this->register_for( $role );

		foreach ( array_merge( self::SITE_PATHS, array( '/design/identity' ) ) as $path ) {
			$this->assertArrayHasKey( $path, $registered['routes'], "{$path} is still there, to explain itself." );
			$this->assertTrue( $this->is_not_available( $registered['routes'][ $path ] ), "{$path} isn't available to an {$role}." );
		}

		foreach ( array( '/styles', '/font-list', '/templates' ) as $path ) {
			if ( isset( $registered['routes'][ $path ] ) ) {
				$this->assertTrue( $this->is_not_available( $registered['routes'][ $path ] ), "{$path} isn't available to an {$role}." );
			}
		}

		foreach ( self::CONTENT_PATHS as $path ) {
			$this->assertArrayHasKey( $path, $registered['routes'] );
		}
		$this->assertFalse( $this->is_not_available( $registered['routes']['/types/$type'] ) );

		$this->assertSame( $has_media, ! $this->is_not_available( $registered['routes']['/media'] ) );
		$this->assertSame( $menu, $registered['menu'] );
		$this->assertNotContains( '/design', cnl_editor_get_available_route_paths() );
		$this->assertContains( '/types/$type', cnl_editor_get_available_route_paths() );
	}

	public function data_roles_without_site_screens() {
		return array(
			'editor'      => array( 'editor', array( 'home', 'pages', 'content-post', 'media' ), true ),
			'author'      => array( 'author', array( 'home', 'content-post', 'media' ), true ),
			'contributor' => array( 'contributor', array( 'home', 'content-post' ), false ),
		);
	}

	/**
	 * @dataProvider data_post_type_permissions
	 */
	public function test_post_type_permissions( $role, $type, $expected ) {
		wp_set_current_user( self::$users[ $role ] );

		$data = cnl_editor_get_post_type_data( get_post_type_object( $type ) );

		$this->assertSame(
			$expected,
			array(
				'canCreate'     => $data['canCreate'],
				'canEdit'       => $data['canEdit'],
				'canPublish'    => $data['canPublish'],
				'canEditOthers' => $data['canEditOthers'],
			)
		);
	}

	public function data_post_type_permissions() {
		$all  = array(
			'canCreate'     => true,
			'canEdit'       => true,
			'canPublish'    => true,
			'canEditOthers' => true,
		);
		$none = array(
			'canCreate'     => false,
			'canEdit'       => false,
			'canPublish'    => false,
			'canEditOthers' => false,
		);

		return array(
			'administrator posts' => array( 'administrator', 'post', $all ),
			'editor pages'        => array( 'editor', 'page', $all ),
			'author posts'        => array( 'author', 'post', array_merge( $all, array( 'canEditOthers' => false ) ) ),
			'author pages'        => array( 'author', 'page', $none ),
			'contributor posts'   => array(
				'contributor',
				'post',
				array_merge(
					$none,
					array(
						'canCreate' => true,
						'canEdit'   => true,
					)
				),
			),
		);
	}

	public function test_only_people_who_can_edit_menus_get_menus_and_layouts_to_open() {
		wp_set_current_user( self::$users['administrator'] );
		$names = wp_list_pluck( cnl_editor_get_editable_post_type_data(), 'name' );
		$this->assertContains( 'wp_navigation', $names );
		$this->assertContains( 'wp_template', $names );

		wp_set_current_user( self::$users['editor'] );
		$names = wp_list_pluck( cnl_editor_get_editable_post_type_data(), 'name' );
		$this->assertNotContains( 'wp_navigation', $names );
		$this->assertNotContains( 'wp_template', $names );
		$this->assertNotContains( 'wp_template_part', $names );
		$this->assertContains( 'page', $names );
	}

	public function test_app_settings_say_what_the_user_can_do() {
		wp_set_current_user( self::$users['author'] );

		$settings = cnl_editor_get_app_settings();

		$this->assertFalse( $settings['can']['site'] );
		$this->assertTrue( $settings['can']['media'] );
	}

	public function test_admin_menu_entry() {
		global $menu, $submenu;

		wp_set_current_user( self::$users['administrator'] );
		$menu                  = array();
		$submenu['themes.php'] = array();
		cnl_editor_register_admin_menu();
		$this->assertContains( 'admin.php?page=' . CNL_EDITOR_SLUG, wp_list_pluck( $submenu['themes.php'], 2 ) );
		$this->assertNotContains( 'admin.php?page=' . CNL_EDITOR_SLUG, wp_list_pluck( $menu, 2 ), 'Admins keep it under Appearance only.' );

		foreach ( array( 'editor', 'author', 'contributor' ) as $role ) {
			wp_set_current_user( self::$users[ $role ] );
			$menu                  = array();
			$submenu['themes.php'] = array();
			cnl_editor_register_admin_menu();
			$this->assertContains( 'admin.php?page=' . CNL_EDITOR_SLUG, wp_list_pluck( $menu, 2 ), "An {$role} gets a menu item of its own." );
			$this->assertSame( array(), $submenu['themes.php'] );
		}

		wp_set_current_user( self::$users['subscriber'] );
		$menu = array();
		cnl_editor_register_admin_menu();
		$this->assertSame( array(), $menu );
	}
}
