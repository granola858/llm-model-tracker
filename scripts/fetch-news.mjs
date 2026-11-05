#!/usr/bin/env node
/**
 * scripts/fetch-news.mjs
 * 供 GitHub Actions 或本地排程執行：
 * 從各大 AI 媒體與官方部落格 RSS / Atom 抓取最新 AI 新聞，
 * 自動分類對應廠商標籤 (OpenAI / Anthropic / Google / Meta / xAI / Mistral / DeepSeek / Qwen)，
 * 並輸出靜態 JSON 至 public/data/news.json 供純前端讀取（零 CORS 問題）。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '../public/data/news.json');

const RSS_SOURCES = [
  {
    name: 'OpenAI News',
    url: 'https://openai.com/news/rss.xml',
    defaultTag: 'OpenAI',
  },
  {
    name: 'Google AI Blog',
    url: 'https://blog.google/technology/ai/rss/',
    defaultTag: 'Google',
  },
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    defaultTag: null,
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    defaultTag: null,
  },
  {
    name: 'Ars Technica AI',
    url: 'https://arstechnica.com/ai/feed/',
    defaultTag: null,
  },
  {
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    defaultTag: null,
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed/',
    defaultTag: null,
  },
];

const PROVIDER_KEYWORDS = [
  { tag: 'OpenAI', keywords: ['openai', 'chatgpt', 'gpt-4', 'gpt-5', 'sora', 'sam altman', 'o1', 'o3', 'o4'] },
  { tag: 'Anthropic', keywords: ['anthropic', 'claude', 'sonnet', 'opus', 'haiku', 'dario amodei'] },
  { tag: 'Google', keywords: ['google', 'deepmind', 'gemini', 'gemma', 'notebooklm', 'veo'] },
  { tag: 'Meta', keywords: ['meta ai', 'llama', 'zuckerberg', 'fair'] },
  { tag: 'xAI', keywords: ['xai', 'grok', 'colossus'] },
  { tag: 'Mistral', keywords: ['mistral', 'mixtral', 'le chat', 'pixtral', 'magistral'] },
  { tag: 'DeepSeek', keywords: ['deepseek', '深度求索'] },
  { tag: 'Qwen', keywords: ['qwen', 'tongyi', 'alibaba', '通義千問', '阿里'] },
];

function decodeHtmlEntities(str = '') {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8211;/g, '–')
    .replace(/&#8230;/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectProviderTag(title, summary, defaultTag) {
  const combined = `${title} ${summary}`.toLowerCase();
  for (const rule of PROVIDER_KEYWORDS) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      return rule.tag;
    }
  }
  return defaultTag || 'General';
}

function extractTagContent(xmlBlock, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xmlBlock.match(regex);
  return match ? match[1].trim() : '';
}

function extractAtomLink(xmlBlock) {
  const hrefMatch = xmlBlock.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (hrefMatch) return hrefMatch[1];
  return decodeHtmlEntities(extractTagContent(xmlBlock, 'link'));
}

function parseXmlFeed(xml, source) {
  const items = [];
  // Match RSS <item> or Atom <entry>
  const itemBlocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];

  for (const block of itemBlocks.slice(0, 12)) {
    const rawTitle = extractTagContent(block, 'title');
    const title = decodeHtmlEntities(rawTitle);
    if (!title) continue;

    const url = extractAtomLink(block);
    if (!url) continue;

    const rawDesc =
      extractTagContent(block, 'description') ||
      extractTagContent(block, 'summary') ||
      extractTagContent(block, 'content:encoded') ||
      extractTagContent(block, 'content');
    const cleanSummary = decodeHtmlEntities(rawDesc).slice(0, 220);

    const rawDate =
      extractTagContent(block, 'pubDate') ||
      extractTagContent(block, 'published') ||
      extractTagContent(block, 'updated') ||
      extractTagContent(block, 'dc:date');

    let publishedAt = new Date().toISOString();
    if (rawDate) {
      const parsed = new Date(decodeHtmlEntities(rawDate));
      if (!Number.isNaN(parsed.getTime())) {
        publishedAt = parsed.toISOString();
      }
    }

    const providerTag = detectProviderTag(title, cleanSummary, source.defaultTag);

    items.push({
      id: `${source.name}-${Buffer.from(url).toString('base64').slice(0, 16)}`,
      title,
      summary: cleanSummary.length >= 220 ? `${cleanSummary}...` : cleanSummary || '點擊閱讀完整原文報導。',
      url,
      source: source.name,
      providerTag,
      publishedAt,
    });
  }

  return items;
}

async function fetchSingleFeed(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LLM-Model-Tracker-GitHub-Action/1.0 (+https://github.com)',
        Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const xml = await res.text();
    return parseXmlFeed(xml, source);
  } catch (err) {
    console.warn(`[WARN] 無法抓取 ${source.name} (${source.url}): ${err.message}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log('🚀 開始抓取各大 AI 媒體與官方最新新聞...');
  const results = await Promise.all(RSS_SOURCES.map((s) => fetchSingleFeed(s)));
  const allItems = results.flat();

  // 去重（依標題或 URL）並依時間由新到舊排序
  const seenUrls = new Set();
  const deduplicated = [];
  for (const item of allItems) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      deduplicated.push(item);
    }
  }

  deduplicated.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  if (deduplicated.length === 0) {
    console.warn('⚠️ 本次未抓到任何線上 RSS（可能處於無網路環境），保留既有 news.json。');
    return;
  }

  const payload = {
    lastUpdated: new Date().toISOString(),
    totalSources: RSS_SOURCES.length,
    items: deduplicated.slice(0, 40),
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`✅ 成功更新 ${payload.items.length} 則最新 AI 新聞至 ${OUTPUT_PATH}`);
}

main();
