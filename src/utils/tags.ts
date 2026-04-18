import type { CollectionEntry } from 'astro:content';
import { slugifyStr } from './slugify';

export function getUniqueTags(posts: CollectionEntry<'blog'>[]) {
  const map = new Map<string, string>();

  for (const post of posts) {
    for (const tagName of post.data.tags ?? []) {
      const tag = slugifyStr(tagName);
      if (!map.has(tag)) map.set(tag, tagName);
    }
  }

  return Array.from(map.entries())
    .map(([tag, tagName]) => ({ tag, tagName }))
    .sort((a, b) => a.tagName.localeCompare(b.tagName, 'zh-CN'));
}

export function getPostsByTag(posts: CollectionEntry<'blog'>[], tag: string) {
  return posts.filter(post => (post.data.tags ?? []).some(item => slugifyStr(item) === tag));
}
