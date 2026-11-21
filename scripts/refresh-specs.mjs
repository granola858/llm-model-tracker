#!/usr/bin/env node
/**
 * scripts/refresh-specs.mjs
 * 供 GitHub Actions 每週執行：針對近期發布的模型檢查規格是否有缺漏或更新。
 *
 * 1. 只挑選最近 LOOKBACK_DAYS 天內（預設 90 天）且符合以下任一條件的模型：
 *    - 含有 estimated 推估欄位（parameters / context）
 *    - officialUrl 只是首頁或泛用分類頁（例如 https://blog.google/、https://openai.com/）
 *    - 與 OpenRouter API 目前回報的 context_length 或 input_modalities 有明顯差異
 * 2. 交給 Claude 用 web_search 查證官方公告、模型卡或 API 文件，只更新有明確官方依據的欄位。
 * 3. 每一筆都經過 model-schema 驗證，通過的才寫回 src/data/models.json；
 *    變更摘要寫到 SPEC_UPDATE_SUMMARY 指定的檔案，作為 PR 說明。
 *
 * 沒有設定 ANTHROPIC_API_KEY 或加上 --dry-run 時，只列出待重查清單，不呼叫 API、不寫入任何檔案。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import {
  ESTIMATED_FIELDS,
  LICENSES,
  MODALITIES,
  validateModel,
} from './lib/model-schema.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODELS_PATH = path.resolve(here, '../src/data/models.json');

const LOOKBACK_DAYS = Number(process.env.SPEC_LOOKBACK_DAYS ?? 90);
const MAX_TARGETS = Number(process.env.SPEC_MAX_TARGETS ?? 15);
const MODEL = process.env.MODEL_UPDATE_MODEL || 'claude-sonnet-5-5';
const EFFORT = process.env.MODEL_UPDATE_EFFORT || 'medium';
const MAX_TURNS = 8;

const OPENROUTER_PREFIX = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'meta-llama': 'Meta',
  'x-ai': 'xAI',
  mistralai: 'Mistral',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
};

const OR_MODALITY_MAP = {
  text: 'Text',
  image: 'Vision',
  audio: 'Audio',
  video: 'Video',
};

const UPDATABLE_FIELDS = [
  'parameters',
  'contextWindow',
  'contextTokens',
  'modalities',
  'license',
  'isReasoning',
  'estimated',
  'officialUrl',
  'highlights',
];

const MODEL_KEY_ORDER = [
  'id', 'name', 'provider', 'releaseDate', 'parameters', 'contextWindow', 'contextTokens', 'modalities',
  'license', 'category', 'isFlagship', 'isReasoning', 'estimated', 'highlights', 'officialUrl',
];

// ---------------------------------------------------------------- 工具函式

const todayISO = () => new Date().toISOString().slice(0, 10);

function daysAgoISO(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function normalizeName(s = '') {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** 判斷 officialUrl 是否只是首頁或泛用 blog/news 索引頁 */
export function isGenericOfficialUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.search) return false;
    const p = u.pathname.replace(/\/+$/, '');
    return p === '' || p === '/blog' || p === '/news' || p === '/research' || p === '/models';
  } catch {
    return true;
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'LLM-Model-Tracker-GitHub-Action/1.0', Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOpenRouterMap() {
  try {
    const json = await fetchJson('https://openrouter.ai/api/v1/models');
    const byProvider = new Map();
    for (const m of json.data ?? []) {
      const [prefix, rest] = String(m.id).split('/');
      const provider = OPENROUTER_PREFIX[prefix];
      if (!provider || !rest) continue;
      if (rest.includes(':')) continue; // 略過 :free / :thinking 等變體，只留基準條目
      if (!byProvider.has(provider)) byProvider.set(provider, []);
      const displayName = String(m.name ?? rest).replace(/^[^:]+:\s*/, '');
      const modalities = [...new Set((m.architecture?.input_modalities ?? []).map((x) => OR_MODALITY_MAP[x]).filter(Boolean))];
      byProvider.get(provider).push({
        id: m.id,
        slug: rest,
        name: displayName,
        normName: normalizeName(displayName),
        normSlug: normalizeName(rest),
        contextLength: Number(m.context_length) || 0,
        modalities,
      });
    }
    return byProvider;
  } catch (err) {
    console.warn(`[WARN] 無法讀取 OpenRouter 模型清單：${err.message}`);
    return new Map();
  }
}

function matchOpenRouter(model, orList) {
  if (!orList?.length) return null;
  const targets = new Set([
    normalizeName(model.name),
    normalizeName(model.id.replace(/^[a-z]+-/, '')),
  ]);
  return orList.find((o) => targets.has(o.normName) || targets.has(o.normSlug)) ?? null;
}

/**
 * 篩選出需要重新查證規格的模型清單。
 * 優先順序：OpenRouter 規格差異 > 含推估欄位 (estimated) > 泛用官方網址。
 */
export function selectTargets(models, openrouterByProvider, cutoff, maxTargets = MAX_TARGETS) {
  const candidates = [];

  for (const m of models) {
    if (m.releaseDate < cutoff) continue;

    const reasons = [];
    let priority = 0;

    const orMatch = matchOpenRouter(m, openrouterByProvider.get(m.provider));
    let orHint = null;
    if (orMatch) {
      const diffs = [];
      // context 超過 5% 差異才算（避開 1,000,000 與 1,048,576 的進位誤差）
      if (orMatch.contextLength > 0 && Math.abs(orMatch.contextLength - m.contextTokens) / Math.max(m.contextTokens, 1) > 0.05) {
        diffs.push(`OpenRouter context_length=${orMatch.contextLength}（目前 ${m.contextTokens}）`);
      }
      const missingModalities = orMatch.modalities.filter((mod) => !m.modalities.includes(mod));
      if (missingModalities.length > 0) {
        diffs.push(`OpenRouter 多出輸入模態：${missingModalities.join('、')}`);
      }
      if (diffs.length > 0) {
        reasons.push(...diffs);
        priority += 100;
        orHint = {
          openrouterId: orMatch.id,
          contextLength: orMatch.contextLength,
          modalities: orMatch.modalities,
        };
      }
    }

    if (Array.isArray(m.estimated) && m.estimated.length > 0) {
      reasons.push(`含推估欄位：${m.estimated.join('、')}`);
      priority += 50;
    }

    if (isGenericOfficialUrl(m.officialUrl)) {
      reasons.push(`officialUrl 僅為首頁或泛用頁（${m.officialUrl}）`);
      priority += 10;
    }

    if (reasons.length > 0) {
      candidates.push({ model: m, reasons, orHint, priority });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority || b.model.releaseDate.localeCompare(a.model.releaseDate));
  return candidates.slice(0, maxTargets);
}

// ---------------------------------------------------------------- Claude 查證

const UPDATE_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'reason', 'sources'],
  properties: {
    id: { type: 'string', description: '既有模型的 id，必須完全一致' },
    parameters: { type: 'string', description: '僅在官方確認新數值時提供，否則省略' },
    contextWindow: { type: 'string', description: '僅在上下文長度有更新或確認時提供，例如 "1M"、"256K"' },
    contextTokens: { type: 'integer', description: 'contextWindow 對應的 token 整數上限' },
    modalities: { type: 'array', items: { type: 'string', enum: MODALITIES }, description: '僅在模態有更新時提供' },
    license: { type: 'string', enum: LICENSES, description: '僅在授權有變更時提供（例如後來開放權重）' },
    isReasoning: { type: 'boolean', description: '僅在推理能力標記有誤時提供' },
    estimated: {
      type: 'array',
      items: { type: 'string', enum: ESTIMATED_FIELDS },
      description: '更新後仍屬推估的欄位；若所有規格都已由官方證實，請傳空陣列 []',
    },
    officialUrl: { type: 'string', description: '具體的官方公告或文件 https 網址（不要填首頁）' },
    highlights: { type: 'string', description: '僅在規格變動導致原摘要明顯過時或錯誤時才更新，台灣正體中文 40–90 字' },
    reason: { type: 'string', description: '簡述這次修正了什麼以及官方依據' },
    sources: { type: 'array', items: { type: 'string' }, description: '查證用的官方網址' },
  },
};

