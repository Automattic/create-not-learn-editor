<?php
/**
 * Tests for the editor's script module translations.
 *
 * @package CreateNotLearnEditor
 */

class CNL_Editor_Translations_Test extends WP_UnitTestCase {
	public function test_own_modules_use_the_editor_text_domain() {
		cnl_editor_register_script_module_from_build(
			'@create-not-learn-editor/app-init',
			'modules/app-init/index.min'
		);
		cnl_editor_register_script_module_from_build(
			'create-not-learn-editor/routes/home/content',
			'routes/home/content.min'
		);

		foreach ( array( '@create-not-learn-editor/app-init', 'create-not-learn-editor/routes/home/content' ) as $id ) {
			$module = wp_script_modules()->get_registered( $id );
			$this->assertSame( 'create-not-learn-editor', $module['textdomain'] ?? null, $id );
		}
	}

	public function test_core_modules_keep_their_text_domain() {
		wp_register_script_module( '@wordpress/lazy-editor', 'https://example.org/lazy-editor.js' );

		$this->assertFalse( cnl_editor_set_script_module_translations( '@wordpress/lazy-editor' ) );

		$module = wp_script_modules()->get_registered( '@wordpress/lazy-editor' );
		$this->assertArrayNotHasKey( 'textdomain', $module );
	}

	public function test_module_translations_are_found_by_their_unminified_path() {
		$id = 'create-not-learn-editor/routes/home/content';
		cnl_editor_register_script_module_from_build( $id, 'routes/home/content.min' );

		$dir = get_temp_dir() . 'cnl-translations-test';
		wp_mkdir_p( $dir );
		$file = $dir . '/create-not-learn-editor-de_DE-' . md5( 'build/routes/home/content.js' ) . '.json';
		file_put_contents( $file, '{"locale_data":{"messages":{"":{},"Home":["Startseite"]}}}' );

		$locale = static function () {
			return 'de_DE';
		};
		$lang_dir = static function ( $path, $domain ) use ( $dir ) {
			return 'create-not-learn-editor' === $domain ? $dir : $path;
		};
		add_filter( 'determine_locale', $locale );
		add_filter( 'lang_dir_for_domain', $lang_dir, 10, 2 );

		$json = load_script_module_textdomain( $id, 'create-not-learn-editor' );

		remove_filter( 'determine_locale', $locale );
		remove_filter( 'lang_dir_for_domain', $lang_dir );
		unlink( $file );

		$this->assertIsString( $json );
		$this->assertStringContainsString( 'Startseite', $json );
	}

	public function test_core_translation_fallback_is_for_the_editor_text_domain() {
		$script = cnl_editor_get_core_translation_fallback_script();

		$this->assertStringContainsString( '"create-not-learn-editor"', $script );
		$this->assertStringContainsString( "'i18n.gettext_' + domain", $script );
		$this->assertStringContainsString( "'i18n.ngettext_with_context_' + domain", $script );
	}
}
