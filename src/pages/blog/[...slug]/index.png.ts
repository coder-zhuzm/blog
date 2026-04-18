import { Resvg } from '@resvg/resvg-js';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

function escapeXml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts
    .filter(post => !post.data.heroImage)
    .map(post => ({
      params: { slug: post.id },
      props: { post },
    }));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as Awaited<ReturnType<typeof getCollection>>[number] extends infer T ? { post: T } : never;
  const title = escapeXml(post.data.title);
  const description = escapeXml(post.data.description);

  const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="#fdfdfd"/>
      <rect x="48" y="48" width="1104" height="534" rx="24" fill="#ffffff" stroke="#ece9e9" stroke-width="2"/>
      <text x="92" y="160" fill="#006cac" font-size="32" font-family="sans-serif">zhuzm Blog</text>
      <text x="92" y="270" fill="#282728" font-size="64" font-weight="700" font-family="sans-serif">${title}</text>
      <text x="92" y="370" fill="#4b5563" font-size="30" font-family="sans-serif">${description}</text>
      <text x="92" y="520" fill="#6b7280" font-size="24" font-family="sans-serif">${post.id}</text>
    </svg>
  `;

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'sans-serif',
    },
  });

  const pngData = resvg.render().asPng();
  return new Response(pngData, {
    headers: { 'Content-Type': 'image/png' },
  });
};
