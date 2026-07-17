const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// calorie-tracker-shared (mobile/node_modules/calorie-tracker-shared, a
// "file:../shared" dependency) is a real symlink out to shared/. Watching
// the monorepo root lets Metro's dev server pick up edits to the real files
// behind that symlink, not just the mobile/ subtree.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
