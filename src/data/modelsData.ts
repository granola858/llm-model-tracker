import { AIModel, ProviderId } from '../types';
import modelsJson from './models.json';

export interface ProviderMeta {
  id: ProviderId;
  /** 介面上統一使用的短名 */
  name: string;
  /** 夜間墨底上的資料點顏色；避開朱紅（紅日）與農民曆綠（新增）兩個保留色 */
  color: string;
  website: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  OpenAI: { id: 'OpenAI', name: 'OpenAI', color: '#56c1d6', website: 'https://openai.com' },
  Anthropic: { id: 'Anthropic', name: 'Anthropic', color: '#d98a6a', website: 'https://www.anthropic.com' },
  Google: { id: 'Google', name: 'Google', color: '#e3c75a', website: 'https://deepmind.google' },
  Meta: { id: 'Meta', name: 'Meta', color: '#9a9cf2', website: 'https://ai.meta.com' },
  xAI: { id: 'xAI', name: 'xAI', color: '#d9d4cb', website: 'https://x.ai' },
  Mistral: { id: 'Mistral', name: 'Mistral', color: '#f0a03c', website: 'https://mistral.ai' },
  DeepSeek: { id: 'DeepSeek', name: 'DeepSeek', color: '#5f97f5', website: 'https://www.deepseek.com' },
  Qwen: { id: 'Qwen', name: 'Qwen', color: '#c787e8', website: 'https://qwen.ai' },
};

/**
 * 模型清單存放在 models.json，由 scripts/fetch-models.mjs 自動提出新增（經 PR 審核後合併），
 * 也可以直接手動編輯；格式由 scripts/validate-models.mjs 檢查。
 */
export const INITIAL_MODELS = modelsJson as AIModel[];
