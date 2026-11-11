# Vendored ListView bridge

Gutenberg's full ListView implementation is currently exposed only as a private `@wordpress/block-editor` API. This plugin temporarily vendors that ListView as a narrow exception to the normal no-copied-source rule.

The vendored source lives in:

```text
src/vendor/gutenberg/list-view
```

Do not edit those files by hand. Regenerate them with:

```sh
npm run sync:list-view
```

The sync script copies from the installed, lockfile-pinned `@wordpress/block-editor` package, applies the minimal local patch in `patches/gutenberg-list-view.patch`, rewrites known internal imports to plugin-local compatibility shims, and writes `provenance.json` with the upstream package version, git head, copied files, and patch checksum.

The local patch is limited to the prototype appender extension points (`renderAppender` and `appenderParentClientId`). When Gutenberg exposes the required ListView API publicly, replace `src/list-view.js` with the public package import and remove this bridge.
