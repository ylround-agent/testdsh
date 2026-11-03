#!/usr/bin/env node
/*
 * 教材目录自检：
 *   node scripts/check-textbooks.mjs
 *   node scripts/check-textbooks.mjs --remote   # 额外检查 PDF 链接可访问
 *
 * 不检查版权内容，只检查 books.json 的结构、URL、单元页码和本地副本。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(ROOT, 'textbooks', 'assets', 'books.json');
const remote = process.argv.includes('--remote');
const errors = [];
const warnings = [];

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`无法读取 ${path.relative(ROOT, manifestPath)}：${error.message}`);
  process.exit(1);
}

const books = manifest.books || [];
if (!Array.isArray(books) || !books.length) errors.push('books 必须是非空数组');
if (!manifest.source || !manifest.source.url) warnings.push('缺少 source.url（教材来源说明）');

const ids = new Set();
const subjects = new Set(['chinese', 'math', 'english']);
const required = ['id', 'subject', 'label', 'title', 'edition', 'grade', 'pdf', 'units'];

for (const book of books) {
  const label = book.id || '(缺少 id)';
  for (const field of required) {
    if (!book[field]) errors.push(`${label}: 缺少 ${field}`);
  }
  if (ids.has(book.id)) errors.push(`${label}: id 重复`);
  ids.add(book.id);
  if (book.subject && !subjects.has(book.subject)) errors.push(`${label}: subject 必须是 ${[...subjects].join(' / ')}`);
  if (book.pdf) {
    try {
      const url = new URL(book.pdf);
      if (url.protocol !== 'https:') errors.push(`${label}: pdf 必须是 https URL`);
      if (!/\.pdf$/i.test(decodeURIComponent(url.pathname))) warnings.push(`${label}: pdf URL 不以 .pdf 结尾`);
    } catch (error) {
      errors.push(`${label}: pdf URL 无效（${book.pdf}）`);
    }
  }
  if (book.localPdf) {
    const localPath = path.join(ROOT, 'textbooks', book.localPdf);
    if (existsSync(localPath)) {
      const header = readFileSync(localPath).subarray(0, 5).toString('latin1');
      if (header !== '%PDF-') errors.push(`${label}: 本地副本不是 PDF（${book.localPdf}）`);
    }
  }
  if (!Array.isArray(book.units) || !book.units.length) {
    errors.push(`${label}: units 必须是非空数组`);
    continue;
  }
  let lastPage = 0;
  const unitNames = new Set();
  book.units.forEach((unit, index) => {
    const unitLabel = `${label} 第 ${index + 1} 个单元`;
    if (!unit.no) errors.push(`${unitLabel}: 缺少 no`);
    if (!unit.title) errors.push(`${unitLabel}: 缺少 title`);
    if (unitNames.has(unit.no)) errors.push(`${unitLabel}: 单元名重复（${unit.no}）`);
    unitNames.add(unit.no);
    if (!Array.isArray(unit.lessons) || !unit.lessons.length) errors.push(`${unitLabel}: lessons 必须是非空数组`);
    if (!Array.isArray(unit.points) || !unit.points.length) errors.push(`${unitLabel}: points 必须是非空数组`);
    if (typeof unit.inQuiz !== 'boolean') errors.push(`${unitLabel}: inQuiz 必须是布尔值`);
    if (unit.page != null) {
      if (!Number.isInteger(unit.page) || unit.page < 1) errors.push(`${unitLabel}: page 必须是正整数`);
      else if (unit.page <= lastPage) errors.push(`${unitLabel}: page 必须递增（${unit.page} <= ${lastPage}）`);
      else lastPage = unit.page;
    } else {
      warnings.push(`${unitLabel}: 没有 page，目录只能展示不能跳页`);
    }
  });
}

if (remote) {
  console.log('检查远程 PDF 链接（--remote）…');
  for (const book of books) {
    if (!book.pdf) continue;
    try {
      const response = await fetch(book.pdf, { method: 'HEAD', redirect: 'follow' });
      const size = Number(response.headers.get('content-length')) || 0;
      const type = response.headers.get('content-type') || '';
      if (!response.ok) errors.push(`${book.id}: 远程 PDF 返回 HTTP ${response.status}`);
      else if (size && size < 100000) warnings.push(`${book.id}: 远程 PDF 只有 ${size} 字节`);
      else console.log(`  ✓ ${book.label} ${book.grade} · HTTP ${response.status} · ${(size / 1024 / 1024).toFixed(1)} MB · ${type}`);
    } catch (error) {
      errors.push(`${book.id}: 远程 PDF 请求失败（${error.message}）`);
    }
  }
}

if (warnings.length) {
  console.log(`提示（${warnings.length} 项）：`);
  warnings.forEach((warning) => console.log(`  - ${warning}`));
}

if (errors.length) {
  console.error(`\n教材目录自检失败（${errors.length} 项）：`);
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

console.log(`\n教材目录自检通过：${books.length} 本教材，${books.reduce((sum, book) => sum + book.units.length, 0)} 个单元。`);
