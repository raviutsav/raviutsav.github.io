import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const title = args.join(' ').trim();

if (!title) {
  console.log('\n❌ Please provide a title for your post.');
  console.log('   Example: npm run new-post "Understanding Distributed Systems"\n');
  process.exit(1);
}

// Convert title to a clean URL-friendly slug
const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const today = new Date().toISOString().split('T')[0];
const targetDir = path.join(process.cwd(), 'src', 'content', 'blog');
const targetFile = path.join(targetDir, `${slug}.md`);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (fs.existsSync(targetFile)) {
  console.log(`\n⚠️  A post with this slug already exists:`);
  console.log(`   ${targetFile}\n`);
  process.exit(1);
}

const content = `---
title: "${title}"
description: "A short summary of this article."
pubDate: ${today}
tags: ["Engineering"]
draft: false
---

Write your article here in standard Markdown.

## Introduction

Your introduction goes here...
`;

fs.writeFileSync(targetFile, content, 'utf8');

console.log(`\n✨ Successfully created new post!`);
console.log(`   File: src/content/blog/${slug}.md`);
console.log(`   You can now open it and start writing.\n`);
