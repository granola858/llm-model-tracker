export type ProviderId =
  | 'OpenAI'
  | 'Anthropic'
  | 'Google'
  | 'Meta'
  | 'xAI'
  | 'Mistral'
  | 'DeepSeek'
  | 'Qwen';

export type LicenseType = 'Proprietary' | 'Open-Weights';

export type ModelCategory = 'Flagship' | 'General' | 'Reasoning' | 'Lightweight' | 'Multimodal' | 'Coding';

export interface AIModel {
  id: string;
  name: string;
  provider: ProviderId;
  releaseDate: string; // YYYY-MM-DD
  parameters: string;
  contextWindow: string;
  contextTokens: number; // Numeric value for sorting/charting
  modalities: string[];
  license: LicenseType;
  category: ModelCategory;
  /** 這筆發布讓該廠商的最強模型換成新版本（判定條件見 PRODUCT.md） */
  isFlagship: boolean;
  isReasoning: boolean;
  /** 未經官方證實、由公開報導推估的規格欄位 */
  estimated?: Array<'parameters' | 'context'>;
  highlights: string;
  officialUrl: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  providerTag?: ProviderId | 'General';
  publishedAt: string; // ISO string or YYYY-MM-DD HH:mm
}

export interface NewsDataPayload {
  lastUpdated: string;
  totalSources: number;
  items: NewsItem[];
}

/** near＝時間說得準、by＝只知道在 date 之前、after＝到 date 都不到一半機率 */
export type PredictionPrecision = 'near' | 'by' | 'after';

/** 下一代旗艦的市場預測，不是官方消息；由 scripts/fetch-predictions.mjs 產生 */
export interface Prediction {
  provider: ProviderId;
  name: string;
  date: string; // YYYY-MM-DD
  precision: PredictionPrecision;
  probability: number; // date 之前發布的機率，0–1
  url: string;
}

export interface PredictionsPayload {
  lastUpdated: string;
  items: Prediction[];
}
