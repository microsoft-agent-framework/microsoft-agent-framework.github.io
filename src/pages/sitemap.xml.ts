import type { APIRoute } from 'astro';
import { getLearningPaths, getTutorials } from '@/lib/tutorials';

const SITE_URL = 'https://microsoft-agent-framework.github.io';

function toAbsoluteUrl(pathname: string) {
  return new URL(pathname, SITE_URL).toString();
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export const GET: APIRoute = async () => {
  const [learningPaths, tutorials] = await Promise.all([getLearningPaths(), getTutorials()]);
  const urls = new Set<string>([toAbsoluteUrl('/'), toAbsoluteUrl('/paths/'), toAbsoluteUrl('/tutorials/')]);

  for (const path of learningPaths) {
    urls.add(toAbsoluteUrl(`/learn/${path.slug}/`));
    urls.add(toAbsoluteUrl(`/paths/${path.slug}/`));

    for (const series of path.series) {
      urls.add(toAbsoluteUrl(`/paths/${path.slug}/${series.slug}/`));
    }
  }

  for (const tutorial of tutorials) {
    urls.add(toAbsoluteUrl(`/learn/${tutorial.categorySlug}/${tutorial.slug}/`));
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...urls].map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
    '</urlset>'
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
