#!/usr/bin/env node
/**
 * scripts/fetch-models.mjs
 * 供 GitHub Actions 每日執行：找出 8 大廠商最近發布、但 models.json 還沒收錄的模型。
 *
 * 1. 從公開來源收集候選：OpenRouter models API、Hugging Face 官方帳號、news.json 裡的發布新聞。
 * 2. 已經審過的候選記在 scripts/state/reviewed-candidates.json，不會重複送審（省 API 費用）。
 * 3. 把新候選交給 Claude：用 web search 查官方公告，判斷是否值得收錄，並依 AIModel 格式填好欄位。
 * 4. 每一筆都經過 model-schema 驗證，通過的才寫進 src/data/models.json；
 *    審核摘要寫到 MODEL_UPDATE_SUMMARY 指定的檔案，作為 PR 說明。
 *
 * 沒有設定 ANTHROPIC_API_KEY 或加上 --dry-run 時，只列出候選，不呼叫 API、不寫入任何檔案。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import {
  CATEGORIES,
  ESTIMATED_FIELDS,
  LICENSES,
  MODALITIES,
  PROVIDER_IDS,
  validateModel,
} from './lib/model-schema.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODELS_PATH = path.resolve(here, '../src/data/models.json');
const NEWS_PATH = path.resolve(here, '../public/data/news.json');
const REVIEWED_PATH = path.resolve(here, 'state/reviewed-candidates.json');

const LOOKBACK_DAYS = Number(process.env.MODEL_LOOKBACK_DAYS ?? 30);
/** 查證與整理不需要最強的模型，預設用 Sonnet；可用 MODEL_UPDATE_MODEL 覆寫 */
const MODEL = process.env.MODEL_UPDATE_MODEL || 'claude-sonnet-5-5';
const EFFORT = process.env.MODEL_UPDATE_EFFORT || 'medium';
const MAX_TURNS = 8;

/** OpenRouter 的 id 前綴 → 廠商 */
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

/** Hugging Face 官方帳號 → 廠商（Anthropic、xAI 沒有在 HF 發布權重） */
const HF_AUTHORS = {
  openai: 'OpenAI',
  google: 'Google',
  'meta-llama': 'Meta',
  mistralai: 'Mistral',
  'deepseek-ai': 'DeepSeek',
  Qwen: 'Qwen',
};

/** 只看語言／多模態模型，排除影像生成、語音辨識等 */
const HF_PIPELINES = new Set(['text-generation', 'image-text-to-text', 'any-to-any', 'audio-text-to-text', 'video-text-to-text']);
/** 量化、轉檔版本不是新模型 */
const HF_DERIVATIVE = /(gguf|awq|gptq|fp8|fp4|int4|int8|mlx|bnb|onnx|-4bit|-8bit|nvfp4|mxfp4)/i;

const NEWS_RELEASE_HINT = /(launch|release|introduc|unveil|announc|debut|rolls? out|new model|發布|推出|上線|開源)/i;

// ---------------------------------------------------------------- 工具函式

const todayISO = () => new Date().toISOString().slice(0, 10);

function daysAgoISO(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** 用來比對「是否已收錄」的正規化名稱：小寫、去掉括號註記與符號 */
function normalizeName(s = '') {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]/g, '');
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

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

// ---------------------------------------------------------------- 收集候選

