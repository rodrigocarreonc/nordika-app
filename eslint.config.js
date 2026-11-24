// ESLint flat config based on Expo's official rules, ignoring the dist/ build.

const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([globalIgnores(["dist/*"]), expoConfig]);