const SUBMIT_TOOL = {
  name: 'submit_spec_updates',
  description: '提交規格查證與更新結果。查完所有目標模型後呼叫一次。',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['updates', 'unchanged'],
    properties: {
      updates: {
        type: 'array',
        items: UPDATE_ITEM_SCHEMA,
        description: '確認有實質規格或官方連結可修正的模型；沒有就給空陣列',
      },
      unchanged: {
        type: 'array',
        description: '查證後維持原狀的模型',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'reason'],
          properties: {
            id: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
  },
};

function buildSystemPrompt() {
  return `你在維護「AI 大廠模型演進追蹤器」的 models.json，負責回補與校正近期模型的規格資料。
原則：寧缺勿濫，**只依據官方部落格、模型卡、技術報告或官方 API 文件**修改欄位，絕不憑猜測改動。

請逐一查核清單中的每個模型（使用 web_search 查證官方來源）：
1. 若模型原本含有 estimated（例如 ["context"] 或 ["parameters"]）：
   - 查證官方文件是否已明確公布該數值。
   - 若已公布：更新該欄位（若原本數字就正確則可只更新 estimated），並將已證實的項目從 estimated 移除（全部證實就傳 estimated: []）。
   - 若官方仍未公開：不要硬填猜測數字，維持原狀。
2. 若目標附帶 OpenRouter 的規格差異提示：
   - 查證官方 API 文件，確認是模型真的升級（例如擴充 Context Window 或新增模態），還是 OpenRouter 標記誤差。只有官方確認才更新。
3. 若原本的 officialUrl 只是首頁或泛用索引頁（如 https://blog.google/、https://openai.com/）：
   - 搜尋該模型專屬的官方公告文章、模型卡或官方文件頁面網址（必須是該廠商官方網域的 https 連結，確認真實存在再填）。
4. 只填有實質變更的欄位；未變更的欄位不要亂動。若一個模型沒有任何需要修正的欄位，放到 unchanged。

查核完所有模型後，呼叫一次 submit_spec_updates 提交結果。每個目標 id 都必須出現在 updates 或 unchanged 其中之一。`;
}

function buildUserMessage(targets, today) {
  const blocks = targets.map((t, idx) => {
    const lines = [
      `### ${idx + 1}. ${t.model.id}`,
      `- 待查原因：${t.reasons.join('；')}`,
    ];
    if (t.orHint) lines.push(`- OpenRouter 參考：${JSON.stringify(t.orHint)}`);
    lines.push('```json', JSON.stringify(t.model, null, 2), '```');
    return lines.join('\n');
  });
  return `今天是 ${today}。以下是需要查核規格的 ${targets.length} 筆近期模型：\n\n${blocks.join('\n\n')}`;
}

async function reviewSpecUpdates(targets, today) {
  const client = new Anthropic();
  const system = buildSystemPrompt();
  const messages = [{ role: 'user', content: buildUserMessage(targets, today) }];
  let nudged = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: EFFORT },
        system,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 20 }, SUBMIT_TOOL],
        messages,
      })
      .finalMessage();

    const usage = response.usage;
    console.log(`  Claude 第 ${turn + 1} 輪：stop_reason=${response.stop_reason}，input ${usage.input_tokens} / output ${usage.output_tokens} tokens`);

    if (response.stop_reason === 'refusal') {
      throw new Error(`Claude 拒絕了這次請求（${response.stop_details?.category ?? '未知類別'}）`);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Claude 回覆超過 max_tokens，結果不完整');
    }

    const submit = response.content.find((b) => b.type === 'tool_use' && b.name === SUBMIT_TOOL.name);
    if (submit) return submit.input;

    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;

    if (response.stop_reason === 'end_turn' && !nudged) {
      nudged = true;
      messages.push({ role: 'user', content: '請呼叫 submit_spec_updates 提交查核結果。' });
      continue;
    }
    throw new Error(`Claude 沒有提交結果（stop_reason=${response.stop_reason}）`);
  }
  throw new Error(`超過 ${MAX_TURNS} 輪仍未提交結果`);
}

