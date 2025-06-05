import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [ 
		tailwindcss(),
		sveltekit(),
	],
	define: {
		global: 'globalThis',
	},
	optimizeDeps: {
		include: ['@xenova/transformers']
	},
	server: {
		fs: {
			allow: ['..']
		}
	}
});
