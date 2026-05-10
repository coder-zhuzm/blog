# zhuzm Blog

一个基于 [Astro](https://astro.build/) 构建的个人中文博客，主要记录技术实践、方法研究与阶段性工作笔记。

## 内容方向

- 软件开发与工具实践
- 工作流、知识管理与自动化方法
- AI 辅助开发与长期协作笔记
- 可复用的问题排查与经验总结

## 技术栈

- Astro
- TypeScript
- Tailwind CSS
- Pagefind
- MD / MDX 内容管理

## 项目结构

```text
src/content/blog/   博客文章
src/content/notes/  工作笔记
src/components/     页面组件
src/layouts/        页面布局
src/pages/          路由页面
public/             静态资源
```

## 本地开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
```

构建产物输出到 `dist/`，适合部署到 Cloudflare Pages 等静态托管平台。
