import React from 'react';

interface Props {
  children: React.ReactNode;
}

/** 沒攔到的錯誤退到這裡，不讓整頁白屏 */
export class ErrorBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-base">頁面發生錯誤</p>
        <button
          type="button"
          // 回到不帶網址參數的預設狀態，避免同一組參數重新載入後又出錯
          onClick={() => window.location.assign(window.location.pathname)}
          className="rounded-sm border border-rule px-4 py-1.5 text-sm text-paper-dim hover:text-paper"
        >
          重新載入
        </button>
      </div>
    );
  }
}
