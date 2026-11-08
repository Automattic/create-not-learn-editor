/**
 * The chat's bigger pickers, from the chat-extras module, loaded the first
 * time one is shown. See `packages/chat-extras`.
 */

/**
 * Internal dependencies
 */
import { createModuleLoader } from '../module-loader';
import { useLoadedModule } from '../use-loaded-module';

/*
 * Held in a variable so the build leaves the import for the browser to
 * resolve through the import map, where PHP registers the module.
 */
const EXTRAS_MODULE = '@create-not-learn-editor/chat-extras';

const loader = createModuleLoader(
	() => import( /* webpackIgnore: true */ EXTRAS_MODULE )
);

/**
 * @return {?Object} The chat-extras module, or `null` until it has loaded.
 */
export function useChatExtras() {
	return useLoadedModule( loader );
}
