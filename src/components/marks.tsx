import React from 'react';
import { AIModel } from '../types';
import { PROVIDERS } from '../data/modelsData';
import { isEstimated, paramsDisclosed } from '../lib/format';

/** 推理模型用菱形、一般模型用圓形；形狀而非顏色承載「推理」 */
export const ModelShape: React.FC<{ model: AIModel; size?: number; hollow?: boolean; onPaper?: boolean }> = ({
  model,
  size = 10,
  hollow = false,
  onPaper = false,
}) => {
  const color = PROVIDERS[model.provider].color;
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: hollow ? 'transparent' : color,
    border: `2px solid ${color}`,
    boxShadow: onPaper ? "0 0 0 1px rgba(42, 36, 31, 0.55)" : undefined,
  };
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${model.isReasoning ? 'rotate-45 scale-90' : 'rounded-full'}`}
      style={style}
    />
  );
};

export const ProviderDot: React.FC<{ color: string }> = ({ color }) => (
  <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
);

const EST_TITLE = '非官方數字，依公開報導推估';

export const ParamsValue: React.FC<{ model: AIModel }> = ({ model }) => {
  if (!paramsDisclosed(model)) return <span className="text-muted">未公開</span>;
  if (isEstimated(model, 'parameters'))
    return (
      <span className="est" title={EST_TITLE}>
        ≈{model.parameters.replace(/^~/, '').replace(/\s*\(?MoE 預估\)?/, ' MoE')}
      </span>
    );
  return <span>{model.parameters}</span>;
};

export const ContextValue: React.FC<{ model: AIModel }> = ({ model }) =>
  isEstimated(model, 'context') ? (
    <span className="est" title={EST_TITLE}>
      ≈{model.contextWindow}
    </span>
  ) : (
    <span>{model.contextWindow}</span>
  );
