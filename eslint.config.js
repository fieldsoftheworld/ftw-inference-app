var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import pluginVitest from '@vitest/eslint-plugin';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pluginCypress from 'eslint-plugin-cypress/flat';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup
export default defineConfigWithVueTs({
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
}, globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']), pluginVue.configs['flat/essential'], vueTsConfigs.recommended, __assign(__assign({}, pluginVitest.configs.recommended), { files: ['src/**/__tests__/*'] }), __assign(__assign({}, pluginCypress.configs.recommended), { files: [
        'cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}',
        'cypress/support/**/*.{js,ts,jsx,tsx}'
    ] }), skipFormatting);
