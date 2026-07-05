// oxlint JS-plugin shim — oxlint can't resolve npm subpath exports, so this
// local file re-exports the plugin's `./oxlint` entry (Node require honors the
// exports map). Referenced by `.oxlintrc.json` jsPlugins via relative path.
// One shim per plugin (configure each plugin separately).
module.exports = require('eslint-plugin-react-features/oxlint');
