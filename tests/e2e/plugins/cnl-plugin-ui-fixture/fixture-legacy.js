/**
 * Plugins that need the Post or Site Editor's own scripts, as real plugins
 * using these slots do: the excerpt slot is only public from `wp-edit-post`
 * in Gutenberg 24, and the layout one only from `wp-edit-site`.
 */
( function () {
	const { createElement: el } = wp.element;
	const { PanelRow, Button } = wp.components;
	const only = window.cnlPluginUiFixture?.only;
	const wanted = ( name ) => ! only || only.includes( name );
	const PluginPostExcerpt = wp.editPost?.__experimentalPluginPostExcerpt;

	if ( wanted( 'cnl-fixture-excerpt' ) && PluginPostExcerpt ) {
		wp.plugins.registerPlugin( 'cnl-fixture-excerpt', {
			icon: 'excerpt-view',
			render: () =>
				el(
					PluginPostExcerpt,
					null,
					el(
						Button,
						{
							variant: 'link',
							onClick: () =>
								wp.data.dispatch( 'core/editor' ).editPost( {
									excerpt:
										'A short summary written by the Excerpt Writer.',
								} ),
						},
						'Write one for me'
					)
				),
		} );
	}

	if (
		wanted( 'cnl-fixture-layout-notes' ) &&
		wp.editSite?.PluginTemplateSettingPanel
	) {
		wp.plugins.registerPlugin( 'cnl-fixture-layout-notes', {
			icon: 'layout',
			render: () =>
				el(
					wp.editSite.PluginTemplateSettingPanel,
					null,
					el( PanelRow, null, 'Layout notes: used by the blog.' )
				),
		} );
	}
} )();
