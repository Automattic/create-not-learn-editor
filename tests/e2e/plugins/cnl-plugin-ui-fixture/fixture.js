/**
 * Editor UI in every slot a plugin can fill, each `registerPlugin()` standing
 * for one realistic plugin. Plain script on WordPress's globals, with no
 * build, as a plugin's simplest editor script is.
 */
( function () {
	const { createElement: el, Fragment, useState, useEffect } = wp.element;
	const { registerPlugin } = wp.plugins;
	const {
		PluginSidebar,
		PluginSidebarMoreMenuItem,
		PluginMoreMenuItem,
		PluginDocumentSettingPanel,
		PluginPostStatusInfo,
		PluginPrePublishPanel,
		PluginPostPublishPanel,
		PluginPreviewMenuItem,
		PluginBlockSettingsMenuItem,
		store: editorStore,
	} = wp.editor;
	const {
		PanelBody,
		TextControl,
		TextareaControl,
		ToggleControl,
		SelectControl,
		Button,
		CheckboxControl,
		Notice,
	} = wp.components;
	const { useSelect, useDispatch, dispatch, select } = wp.data;
	const only = window.cnlPluginUiFixture?.only;

	function register( name, settings ) {
		if ( only && ! only.includes( name ) ) {
			return;
		}
		registerPlugin( name, settings );
	}

	function notify( message ) {
		dispatch( 'core/notices' ).createSuccessNotice( message, {
			type: 'snackbar',
		} );
	}

	// SEO: a tall, form-heavy sidebar, its own More menu item, and a panel
	// in the document settings.
	function SeoFields() {
		const [ values, setValues ] = useState( {} );
		const field = ( key, label, Control = TextControl, extra = {} ) =>
			el( Control, {
				__next40pxDefaultSize: true,
				__nextHasNoMarginBottom: true,
				label,
				value: values[ key ] || '',
				onChange: ( value ) =>
					setValues( { ...values, [ key ]: value } ),
				...extra,
			} );
		return el(
			Fragment,
			null,
			el(
				PanelBody,
				{ title: 'Search appearance' },
				field( 'keyword', 'Focus keyphrase' ),
				field( 'title', 'SEO title' ),
				field( 'slug', 'Slug' ),
				field( 'description', 'Meta description', TextareaControl, {
					rows: 4,
				} ),
				el(
					'div',
					{
						className: 'cnl-fixture-snippet',
						style: {
							border: '1px solid #ddd',
							borderRadius: 4,
							padding: 12,
							marginTop: 12,
						},
					},
					el(
						'div',
						{ style: { color: '#1a0dab', fontSize: 16 } },
						values.title ||
							select( editorStore ).getEditedPostAttribute(
								'title'
							) ||
							'Page title'
					),
					el(
						'div',
						{ style: { color: '#006621', fontSize: 13 } },
						'example.com › ' + ( values.slug || 'page' )
					),
					el(
						'div',
						{ style: { color: '#545454', fontSize: 13 } },
						values.description ||
							'Add a meta description to see it here.'
					)
				)
			),
			el(
				PanelBody,
				{ title: 'Social', initialOpen: true },
				field( 'ogTitle', 'Social title' ),
				field( 'ogDescription', 'Social description', TextareaControl ),
				field( 'twitterCard', 'Card type', SelectControl, {
					options: [
						{ label: 'Summary', value: 'summary' },
						{ label: 'Large image', value: 'large' },
					],
				} )
			),
			el(
				PanelBody,
				{ title: 'Advanced', initialOpen: true },
				field( 'canonical', 'Canonical URL' ),
				el( ToggleControl, {
					__nextHasNoMarginBottom: true,
					label: 'Allow search engines to show this page',
					checked: values.index !== false,
					onChange: ( index ) => setValues( { ...values, index } ),
				} ),
				el( ToggleControl, {
					__nextHasNoMarginBottom: true,
					label: 'Follow links on this page',
					checked: values.follow !== false,
					onChange: ( follow ) => setValues( { ...values, follow } ),
				} ),
				field( 'breadcrumb', 'Breadcrumb title' )
			)
		);
	}

	register( 'cnl-fixture-seo', {
		icon: 'search',
		render: () =>
			el(
				Fragment,
				null,
				el(
					PluginSidebarMoreMenuItem,
					{ target: 'seo', icon: 'search' },
					'SEO Boost'
				),
				el(
					PluginSidebar,
					{ name: 'seo', title: 'SEO Boost', icon: 'search' },
					el( SeoFields )
				),
				el(
					PluginDocumentSettingPanel,
					{ name: 'seo-summary', title: 'SEO', icon: 'search' },
					el( 'p', null, 'Focus keyphrase: not set.' ),
					el(
						Button,
						{
							variant: 'secondary',
							onClick: () =>
								dispatch(
									'core/interface'
								).enableComplementaryArea(
									'core',
									'cnl-fixture-seo/seo'
								),
						},
						'Open SEO Boost'
					)
				)
			),
	} );

	// An assistant that watches the content while it is edited, so it needs
	// to stay open beside the canvas.
	function AssistantPanel() {
		const { words, headings, title } = useSelect( ( selectStore ) => {
			const editor = selectStore( editorStore );
			const content = editor.getEditedPostContent() || '';
			const text = content
				.replace( /<!--[\s\S]*?-->/g, ' ' )
				.replace( /<[^>]+>/g, ' ' );
			return {
				words: text.split( /\s+/ ).filter( Boolean ).length,
				headings: ( content.match( /<h[1-6][\s>]/g ) || [] ).length,
				title: editor.getEditedPostAttribute( 'title' ),
			};
		}, [] );
		return el(
			PanelBody,
			null,
			el(
				'p',
				null,
				el( 'strong', null, 'Watching: ' ),
				title || 'Untitled'
			),
			el(
				'p',
				{ 'data-testid': 'cnl-fixture-assistant-words' },
				words + ' words · ' + headings + ' headings'
			),
			el(
				Notice,
				{
					status: words > 300 ? 'success' : 'info',
					isDismissible: false,
				},
				words > 300
					? 'Good length for a page.'
					: 'Pages over 300 words tend to do better in search.'
			),
			el(
				'ul',
				null,
				el( 'li', null, 'Try a shorter first sentence.' ),
				el( 'li', null, 'Add a heading every few paragraphs.' )
			),
			el( TextareaControl, {
				__nextHasNoMarginBottom: true,
				label: 'Ask the assistant',
				value: '',
				onChange: () => {},
			} )
		);
	}

	register( 'cnl-fixture-assistant', {
		icon: 'lightbulb',
		render: () =>
			el(
				PluginSidebar,
				{
					name: 'assistant',
					title: 'Writing Assistant',
					icon: 'lightbulb',
				},
				el( AssistantPanel )
			),
	} );

	// A tour that opens its own sidebar once the editor loads, as onboarding
	// plugins do, and a menu item that toggles it the old way.
	function TourAutoOpen() {
		useEffect( () => {
			if ( window.sessionStorage.getItem( 'cnlFixtureTourShown' ) ) {
				return;
			}
			window.sessionStorage.setItem( 'cnlFixtureTourShown', '1' );
			dispatch( 'core/interface' ).enableComplementaryArea(
				'core',
				'cnl-fixture-tour/tour'
			);
		}, [] );
		return null;
	}

	register( 'cnl-fixture-tour', {
		icon: 'welcome-learn-more',
		render: () =>
			el(
				Fragment,
				null,
				el( TourAutoOpen ),
				el(
					PluginSidebar,
					{
						name: 'tour',
						title: 'Getting Started',
						icon: 'welcome-learn-more',
					},
					el(
						PanelBody,
						null,
						el( 'p', null, 'Step 1 of 3: give your page a title.' ),
						el( Button, { variant: 'primary' }, 'Next step' )
					)
				),
				el(
					PluginMoreMenuItem,
					{
						icon: 'welcome-learn-more',
						onClick: () => {
							const editPost = dispatch( 'core/edit-post' );
							if ( editPost?.openGeneralSidebar ) {
								editPost.openGeneralSidebar(
									'cnl-fixture-tour/tour'
								);
								return;
							}
							dispatch(
								'core/interface'
							).enableComplementaryArea(
								'core',
								'cnl-fixture-tour/tour'
							);
						},
					},
					'Restart the tour'
				)
			),
	} );

	// Sharing, as Jetpack Social does: asked before publishing, saved with
	// the post, and confirmed after.
	function SharePrePublish() {
		const message = useSelect(
			( selectStore ) =>
				selectStore( editorStore ).getEditedPostAttribute( 'meta' )
					?.cnl_fixture_share_message ?? '',
			[]
		);
		const { editPost } = useDispatch( editorStore );
		const [ networks, setNetworks ] = useState( {
			mastodon: true,
			bluesky: true,
		} );
		return el(
			Fragment,
			null,
			el( TextareaControl, {
				__nextHasNoMarginBottom: true,
				label: 'Message',
				value: message,
				onChange: ( value ) =>
					editPost( { meta: { cnl_fixture_share_message: value } } ),
			} ),
			el( CheckboxControl, {
				__nextHasNoMarginBottom: true,
				label: 'Mastodon',
				checked: networks.mastodon,
				onChange: ( mastodon ) =>
					setNetworks( { ...networks, mastodon } ),
			} ),
			el( CheckboxControl, {
				__nextHasNoMarginBottom: true,
				label: 'Bluesky',
				checked: networks.bluesky,
				onChange: ( bluesky ) =>
					setNetworks( { ...networks, bluesky } ),
			} )
		);
	}

	register( 'cnl-fixture-social', {
		icon: 'share',
		render: () =>
			el(
				Fragment,
				null,
				el(
					PluginPrePublishPanel,
					{
						title: 'Share when published',
						initialOpen: true,
						icon: 'share',
					},
					el( SharePrePublish )
				),
				el(
					PluginPostPublishPanel,
					{ title: 'Shared', initialOpen: true, icon: 'share' },
					el(
						'p',
						{ 'data-testid': 'cnl-fixture-shared' },
						'Shared to Mastodon and Bluesky.'
					),
					el(
						Button,
						{
							variant: 'secondary',
							onClick: () => notify( 'Shared again.' ),
						},
						'Share again'
					)
				)
			),
	} );

	register( 'cnl-fixture-readability', {
		icon: 'editor-spellcheck',
		render: () =>
			el(
				Fragment,
				null,
				el(
					PluginPostStatusInfo,
					null,
					el( 'span', null, 'Readability' ),
					el( 'strong', null, 'Good' )
				),
				el(
					PluginDocumentSettingPanel,
					{
						name: 'readability',
						title: 'Readability',
						icon: 'editor-spellcheck',
					},
					el( 'p', null, 'Flesch reading ease: 68 (fairly easy).' ),
					el( 'p', null, 'Passive voice: 4% of sentences.' )
				)
			),
	} );

	register( 'cnl-fixture-tools', {
		icon: 'admin-tools',
		render: () =>
			el(
				Fragment,
				null,
				el(
					PluginMoreMenuItem,
					{
						icon: 'media-text',
						onClick: () => notify( 'Copied as Markdown.' ),
					},
					'Copy as Markdown'
				),
				PluginPreviewMenuItem &&
					el(
						PluginPreviewMenuItem,
						{
							icon: 'share-alt2',
							onClick: () =>
								notify( 'Social card preview opened.' ),
						},
						'Preview social card'
					)
			),
	} );

	register( 'cnl-fixture-blocks', {
		icon: 'block-default',
		render: () =>
			el( PluginBlockSettingsMenuItem, {
				allowedBlocks: [ 'core/paragraph', 'core/heading' ],
				icon: 'admin-links',
				label: 'Copy link to block',
				onClick: () => notify( 'Link to block copied.' ),
			} ),
	} );

	// Settings on a block, through the inspector rather than a plugin slot.
	if ( ! only || only.includes( 'cnl-fixture-blocks' ) ) {
		const { InspectorControls } = wp.blockEditor;
		wp.hooks.addFilter(
			'editor.BlockEdit',
			'cnl-fixture/highlight',
			wp.compose.createHigherOrderComponent(
				( BlockEdit ) => ( props ) => {
					if ( props.name !== 'core/paragraph' ) {
						return el( BlockEdit, props );
					}
					return el(
						Fragment,
						null,
						el( BlockEdit, props ),
						el(
							InspectorControls,
							null,
							el(
								PanelBody,
								{ title: 'Highlight (Block Tools)' },
								el( ToggleControl, {
									__nextHasNoMarginBottom: true,
									label: 'Highlight this paragraph',
									checked: false,
									onChange: () => notify( 'Highlighted.' ),
								} )
							)
						)
					);
				},
				'withCnlFixtureHighlight'
			)
		);
	}

	// Commands only: no editor UI at all.
	function Shortcuts() {
		wp.commands.useCommand( {
			name: 'cnl-fixture/insert-date',
			label: "Insert today's date",
			icon: 'calendar',
			callback: ( { close } ) => {
				notify( new Date().toDateString() );
				close();
			},
		} );
		return null;
	}

	register( 'cnl-fixture-shortcuts', { render: Shortcuts } );

	// Stats: content wider than a sidebar is.
	register( 'cnl-fixture-stats', {
		icon: 'chart-bar',
		render: () =>
			el(
				Fragment,
				null,
				el(
					PluginSidebar,
					{ name: 'stats', title: 'Page Stats', icon: 'chart-bar' },
					el(
						PanelBody,
						null,
						el(
							'div',
							{ style: { overflowX: 'auto' } },
							el(
								'table',
								{
									style: {
										minWidth: 480,
										borderCollapse: 'collapse',
									},
								},
								el(
									'thead',
									null,
									el(
										'tr',
										null,
										[
											'Day',
											'Views',
											'Visitors',
											'Likes',
											'Comments',
											'Shares',
										].map( ( h ) =>
											el(
												'th',
												{
													key: h,
													style: {
														textAlign: 'left',
														padding: 4,
													},
												},
												h
											)
										)
									)
								),
								el(
									'tbody',
									null,
									[
										'Mon',
										'Tue',
										'Wed',
										'Thu',
										'Fri',
										'Sat',
										'Sun',
									].map( ( day, i ) =>
										el(
											'tr',
											{ key: day },
											[
												day,
												120 + i * 7,
												80 + i * 5,
												i,
												i * 2,
												i + 1,
											].map( ( v, j ) =>
												el(
													'td',
													{
														key: j,
														style: { padding: 4 },
													},
													String( v )
												)
											)
										)
									)
								)
							)
						)
					)
				),
				el(
					PluginDocumentSettingPanel,
					{
						name: 'stats-summary',
						title: 'Stats',
						icon: 'chart-bar',
					},
					el( 'p', null, '1,204 views in the last 30 days.' )
				)
			),
	} );
} )();
