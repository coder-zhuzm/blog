// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { SITE } from './src/consts';

// https://astro.build/config
export default defineConfig({
	site: SITE.website,
	integrations: [mdx(), sitemap()],
	markdown: {
		shikiConfig: {
			themes: { light: 'min-light', dark: 'night-owl' },
			wrap: true,
		},
	},
	vite: {
		plugins: [tailwindcss()],
	},
	image: {
		responsiveStyles: true,
		layout: 'constrained',
	},
});