/** @returns {Promise<Array<{key:string, source:string, provider:string, name:string, date:string, detail:object}>>} */
async function collectOpenRouter(cutoff) {
  const json = await fetchJson('https://openrouter.ai/api/v1/models');
  const byKey = new Map();
  for (const m of json.data ?? []) {
    const [prefix, rest] = String(m.id).split('/');
    const provider = OPENROUTER_PREFIX[prefix];
    if (!provider || !rest) continue;
    const date = new Date(m.created * 1000).toISOString().slice(0, 10);
    if (date < cutoff) continue;
    // 同一模型的 :free / :thinking 等變體視為同一個候選
    const baseId = `${prefix}/${rest.split(':')[0]}`;
    const key = `openrouter:${baseId}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      key,
      source: 'OpenRouter',
      provider,
      name: String(m.name ?? baseId).replace(/^[^:]+:\s*/, ''),
      date,
      detail: {
        openrouterId: baseId,
        contextLength: m.context_length,
        inputModalities: m.architecture?.input_modalities,
        huggingFaceId: m.hugging_face_id || undefined,
        description: String(m.description ?? '').slice(0, 400),
      },
    });
  }
  return [...byKey.values()];
}

async function collectHuggingFace(cutoff) {
  const out = [];
  await Promise.all(
    Object.entries(HF_AUTHORS).map(async ([author, provider]) => {
      try {
        const list = await fetchJson(
          `https://huggingface.co/api/models?author=${encodeURIComponent(author)}&sort=createdAt&direction=-1&limit=40`,
        );
        for (const m of list) {
          const date = String(m.createdAt ?? '').slice(0, 10);
          if (!date || date < cutoff) continue;
          if (!HF_PIPELINES.has(m.pipeline_tag)) continue;
          if (HF_DERIVATIVE.test(m.id)) continue;
          if ((m.tags ?? []).some((t) => t.startsWith('base_model:quantized:') || t.startsWith('base_model:adapter:'))) continue;
          out.push({
            key: `hf:${m.id}`,
            source: 'Hugging Face',
            provider,
            name: m.id.split('/')[1],
            date,
            detail: {
              huggingFaceId: m.id,
              pipeline: m.pipeline_tag,
              license: (m.tags ?? []).find((t) => t.startsWith('license:'))?.slice(8),
              downloads: m.downloads,
              likes: m.likes,
            },
          });
        }
      } catch (err) {
        console.warn(`[WARN] 無法讀取 Hugging Face ${author}：${err.message}`);
      }
    }),
  );
  return out;
}

async function collectNews(cutoff) {
  const news = await readJson(NEWS_PATH, { items: [] });
  return (news.items ?? [])
    .filter(
      (n) =>
        PROVIDER_IDS.includes(n.providerTag) &&
        String(n.publishedAt).slice(0, 10) >= cutoff &&
        NEWS_RELEASE_HINT.test(n.title),
    )
    .map((n) => ({
      key: `news:${n.url}`,
      source: `新聞（${n.source}）`,
      provider: n.providerTag,
      name: n.title,
      date: String(n.publishedAt).slice(0, 10),
      detail: { url: n.url, summary: n.summary },
    }));
}

/** 名稱已經和既有模型完全相同的候選直接略過，其餘交給 Claude 判斷 */
function dropKnown(candidates, existing) {
  const known = new Set();
  for (const m of existing) {
    known.add(normalizeName(m.name));
    known.add(normalizeName(m.id.replace(/^[a-z]+-/, '')));
  }
  return candidates.filter((c) => c.source.startsWith('新聞') || !known.has(normalizeName(c.name)));
}

// ---------------------------------------------------------------- Claude 審核

const MODEL_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id', 'name', 'provider', 'releaseDate', 'parameters', 'contextWindow', 'contextTokens', 'modalities',
    'license', 'category', 'isFlagship', 'isReasoning', 'estimated', 'highlights', 'officialUrl', 'sources', 'candidateRefs',
  ],
  properties: {
    candidateRefs: { type: 'array', items: { type: 'string' }, description: '這筆模型對應的候選編號，例如 ["c1"]' },
    id: { type: 'string', description: '小寫 kebab-case，格式為「廠商-模型」，例如 openai-gpt-6-1-terra' },
    name: { type: 'string', description: '官方模型名稱，開放權重模型可在括號註明參數量' },
    provider: { type: 'string', enum: PROVIDER_IDS },
    releaseDate: { type: 'string', description: '首次公開發布日 YYYY-MM-DD' },
    parameters: { type: 'string', description: '參數量，例如 "70B"、"1.05T (49B Active MoE)"；不公開填「未公開」' },
    contextWindow: { type: 'string', description: '顯示用文字，例如 "1M"、"256K"、"512K - 1M"' },
    contextTokens: { type: 'integer', description: 'contextWindow 的上限換算成 token 數' },
    modalities: { type: 'array', items: { type: 'string', enum: MODALITIES } },
    license: { type: 'string', enum: LICENSES },
    category: { type: 'string', enum: CATEGORIES },
    isFlagship: { type: 'boolean', description: '這筆發布是否包含該廠商當時最高階的主力模型' },
    isReasoning: { type: 'boolean' },
    estimated: {
      type: 'array',
      items: { type: 'string', enum: ESTIMATED_FIELDS },
      description: '哪些欄位不是官方數字、而是依報導推估；都是官方數字就給空陣列',
    },
    highlights: { type: 'string', description: '台灣正體中文一到兩句，40–90 字' },
    officialUrl: { type: 'string', description: '官方公告或文件的 https 網址' },
    sources: { type: 'array', items: { type: 'string' }, description: '查證用的網址，給審核者看' },
  },
};