// ---------------------------------------------------------------- 套用與摘要

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 將 Claude 提議的規格更新驗證後套用到既有清單（維持原本陣列與欄位順序）。
 * @returns {{ models: object[], updated: Array<{before: object, after: object, diffs: Array<{field:string, from:any, to:any}>, reason: string, sources: string[]}>, rejected: Array<{id: string, errors: string[]}> }}
 */
export function applySpecUpdates(existing, proposals, today) {
  const byId = new Map(existing.map((m, i) => [m.id, i]));
  const nextModels = existing.map((m) => ({ ...m }));
  const updated = [];
  const rejected = [];

  for (const prop of proposals ?? []) {
    const idx = byId.get(prop.id);
    if (idx === undefined) {
      rejected.push({ id: prop.id, errors: ['找不到對應的模型 id'] });
      continue;
    }

    const before = existing[idx];
    const merged = { ...before };
    const diffs = [];

    for (const field of UPDATABLE_FIELDS) {
      if (prop[field] === undefined) continue;
      if (field === 'estimated') {
        const nextEst = [...new Set(prop.estimated)];
        const prevEst = before.estimated ?? [];
        if (!sameValue(prevEst, nextEst)) {
          if (nextEst.length > 0) merged.estimated = nextEst;
          else delete merged.estimated;
          diffs.push({ field: 'estimated', from: prevEst.length ? prevEst : '（無）', to: nextEst.length ? nextEst : '（已全部確認）' });
        }
        continue;
      }
      if (!sameValue(before[field], prop[field])) {
        merged[field] = prop[field];
        diffs.push({ field, from: before[field], to: prop[field] });
      }
    }

    if (diffs.length === 0) continue;

    // 依固定欄位順序重組，讓 git diff 好讀
    const ordered = {};
    for (const key of MODEL_KEY_ORDER) {
      if (merged[key] !== undefined) ordered[key] = merged[key];
    }

    const errors = validateModel(ordered, { today });
    if (errors.length) {
      rejected.push({ id: prop.id, errors });
      continue;
    }

    nextModels[idx] = ordered;
    updated.push({
      before,
      after: ordered,
      diffs,
      reason: prop.reason,
      sources: prop.sources ?? [],
    });
  }

  return { models: nextModels, updated, rejected };
}

