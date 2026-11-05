import React, { useState } from 'react';
import { AIModel, LicenseType, ModelCategory, ProviderId } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { X, PlusCircle } from 'lucide-react';

interface AddModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (model: AIModel) => void;
}

export const AddModelModal: React.FC<AddModelModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<ProviderId>('OpenAI');
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [parameters, setParameters] = useState('未公開');
  const [contextWindow, setContextWindow] = useState('128K');
  const [contextTokens, setContextTokens] = useState(128000);
  const [license, setLicense] = useState<LicenseType>('Proprietary');
  const [category, setCategory] = useState<ModelCategory>('Flagship');
  const [isReasoning, setIsReasoning] = useState(false);
  const [modalities, setModalities] = useState<string[]>(['Text', 'Vision']);
  const [highlights, setHighlights] = useState('');
  const [officialUrl, setOfficialUrl] = useState('https://');

  if (!isOpen) return null;

  const toggleModality = (mod: string) => {
    setModalities((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newModel: AIModel = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      provider,
      releaseDate,
      parameters: parameters.trim() || '未公開',
      contextWindow: contextWindow.trim() || '128K',
      contextTokens: Number(contextTokens) || 128000,
      modalities: modalities.length > 0 ? modalities : ['Text'],
      license,
      category,
      isReasoning,
      highlights: highlights.trim() || '使用者自訂新增之 AI 模型紀錄。',
      officialUrl: officialUrl.trim() || PROVIDERS[provider].website,
    };

    onAdd(newModel);
    setName('');
    setHighlights('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            新增追蹤 AI 模型紀錄
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">研發廠商 *</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderId)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDERS[p].name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">發佈日期 *</label>
              <input
                type="date"
                required
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">模型名稱 *</label>
            <input
              type="text"
              required
              placeholder="例如：GPT-5.5 Turbo / Claude 4.5 Opus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">參數規模</label>
              <input
                type="text"
                placeholder="例如：671B (37B Active)"
                value={parameters}
                onChange={(e) => setParameters(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">上下文顯示文字</label>
              <input
                type="text"
                placeholder="例如：200K / 2M"
                value={contextWindow}
                onChange={(e) => setContextWindow(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">上下文 Token 數</label>
              <input
                type="number"
                value={contextTokens}
                onChange={(e) => setContextTokens(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1">授權模式</label>
              <select
                value={license}
                onChange={(e) => setLicense(e.target.value as LicenseType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="Proprietary">閉源商用 (Proprietary)</option>
                <option value="Open-Weights">開源權重 (Open-Weights)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">模型定位類別</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ModelCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="Flagship">Flagship (旗艦通用)</option>
                <option value="Reasoning">Reasoning (深度推理)</option>
                <option value="Multimodal">Multimodal (全模態)</option>
                <option value="Coding">Coding (軟體工程)</option>
                <option value="Lightweight">Lightweight (輕量端側)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <div>
              <span className="block text-slate-300 font-medium mb-1.5">支援模態</span>
              <div className="flex flex-wrap gap-2">
                {['Text', 'Vision', 'Audio', 'Video'].map((mod) => (
                  <button
                    type="button"
                    key={mod}
                    onClick={() => toggleModality(mod)}
                    className={`px-2.5 py-1 rounded-md border text-xs font-medium cursor-pointer ${
                      modalities.includes(mod)
                        ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {mod}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isReasoning}
                onChange={(e) => setIsReasoning(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-amber-300 font-semibold">具備思維鏈推理 (Reasoning)</span>
            </label>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">重點特色與里程碑描述</label>
            <textarea
              rows={2}
              placeholder="簡述該模型的架構創新、基準表現或關鍵功能..."
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">官方發佈或論文連結</label>
            <input
              type="url"
              value={officialUrl}
              onChange={(e) => setOfficialUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              儲存並加入時間軸
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
