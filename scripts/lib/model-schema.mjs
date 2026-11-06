/**
 * scripts/lib/model-schema.mjs
 * models.json 的欄位規則，與 src/types.ts 的 AIModel 保持一致。
 * fetch-models.mjs（LLM 產生的資料）與 validate-models.mjs（CI 檢查）共用。
 */

export const PROVIDER_IDS = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'xAI', 'Mistral', 'DeepSeek', 'Qwen'];
export const LICENSES = ['Proprietary', 'Open-Weights'];
export const CATEGORIES = ['Flagship', 'Reasoning', 'Lightweight', 'Multimodal', 'Coding'];
export const MODALITIES = ['Text', 'Vision', 'Audio', 'Video'];
export const ESTIMATED_FIELDS = ['parameters', 'context'];

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * 檢查單一模型，回傳錯誤訊息陣列（空陣列代表通過）。
 * @param {unknown} m
 * @param {{ today?: string }} [opts] today 用來擋掉未來日期（YYYY-MM-DD）
 */
export function validateModel(m, opts = {}) {
  const errors = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return ['不是物件'];

  const allowed = new Set([
    'id', 'name', 'provider', 'releaseDate', 'parameters', 'contextWindow', 'contextTokens',
    'modalities', 'license', 'category', 'isReasoning', 'estimated', 'highlights', 'officialUrl',
  ]);
  for (const key of Object.keys(m)) {
    if (!allowed.has(key)) errors.push(`多出未知欄位 ${key}`);
  }

  if (!isNonEmptyString(m.id) || !ID_PATTERN.test(m.id)) errors.push(`id 格式錯誤：${m.id}`);
  for (const key of ['name', 'parameters', 'contextWindow', 'highlights']) {
    if (!isNonEmptyString(m[key])) errors.push(`${key} 不可為空`);
  }
  if (!PROVIDER_IDS.includes(m.provider)) errors.push(`provider 不在清單內：${m.provider}`);
  if (!LICENSES.includes(m.license)) errors.push(`license 不在清單內：${m.license}`);
  if (!CATEGORIES.includes(m.category)) errors.push(`category 不在清單內：${m.category}`);
  if (typeof m.isReasoning !== 'boolean') errors.push('isReasoning 必須是布林值');

  if (!isNonEmptyString(m.releaseDate) || !isRealDate(m.releaseDate)) {
    errors.push(`releaseDate 不是有效的 YYYY-MM-DD：${m.releaseDate}`);
  } else if (opts.today && m.releaseDate > opts.today) {
    errors.push(`releaseDate 在未來：${m.releaseDate}`);
  }

  if (!Number.isInteger(m.contextTokens) || m.contextTokens <= 0) {
    errors.push(`contextTokens 必須是正整數：${m.contextTokens}`);
  }

  if (!Array.isArray(m.modalities) || m.modalities.length === 0) {
    errors.push('modalities 至少要有一項');
  } else {
    for (const x of m.modalities) if (!MODALITIES.includes(x)) errors.push(`modalities 含未知值：${x}`);
    if (new Set(m.modalities).size !== m.modalities.length) errors.push('modalities 有重複值');
  }

  if (m.estimated !== undefined) {
    if (!Array.isArray(m.estimated)) errors.push('estimated 必須是陣列');
    else for (const x of m.estimated) if (!ESTIMATED_FIELDS.includes(x)) errors.push(`estimated 含未知值：${x}`);
  }

  try {
    const u = new URL(m.officialUrl);
    if (u.protocol !== 'https:') errors.push(`officialUrl 必須是 https：${m.officialUrl}`);
  } catch {
    errors.push(`officialUrl 不是有效網址：${m.officialUrl}`);
  }

  return errors;
}

/**
 * 檢查整份清單（含 id 重複），回傳 `{ index, id, errors }[]`。
 * @param {unknown[]} models
 * @param {{ today?: string }} [opts]
 */
export function validateModelList(models, opts = {}) {
  const problems = [];
  const seen = new Map();
  models.forEach((m, index) => {
    const errors = validateModel(m, opts);
    const id = m && typeof m === 'object' ? m.id : undefined;
    if (typeof id === 'string') {
      if (seen.has(id)) errors.push(`id 與第 ${seen.get(id)} 筆重複`);
      else seen.set(id, index);
    }
    if (errors.length) problems.push({ index, id, errors });
  });
  return problems;
}