const SUBMIT_TOOL = {
  name: 'submit_models',
  description: '提交審核結果。審完所有候選後呼叫一次。',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['models', 'skipped'],
    properties: {
      models: { type: 'array', items: MODEL_ITEM_SCHEMA, description: '值得收錄的新模型；沒有就給空陣列' },
      skipped: {
        type: 'array',
        description: '不收錄的候選與原因',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['candidateRefs', 'candidate', 'reason', 'recheck'],
          properties: {
            candidateRefs: { type: 'array', items: { type: 'string' }, description: '對應的候選編號，例如 ["c3", "c6"]' },
            candidate: { type: 'string', description: '候選的簡短名稱' },
            reason: { type: 'string' },
            recheck: {
              type: 'boolean',
              description: '目前資訊不足、之後可能值得收錄時填 true（隔天會再送審）；確定不收錄填 false',
            },
          },
        },
      },
    },
  },
};

function buildSystemPrompt(existing) {
  const examples = existing.slice(-3).map((m) => JSON.stringify(m, null, 2)).join('\n\n');
  return `你在維護一個「AI 大廠模型演進追蹤器」網站的資料，只追蹤這 8 家廠商：${PROVIDER_IDS.join('、')}。
網站讀者想看的是各家「有意義的模型發布」時間軸，所以收錄門檻要高，寧缺勿濫——一筆錯誤或灌水的資料比晚一天更新更糟。

你會收到自動收集的候選清單（來自 OpenRouter、Hugging Face 官方帳號與新聞標題），裡面混了大量雜訊。請逐一判斷：

收錄：官方正式發布、一般使用者用得到的新模型或新世代（官方 App／網頁、個人方案的 CLI 或 IDE 工具，或任何人都能下載的開放權重），例如新旗艦、新的輕量版或推理版、重要的開放權重釋出。
不收錄：
- 已經在既有清單裡的模型（名稱寫法不同也算，例如日期快照、別名、同一模型的 preview 轉正式）
- 微調、量化、轉檔、社群版本，或同一模型只是改了價格、上架新平台
- 只提供 API，或僅限企業、通過審核的組織使用的模型
- 嵌入、影像生成、語音辨識、安全分類器，以及資安、OCR、翻譯等特定用途的模型
- 只有傳聞、尚未正式發布的消息
- 不屬於這 8 家的模型

查證規則：
- 收錄前一定要用 web_search 到官方部落格、文件或模型卡查證發布日與規格。官方沒公布的參數量填「未公開」；context 或參數是依報導推估的，要在 estimated 標出來。不要編造數字。
- 候選資料只是線索。像「某廠商發布新模型」但沒寫名稱的新聞，要先用 web_search 找出是哪個模型、是否已正式發布，不能因為候選資料本身資訊不足就略過。
- 只有一眼就能確定的情況可以不搜尋直接略過：不屬於這 8 家、明顯不是模型發布（訴訟、人事、產品功能）、或既有清單裡已經有同一個模型。
- 搜尋後仍無法確認、但之後可能值得收錄（例如剛宣布、規格還沒公開），放進 skipped 並把 recheck 設為 true，隔天會再審一次；確定不收錄的 recheck 設為 false。

欄位規則：
- 一筆只收同一天發布的模型：同一天一起發表的可以合併成一筆（例如「GPT-6 Sol & Luna」）；同系列但不同天發布的版本（例如先出 Sonnet、兩週後才出 Haiku）各自一筆，releaseDate 填該模型自己的官方公告日，不要寫成「4.6 ~ 4.8」這種區間或併進既有的一筆
- category 只能選一個主要定位：Flagship（旗艦）、Reasoning（以推理為主打）、Lightweight（輕量／低價）、Multimodal（以多模態為主打）、Coding（程式專用）
- isFlagship：這筆發布包含該廠商當時最高階的主力模型就填 true，與 category 無關（例如以推理或程式為主打的頂級新世代也算）；category 選 Flagship 時必須為 true
- isReasoning：模型具備思考／推理模式就填 true
- highlights 用台灣正體中文（台灣用語），一到兩句、40–90 字，寫這個模型的定位與最重要的差異，不要行銷口號
- id 不可與既有清單重複

以下是既有資料的格式範例：

${examples}

審完所有候選後，呼叫一次 submit_models 提交結果；每個候選編號（c1、c2…）都必須出現在某一筆 models 或 skipped 的 candidateRefs 裡（同一個模型的多個候選可以合併成一筆）。`;
}

