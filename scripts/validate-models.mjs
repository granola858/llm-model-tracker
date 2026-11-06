#!/usr/bin/env node
/**
 * scripts/validate-models.mjs
 * 檢查 src/data/models.json 的每一筆模型是否符合 AIModel 格式、id 是否重複。
 * 有錯誤時以非零狀態碼結束，讓 CI 擋下有問題的資料。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateModelList } from './lib/model-schema.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODELS_PATH = path.resolve(here, '../src/data/models.json');

const models = JSON.parse(await fs.readFile(MODELS_PATH, 'utf-8'));
if (!Array.isArray(models)) {
  console.error('❌ models.json 最外層必須是陣列');
  process.exit(1);
}

const problems = validateModelList(models);
if (problems.length) {
  for (const p of problems) console.error(`❌ #${p.index} ${p.id ?? '(無 id)'}：${p.errors.join('；')}`);
  process.exit(1);
}
console.log(`✅ models.json 共 ${models.length} 筆，格式全部正確`);
