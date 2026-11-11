/**
 * The parts of app init that nothing needs until someone opens them, too big
 * to hold up page boot: the editor's section picker, and what the WebMCP
 * tools do. App init fetches this module once the page has settled. See
 * `src/app-init-deferred.js`.
 *
 * Nothing here reaches the editor, so fetching it early doesn't load the
 * editor with it.
 */
export { EditorSectionPicker } from '../../../src/editor-layer/section-picker';
export { runWebMcpTool } from '../../../src/webmcp/tools';
export { showChange as showWebMcpChange } from '../../../src/webmcp/flash';