function buildUserMessage(candidates, existing, today) {
  const existingLines = existing
    .map((m) => `- ${m.id} | ${m.name} | ${m.provider} | ${m.releaseDate}`)
    .join('\n');
  const candidateLines = candidates
    .map((c, i) => `- c${i + 1} [${c.source}] ${c.provider}｜${c.name}｜${c.date}｜${JSON.stringify(c.detail)}`)
    .join('\n');
  return `今天是 ${today}。

<existing_models>
${existingLines}
</existing_models>

<candidates>
${candidateLines}
</candidates>`;
}

/**
 * 呼叫 Claude 審核候選，回傳 submit_models 的輸入。
 * 使用 server-side fallback（fallbacks: "default"）：被安全分類器拒絕時由伺服器改用建議的備援模型重跑。
 */
async function reviewWithClaude(candidates, existing, today) {
  const client = new Anthropic();
  const system = buildSystemPrompt(existing);
  const messages = [{ role: 'user', content: buildUserMessage(candidates, existing, today) }];
  let nudged = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 64000,
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

    // 不論是 pause_turn（web search 跑太久）或沒有提交就結束，都把回覆原樣接回去再繼續
    messages.push({ role: 'assistant', content: response.content });
    if (response.stop_reason === 'pause_turn') continue;

    if (response.stop_reason === 'end_turn' && !nudged) {
      nudged = true;
      messages.push({ role: 'user', content: '請呼叫 submit_models 提交審核結果。' });
      continue;
    }
    throw new Error(`Claude 沒有提交結果（stop_reason=${response.stop_reason}）`);
  }
  throw new Error(`超過 ${MAX_TURNS} 輪仍未提交結果`);
}

// ---------------------------------------------------------------- 合併與摘要

/**
 * 把 Claude 提議的模型驗證後合併進既有清單。
 * @returns {{ models: object[], added: object[], rejected: Array<{model: object, errors: string[]}> }}
 */
export function mergeProposals(existing, proposals, today) {
  const ids = new Set(existing.map((m) => m.id));
  const names = new Set(existing.map((m) => normalizeName(m.name)));
  const added = [];
  const rejected = [];

  for (const proposal of proposals) {
    const { sources = [], estimated = [], ...rest } = proposal;
    const model = estimated.length ? { ...rest, estimated: [...new Set(estimated)] } : rest;
    // 欄位順序與既有資料一致，diff 比較好讀
    const ordered = {};
    for (const key of [
      'id', 'name', 'provider', 'releaseDate', 'parameters', 'contextWindow', 'contextTokens', 'modalities',
      'license', 'category', 'isFlagship', 'isReasoning', 'estimated', 'highlights', 'officialUrl',
    ]) {
      if (model[key] !== undefined) ordered[key] = model[key];
    }

    const errors = validateModel(ordered, { today });
    if (ids.has(ordered.id)) errors.push(`id 已存在：${ordered.id}`);
    if (names.has(normalizeName(ordered.name))) errors.push(`名稱已收錄：${ordered.name}`);

    if (errors.length) {
      rejected.push({ model: ordered, errors });
      continue;
    }
    ids.add(ordered.id);
    names.add(normalizeName(ordered.name));
    added.push({ model: ordered, sources });
  }

  return { models: [...existing, ...added.map((a) => a.model)], added, rejected };
}

/**
 * 算出新的「已審過候選」紀錄。
 * - Claude 明確處理過（收錄，或確定不收錄）的候選記為已審過
 * - 標記 recheck 的、或 Claude 漏掉沒處理的候選不記錄，下次會再送審
 * - 早於 pruneBefore 的舊紀錄清掉（已超出回溯期間，不會再出現）
 */
export function nextReviewedState(reviewed, fresh, result, today, pruneBefore) {
  const next = Object.fromEntries(Object.entries(reviewed).filter(([, d]) => d >= pruneBefore));
  const refToKey = new Map(fresh.map((c, i) => [`c${i + 1}`, c.key]));
  const settled = new Set();
  const recheck = new Set();

  for (const m of result.models ?? []) for (const ref of m.candidateRefs ?? []) settled.add(ref);
  for (const s of result.skipped ?? []) {
    for (const ref of s.candidateRefs ?? []) (s.recheck ? recheck : settled).add(ref);
  }

  for (const ref of settled) {
    const key = refToKey.get(ref);
    if (key && !recheck.has(ref)) next[key] = today;
  }
  return next;
}

