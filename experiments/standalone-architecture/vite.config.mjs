import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({build:{rolldownOptions:{input:{inspector:fileURLToPath(new URL('./index.html',import.meta.url)),renderers:fileURLToPath(new URL('./renderers.html',import.meta.url))}}}});
