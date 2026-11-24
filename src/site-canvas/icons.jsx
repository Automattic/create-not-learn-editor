/**
 * The site canvas's own icons, for what `@wordpress/icons` has nothing for.
 * Drawn on the same 24px grid.
 */

/**
 * Internal dependencies
 */
const SVG_PROPS = {
	viewBox: '0 0 24 24',
	xmlns: 'http://www.w3.org/2000/svg',
};

// A page built from stacked sections, one of them picked.
export const sectionsIcon = (
	<svg { ...SVG_PROPS } fill="currentColor">
		<path
			clipRule="evenodd"
			d="M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v3h13V6a.5.5 0 00-.5-.5H6zm12.5 5h-13v3h13v-3zm0 4.5h-13v3a.5.5 0 00.5.5h12a.5.5 0 00.5-.5v-3z"
			fillRule="evenodd"
		/>
		<path d="M5.5 10.5h13v3h-13z" />
	</svg>
);

// Stroke icons, drawn as `@wordpress/icons`' current set is, for Document
// Overview's Details and Layers, which it has nothing for. Each path says
// `fill="none"`, as buttons fill their icons' SVGs.
const STROKE_PROPS = {
	...SVG_PROPS,
	fill: 'none',
	stroke: 'currentColor',
	strokeWidth: 1.5,
};

// A page with an "i" on it: what this page is, rather than what is on it.
export const documentInfoIcon = (
	<svg { ...STROKE_PROPS }>
		<path
			d="M18.25 18V6C18.25 5.30964 17.6904 4.75 17 4.75H7C6.30964 4.75 5.75 5.30964 5.75 6V18C5.75 18.6904 6.30964 19.25 7 19.25H17C17.6904 19.25 18.25 18.6904 18.25 18Z"
			fill="none"
			strokeLinejoin="round"
			vectorEffect="non-scaling-stroke"
		/>
		<path
			d="M12 16V11M12 9.5V8"
			fill="none"
			strokeLinejoin="round"
			vectorEffect="non-scaling-stroke"
		/>
	</svg>
);

// Sheets stacked one on another, as design tools draw layers.
export const layersIcon = (
	<svg { ...STROKE_PROPS }>
		<path
			d="M12 4.75L19.25 8.5L12 12.25L4.75 8.5L12 4.75Z"
			fill="none"
			strokeLinejoin="round"
			vectorEffect="non-scaling-stroke"
		/>
		<path
			d="M4.75 12L12 15.75L19.25 12M4.75 15.5L12 19.25L19.25 15.5"
			fill="none"
			strokeLinejoin="round"
			vectorEffect="non-scaling-stroke"
		/>
	</svg>
);
