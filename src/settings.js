export const settings = window.createNotLearnEditor || {};

export const namespace = settings.restNamespace || 'create-not-learn-editor/v1';

export function getPostTypes() {
	return settings.postTypes || [];
}

export function getEditablePostTypes() {
	return settings.editablePostTypes || getPostTypes();
}

export function getPostType( name ) {
	return getPostTypes().find( ( type ) => type.name === name );
}

export function getEditablePostType( name ) {
	return getEditablePostTypes().find( ( type ) => type.name === name );
}

export function getNavigationRestBase() {
	return settings.navigationRestBase || 'navigation';
}
