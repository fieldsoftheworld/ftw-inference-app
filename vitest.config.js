var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { fileURLToPath } from 'node:url';
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config';
import viteConfig from './vite.config';
import vue from '@vitejs/plugin-vue';
export default mergeConfig(viteConfig, defineConfig({
    plugins: [vue()],
    test: {
        globals: true,
        environment: 'jsdom',
        exclude: __spreadArray(__spreadArray([], configDefaults.exclude, true), ['e2e/**'], false),
        root: fileURLToPath(new URL('./', import.meta.url)),
    },
}));