function buildSummary({ added, rejected, skipped, counts, today }) {
  const lines = [`由 \`scripts/fetch-models.mjs\` 於 ${today} 自動產生，合併前請確認發布日與規格。`, ''];

  lines.push(`## 新增 ${added.length} 筆`, '');
  for (const { model: m, sources } of added) {
    lines.push(`### ${m.name}（${m.provider}，${m.releaseDate}）`);
    lines.push(`- 參數：${m.parameters}｜Context：${m.contextWindow}｜${m.license}｜${m.category}${m.isFlagship ? '｜旗艦' : ''}${m.isReasoning ? '｜推理' : ''}`);
    if (m.estimated?.length) lines.push(`- 推估欄位：${m.estimated.join('、')}`);
    lines.push(`- ${m.highlights}`);
    lines.push(`- 官方連結：${m.officialUrl}`);
    if (sources.length) lines.push(`- 查證來源：${sources.join('、')}`);
    lines.push('');
  }

  if (rejected.length) {
    lines.push(`## 未通過格式驗證 ${rejected.length} 筆（未寫入）`, '');
    for (const r of rejected) lines.push(`- ${r.model.name ?? r.model.id}：${r.errors.join('；')}`);
    lines.push('');
  }

  if (skipped.length) {
    lines.push('<details>', `<summary>Claude 判斷不收錄的候選（${skipped.length}）</summary>`, '');
    for (const s of skipped) lines.push(`- ${s.candidate}：${s.reason}${s.recheck ? '（之後再看）' : ''}`);
    lines.push('', '</details>', '');
  }

  lines.push(`候選來源：${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join('、')}`);
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
  const existing = await readJson(MODELS_PATH, null);
  if (!Array.isArray(existing)) throw new Error('讀不到 src/data/models.json');

  console.log(`🔎 收集 ${cutoff} 之後的候選模型…`);
  const settled = await Promise.allSettled([collectOpenRouter(cutoff), collectHuggingFace(cutoff), collectNews(cutoff)]);
  const labels = ['OpenRouter', 'Hugging Face', '新聞'];
  const counts = {};
  const all = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      counts[labels[i]] = r.value.length;
      all.push(...r.value);
    } else {
      counts[labels[i]] = '失敗';
      console.warn(`[WARN] ${labels[i]} 收集失敗：${r.reason?.message ?? r.reason}`);
    }
  });

  const reviewed = await readJson(REVIEWED_PATH, {});
  const fresh = dropKnown(all, existing).filter((c) => !reviewed[c.key]);
  console.log(`   共 ${all.length} 筆候選，扣掉已收錄與已審過後剩 ${fresh.length} 筆`);
  for (const c of fresh) console.log(`   - [${c.source}] ${c.provider}｜${c.name}｜${c.date}`);

  await setActionOutput('added', 0);
  if (fresh.length === 0) {
    console.log('✅ 沒有新的候選，不需要呼叫 Claude。');
    return;
  }
  if (dryRun) {
    console.log('ℹ️ 未設定 ANTHROPIC_API_KEY 或使用 --dry-run：只列出候選，不呼叫 API、不寫入檔案。');
    return;
  }

  console.log(`🤖 交給 ${MODEL}（effort: ${EFFORT}）查證與整理…`);
  const result = await reviewWithClaude(fresh, existing, today);
  const { models, added, rejected } = mergeProposals(existing, result.models ?? [], today);

  const nextReviewed = nextReviewedState(reviewed, fresh, result, today, daysAgoISO(LOOKBACK_DAYS + 7));
  const pending = fresh.filter((c) => !nextReviewed[c.key]);
  if (pending.length) console.log(`   ${pending.length} 筆候選標記為之後再看或未被處理，下次會再送審`);
  await fs.mkdir(path.dirname(REVIEWED_PATH), { recursive: true });
  await fs.writeFile(REVIEWED_PATH, `${JSON.stringify(nextReviewed, null, 2)}\n`, 'utf-8');

  if (added.length) {
    await fs.writeFile(MODELS_PATH, `${JSON.stringify(models, null, 2)}\n`, 'utf-8');
  }
  await setActionOutput('added', added.length);

  const summary = buildSummary({ added, rejected, skipped: result.skipped ?? [], counts, today });
  if (process.env.MODEL_UPDATE_SUMMARY) await fs.writeFile(process.env.MODEL_UPDATE_SUMMARY, summary, 'utf-8');
  console.log(`\n${summary}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`❌ ${err.stack ?? err}`);
    process.exit(1);
  });
}
