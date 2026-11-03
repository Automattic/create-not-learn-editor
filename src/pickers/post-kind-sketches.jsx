/**
 * A small drawing of each kind of post, as it looks when written: a title
 * and lines for a post, lines alone for a note, a picture for a photo. They
 * say what each kind is faster than words can.
 *
 * Drawn in `currentColor` at three strengths, so the picker colours them,
 * and a hovered or focused kind takes the brand colour.
 */

// How strongly a shape is drawn: the thing itself, its text, its ground.
const INK = { fill: 'currentColor', fillOpacity: 0.62 };
const TEXT = { fill: 'currentColor', fillOpacity: 0.3 };
const GROUND = { fill: 'currentColor', fillOpacity: 0.12 };

function Line( { x = 16, y, width, height = 5, ...props } ) {
	return (
		<rect
			height={ height }
			rx={ height / 2 }
			width={ width }
			x={ x }
			y={ y }
			{ ...TEXT }
			{ ...props }
		/>
	);
}

function Mountains( props ) {
	// Given as attributes, so as strings.
	const [ x, y, width, height ] = [ 'x', 'y', 'width', 'height' ].map(
		( key ) => Number( props[ key ] )
	);
	const base = y + height;

	return (
		<>
			<path
				d={ `M${ x } ${ base } L${ x + width * 0.35 } ${
					y + height * 0.45
				} L${ x + width * 0.6 } ${ base } Z` }
				{ ...INK }
			/>
			<path
				d={ `M${ x + width * 0.4 } ${ base } L${ x + width * 0.7 } ${
					y + height * 0.6
				} L${ x + width } ${ base } Z` }
				{ ...TEXT }
			/>
		</>
	);
}

const SKETCHES = {
	// A tall page: a title, then a good run of text.
	post: (
		<>
			<rect height="10" rx="3" width="76" x="16" y="18" { ...INK } />
			<rect height="10" rx="3" width="48" x="16" y="32" { ...INK } />
			<Line width="88" y="56" />
			<Line width="82" y="66" />
			<Line width="86" y="76" />
			<Line width="54" y="86" />
			<Line width="84" y="102" />
			<Line width="88" y="112" />
			<Line width="40" y="122" />
		</>
	),
	// A post in a small tile, as a theme's own kinds are drawn.
	short: (
		<>
			<rect height="9" rx="3" width="64" x="16" y="14" { ...INK } />
			<Line width="88" y="32" />
			<Line width="82" y="42" />
			<Line width="86" y="52" />
			<Line width="48" y="62" />
		</>
	),
	// A few words and no title.
	note: (
		<>
			<Line { ...INK } width="88" y="26" height="6" />
			<Line { ...INK } width="80" y="38" height="6" />
			<Line { ...INK } width="46" y="50" height="6" />
		</>
	),
	// A line about it, then the page it points to.
	link: (
		<>
			<Line width="70" y="14" />
			<rect height="34" rx="5" width="88" x="16" y="28" { ...GROUND } />
			<rect height="22" rx="3" width="22" x="22" y="34" { ...INK } />
			<Line width="46" x="52" y="38" />
			<Line width="30" x="52" y="48" />
		</>
	),
	// One picture and a caption.
	photo: (
		<>
			<rect height="48" rx="4" width="88" x="16" y="10" { ...GROUND } />
			<Mountains height="30" width="88" x="16" y="28" />
			<rect height="9" rx="4.5" width="9" x="84" y="16" { ...TEXT } />
			<Line width="48" y="66" />
		</>
	),
	// Several pictures together.
	gallery: (
		<>
			<rect height="60" rx="4" width="42" x="16" y="10" { ...GROUND } />
			<Mountains height="26" width="42" x="16" y="44" />
			<rect height="28" rx="4" width="42" x="62" y="10" { ...TEXT } />
			<rect height="28" rx="4" width="42" x="62" y="42" { ...GROUND } />
		</>
	),
	// Big quotation marks, the words, and who said them.
	quote: (
		<>
			<path
				d="M16 30c0-8 4-14 11-16l2 4c-4 2-6 5-6 8h6v12H16V30Zm19 0c0-8 4-14 11-16l2 4c-4 2-6 5-6 8h6v12H35V30Z"
				{ ...INK }
			/>
			<Line { ...INK } width="56" x="54" y="24" height="6" />
			<Line { ...INK } width="44" x="54" y="36" height="6" />
			<Line width="28" x="54" y="54" />
		</>
	),
	// A frame with a play button.
	video: (
		<>
			<rect height="52" rx="5" width="88" x="16" y="12" { ...GROUND } />
			<rect height="22" rx="11" width="32" x="44" y="27" { ...INK } />
			<path
				d="M56 32.5v11l9-5.5-9-5.5Z"
				fill="var(--wpds-color-background-surface-neutral)"
			/>
		</>
	),
};

/**
 * @param {Object}  props        Component props.
 * @param {string}  props.name   Which drawing, from a kind's `sketch`.
 * @param {boolean} props.isTall Whether it fills a tall tile.
 * @return {Element} The drawing.
 */
export default function PostKindSketch( { name, isTall } ) {
	let sketch = SKETCHES[ name ] || SKETCHES.short;

	if ( name === 'post' && ! isTall ) {
		sketch = SKETCHES.short;
	}

	return (
		<svg
			aria-hidden
			className="cnl-post-kinds__sketch"
			focusable="false"
			preserveAspectRatio="xMidYMid meet"
			viewBox={ isTall ? '0 0 120 136' : '0 0 120 76' }
		>
			{ sketch }
		</svg>
	);
}
