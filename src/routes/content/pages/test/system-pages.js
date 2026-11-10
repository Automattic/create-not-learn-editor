/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock( '../../../../wordpress-packages', async () => ( {
	...( await vi.importActual( '@wordpress/i18n' ) ),
	calendarIcon: 'calendar',
	categoryIcon: 'category',
	notFoundIcon: 'not-found',
	postListIcon: 'post-list',
	searchIcon: 'search',
	tagIcon: 'tag',
	userIcon: 'user',
} ) );
vi.mock( '../../../../records', () => ( {
	getTemplateDisplayDescription: ( template ) =>
		template?.slug === 'search'
			? 'What people see after they search your site.'
			: '',
} ) );

/**
 * Internal dependencies
 */
import {
	getSystemPage,
	getSystemPageTemplates,
	isSystemPageTemplate,
} from '../system-pages';

describe( 'isSystemPageTemplate', () => {
	test( 'knows the templates WordPress makes pages from', () => {
		expect( isSystemPageTemplate( { slug: '404' } ) ).toBe( true );
		expect( isSystemPageTemplate( { slug: 'search' } ) ).toBe( true );
		expect( isSystemPageTemplate( { slug: 'category' } ) ).toBe( true );
	} );

	test( 'leaves out layouts for pages and posts', () => {
		expect( isSystemPageTemplate( { slug: 'page' } ) ).toBe( false );
		expect( isSystemPageTemplate( { slug: 'single' } ) ).toBe( false );
		expect( isSystemPageTemplate( { slug: 'index' } ) ).toBe( false );
		expect( isSystemPageTemplate( null ) ).toBe( false );
	} );
} );

describe( 'getSystemPageTemplates', () => {
	test( 'lists only the ones the site has, not found first', () => {
		const templates = [
			{ id: 'theme//archive', slug: 'archive' },
			{ id: 'theme//category', slug: 'category' },
			{ id: 'theme//page', slug: 'page' },
			{ id: 'theme//search', slug: 'search' },
			{ id: 'theme//404', slug: '404' },
		];

		expect(
			getSystemPageTemplates( templates ).map( ( { slug } ) => slug )
		).toEqual( [ '404', 'search', 'category' ] );
	} );
} );

describe( 'getSystemPage', () => {
	test( 'names a system page plainly', () => {
		const page = getSystemPage( { slug: 'search' } );

		expect( page.title ).toBe( 'Search results' );
		expect( page.description ).toBe(
			'What people see after they search your site.'
		);
		expect( page.icon ).toBe( 'search' );
	} );
} );
