// Configuración flat de ESLint basada en las reglas oficiales de Expo, excluyendo el build dist/.

const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([globalIgnores(["dist/*"]), expoConfig]);