function formatVal(v) {
  if (Array.isArray(v)) return v.join('、');
  return String(v);
}

function buildSummary({ updated, rejected, unchanged, targetCount, today }) {
  const lines = [`由 \`scripts/refresh-specs.mjs\` 於 ${today} 自動查核並回補規格（共檢查 ${targetCount} 筆近期模型）。`, ''];

  lines.push(`## 更新 ${updated.length} 筆規格`, '');
  for (const u of updated) {
    lines.push(`### ${u.after.name}（${u.after.provider}｜規格更新）`);
    for (const d of u.diffs) {
      lines.push(`- **${d.field}**：\`${formatVal(d.from)}\` → \`${formatVal(d.to)}\``);
    }
    lines.push(`- 說明：${u.reason}`);
    if (u.sources.length) lines.push(`- 查證來源：${u.sources.join('、')}`);
    lines.push('');
  }

  if (rejected.length) {
    lines.push(`## 未通過格式驗證 ${rejected.length} 筆（未寫入）`, '');
    for (const r of rejected) lines.push(`- ${r.id}：${r.errors.join('；')}`);
    lines.push('');
  }

  if (unchanged.length) {
    lines.push('<details>', `<summary>查核後維持原狀（${unchanged.length}）</summary>`, '');
    for (const item of unchanged) lines.push(`- ${item.id}：${item.reason}`);
    lines.push('', '</details>', '');
  }

  return lines.join('\n');
}

async function setActionOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

// ---------------------------------------------------------------- 主流程

async function main() {
  const dryRun = process.argv.includes('--dry-run') || !process.env.ANTHROPIC_API_KEY;
  const today = todayISO();
  const cutoff = daysAgoISO(LOOKBACK_DAYS);
  const existing = JSON.parse(await fs.readFile(MODELS_PATH, 'utf-8'));
  if (!Array.isArray(existing)) throw new Error('讀不到 src/data/models.json');

  console.log(`🔎 檢查 ${cutoff} 之後發布、可能需要回補規格的模型…`);
  const orMap = await fetchOpenRouterMap();
  const targets = selectTargets(existing, orMap, cutoff, MAX_TARGETS);
  console.log(`   篩選出 ${targets.length} 筆待查核模型：`);
  for (const t of targets) {
    console.log(`   - ${t.model.id} (${t.model.releaseDate})：${t.reasons.join('；')}`);
  }

  await setActionOutput('updated', 0);
  if (targets.length === 0) {
    console.log('✅ 沒有需要回補規格的模型，不需要呼叫 Claude。');
    return;
  }
  if (dryRun) {
    console.log('ℹ️ 未設定 ANTHROPIC_API_KEY 或使用 --dry-run：只列出待查清單，不呼叫 API、不寫入檔案。');
    return;
  }

  console.log(`🤖 交給 ${MODEL}（effort: ${EFFORT}）查證官方規格…`);
  const result = await reviewSpecUpdates(targets, today);
  const { models, updated, rejected } = applySpecUpdates(existing, result.updates ?? [], today);

  if (updated.length > 0) {
    await fs.writeFile(MODELS_PATH, `${JSON.stringify(models, null, 2)}\n`, 'utf-8');
  }
  await setActionOutput('updated', updated.length);

  const summary = buildSummary({
    updated,
    rejected,
    unchanged: result.unchanged ?? [],
    targetCount: targets.length,
    today,
  });
  if (process.env.SPEC_UPDATE_SUMMARY) await fs.writeFile(process.env.SPEC_UPDATE_SUMMARY, summary, 'utf-8');
  console.log(`\n${summary}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`❌ ${err.stack ?? err}`);
    process.exit(1);
  });
}
