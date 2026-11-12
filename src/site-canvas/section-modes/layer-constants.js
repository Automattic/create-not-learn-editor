/**
 * Sizes and timings for the section layer.
 */

export const CONTENT_REGION = '.interface-interface-skeleton__content';

export const STYLE_ID = 'cnl-section-modes';
export const GLOBAL_STYLE_ID = 'cnl-section-modes-global';

// Sizes on screen, in pixels.
export const BAR_HEIGHT = 40;
// Narrower than this, the bar puts its modes on a row of their own.
export const NARROW_WIDTH = 760;
export const BAR_ROW_GAP = 8;
// The "Add section" buttons' height. Centred on a section's edges, they
// reach half of it into the section, and the bar keeps clear of that.
export const ADD_SECTION_HEIGHT = 32;
export const BAR_GAP = 8;
// The bar naming the mode sits inside a section at least this big, at its
// top, the size of the bar over a section pointed at; a smaller section has
// a smaller one outside it, so it hides none of what is being edited.
export const MODE_BAR_ROOM_HEIGHT = 240;
export const MODE_BAR_ROOM_WIDTH = 480;
export const SMALL_MODE_BAR_HEIGHT = 40;
// Between the small bar and the section's edge.
export const MODE_BAR_GAP = 6;
// Edit design's bar is never narrower than this, even on a narrow section.
export const DESIGN_BAR_MIN_WIDTH = 360;
// Edit design's bar is never shorter than this, scrolling its tray rather
// than running off the canvas.
export const DESIGN_BAR_MIN_HEIGHT = 200;
// Between a short section and its bar, under it, clear of "Add section" on
// its bottom edge.
export const SHORT_BAR_GAP = 22;
// The gap opened for adding a section in place: room around its picker,
// and the picker's height until it is measured.
export const INLINE_ADD_GAP = 16;
export const INLINE_ADD_HEIGHT = 520;
// The picker's narrowest, wider than a zoomed-out section if need be.
export const INLINE_ADD_MIN_WIDTH = 560;
// How long its gap takes to open, before it is scrolled into view.
export const INLINE_ADD_SETTLE_MS = 260;
// How long a new block is kept focused while it settles, in frames.
export const FOCUS_FRAMES = 30;
// The longest a page just opened is given to load its pictures, which move
// what is under them, before a section on it is scrolled to.
export const LOAD_WAIT_MS = 2000;
export const LOAD_POLL_MS = 100;

// How long a new item is highlighted.
export const FRESH_MS = 900;

export const EMPTY_ARRAY = [];
