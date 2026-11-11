/**
 * The editor's WebMCP tools as an agent sees them: names, descriptions and
 * inputs. What they do is in `tools.js`, which loads the first time one is
 * called. See the README's "Driving the editor with WebMCP".
 *
 * Kept free of WordPress packages, as app init imports it.
 */

const SECTION = {
	type: 'integer',
	minimum: 1,
	description:
		'The section, by its number in the outline from cnl-get-page, counting from 1 at the top of the page.',
};

const READ_ONLY = { readOnlyHint: true };
const CHANGES = { readOnlyHint: false };

export const TOOLS = [
	{
		name: 'cnl-list-pages',
		description:
			"List the site's pages: each one's ID, title and status, which one is the homepage, and which one is open in the editor's canvas. Changes nothing.",
		inputSchema: { type: 'object', properties: {} },
		annotations: READ_ONLY,
	},
	{
		name: 'cnl-open-page',
		description:
			"Open a page in the editor's canvas, ready to change, as the person would from Go to page. Returns the page's outline, as cnl-get-page does.",
		inputSchema: {
			type: 'object',
			properties: {
				page: {
					type: 'string',
					description:
						'The page: its ID, its title, or "home" for the homepage.',
				},
			},
			required: [ 'page' ],
		},
		annotations: READ_ONLY,
	},
	{
		name: 'cnl-get-page',
		description:
			"Read the page open in the editor's canvas as the editor shows it: a numbered list of its sections, top to bottom, each with its name and what is in it. Each section also lists the colours, layouts and widths it can take, and which it has now, for cnl-style-section. Runs of plain text between sections count as one Text section, as on the canvas. Call this before changing a section, as section numbers change when sections are added, moved or removed. Changes nothing.",
		inputSchema: { type: 'object', properties: {} },
		annotations: READ_ONLY,
	},
	{
		name: 'cnl-get-designs',
		description:
			"List the section designs that can be added to a page with cnl-add-section, the site's theme's own first. Changes nothing.",
		inputSchema: {
			type: 'object',
			properties: {
				search: {
					type: 'string',
					description:
						"Words to look for in a design's name, description or keywords.",
				},
			},
		},
		annotations: READ_ONLY,
	},
	{
		name: 'cnl-get-site-style',
		description:
			"Read the site's look: the looks, colour palettes and font pairings its theme offers, which ones are in use, and the site's title and tagline. Changes nothing.",
		inputSchema: { type: 'object', properties: {} },
		annotations: READ_ONLY,
	},
	{
		name: 'cnl-get-changes',
		description:
			"List the changes waiting to be saved, as the editor's Review changes lists them. Each says whether it shows on every page of the site or only on one. Changes nothing.",
		inputSchema: { type: 'object', properties: {} },
		annotations: READ_ONLY,
	},
	{
		name: 'cnl-add-section',
		description:
			"Add a section to the page open in the canvas: one of the designs from cnl-get-designs, or a blank section to fill in. The section shows on the canvas at once, picked, as an unsaved change. Returns the page's new outline.",
		inputSchema: {
			type: 'object',
			properties: {
				design: {
					type: 'string',
					description:
						'The design, by its name or title from cnl-get-designs. Leave out for a blank section.',
				},
				after: {
					type: 'integer',
					minimum: 0,
					description:
						'The number of the section to add it after, or 0 for the top of the page. Leave out to add it at the end.',
				},
			},
		},
		annotations: CHANGES,
	},
	{
		name: 'cnl-move-section',
		description:
			'Move a section of the page open in the canvas to another place on it. Returns the new outline.',
		inputSchema: {
			type: 'object',
			properties: {
				section: SECTION,
				to: {
					type: 'integer',
					minimum: 1,
					description:
						'The number the section should have once moved, counting from 1 at the top.',
				},
			},
			required: [ 'section', 'to' ],
		},
		annotations: CHANGES,
	},
	{
		name: 'cnl-duplicate-section',
		description:
			'Copy a section of the page open in the canvas. The copy goes just below it. Returns the new outline.',
		inputSchema: {
			type: 'object',
			properties: { section: SECTION },
			required: [ 'section' ],
		},
		annotations: CHANGES,
	},
	{
		name: 'cnl-remove-section',
		description:
			'Remove a section from the page open in the canvas. It can be got back with Undo in the editor until the page is saved. Returns the new outline.',
		inputSchema: {
			type: 'object',
			properties: { section: SECTION },
			required: [ 'section' ],
		},
		annotations: { readOnlyHint: false, destructiveHint: true },
	},
	{
		name: 'cnl-style-section',
		description:
			"Change how a section of the page open in the canvas looks, with the choices the editor's Edit design offers it: its colour, its layout and how wide it runs. Give any of them. The choices each section takes are in cnl-get-page. A layout rearranges the section's own content, so nothing is lost. Returns the new outline.",
		inputSchema: {
			type: 'object',
			properties: {
				section: SECTION,
				color: {
					type: 'string',
					description:
						'A colour from the section\'s colour options, or "Default" for the theme\'s own.',
				},
				layout: {
					type: 'string',
					description: "A layout from the section's layout options.",
				},
				width: {
					type: 'string',
					enum: [ 'narrow', 'wide', 'full' ],
					description: "How wide the section's content runs.",
				},
			},
			required: [ 'section' ],
		},
		annotations: CHANGES,
	},
	{
		name: 'cnl-set-site-style',
		description:
			"Change the look of the whole site, on every page: a look from its theme, a colour palette, a font pairing, or any of them together, by name from cnl-get-site-style. A look sets colours and fonts too, so a palette or fonts given with it go on top. Returns the site's look as it is now.",
		inputSchema: {
			type: 'object',
			properties: {
				look: {
					type: 'string',
					description:
						'A look, or "Theme default" for the theme\'s own.',
				},
				palette: {
					type: 'string',
					description:
						'A colour palette, or "Theme colors" for the theme\'s own.',
				},
				fonts: {
					type: 'string',
					description:
						'A font pairing, or "Theme fonts" for the theme\'s own.',
				},
			},
		},
		annotations: CHANGES,
	},
	{
		name: 'cnl-set-site-title',
		description:
			"Change the site's title, its name on every page, and its tagline, the short line some themes show with it.",
		inputSchema: {
			type: 'object',
			properties: {
				title: { type: 'string', description: 'The site title.' },
				tagline: { type: 'string', description: 'The tagline.' },
			},
		},
		annotations: CHANGES,
	},
];
