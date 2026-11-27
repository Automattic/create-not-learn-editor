<?php
/**
 * Tests for telling an auto menu from one set by hand.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Hand_Set_Menu_Test extends WP_UnitTestCase {
	private function create_menu( $content, $status = 'publish' ) {
		return self::factory()->post->create(
			array(
				'post_type'    => 'wp_navigation',
				'post_status'  => $status,
				'post_content' => $content,
			)
		);
	}

	public function test_a_lone_page_list_is_an_auto_menu() {
		$this->assertTrue( cnl_editor_is_auto_menu_content( '<!-- wp:page-list /-->' ) );
		$this->assertTrue( cnl_editor_is_auto_menu_content( "\n<!-- wp:page-list {\"excludedPageIDs\":[3]} /-->\n" ) );
	}

	public function test_anything_beside_or_instead_of_a_page_list_is_set_by_hand() {
		$this->assertFalse( cnl_editor_is_auto_menu_content( '<!-- wp:page-list /--><!-- wp:home-link /-->' ) );
		$this->assertFalse( cnl_editor_is_auto_menu_content( '<!-- wp:navigation-link {"label":"About"} /-->' ) );
		$this->assertFalse( cnl_editor_is_auto_menu_content( '' ) );
	}

	public function test_site_has_a_hand_set_menu_only_once_one_is() {
		$this->assertFalse( cnl_editor_has_hand_set_menu() );

		$this->create_menu( '<!-- wp:page-list /-->' );
		$this->assertFalse( cnl_editor_has_hand_set_menu() );
		$this->assertFalse( cnl_editor_get_app_settings()['hasHandSetMenu'] );

		$this->create_menu( '<!-- wp:navigation-link {"label":"Shop"} /-->', 'draft' );
		$this->assertTrue( cnl_editor_has_hand_set_menu() );
	}

	public function test_trashed_menus_dont_count() {
		$this->create_menu( '<!-- wp:navigation-link {"label":"Old"} /-->', 'trash' );
		$this->assertFalse( cnl_editor_has_hand_set_menu() );
	}
}
