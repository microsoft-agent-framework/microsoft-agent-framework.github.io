import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://microsoft-agent-framework.github.io',
  base: '/',
  output: 'static',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.endsWith('/sitemap.xml')
    })
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  }
});
