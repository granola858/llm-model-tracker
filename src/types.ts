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

export type ModelCategory = 'Flagship' | 'Reasoning' | 'Lightweight' | 'Multimodal' | 'Coding';

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
  /** 這筆發布包含該廠商當時最高階的主力模型；與 category 互不影響 */
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
