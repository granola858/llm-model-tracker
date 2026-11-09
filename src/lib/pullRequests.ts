const REPO = 'granola858/llm-model-tracker';
// Dependabot 的 PR 只動 workflow 版本，跟網頁內容無關
const OPEN_PRS = 'is:pr is:open -author:app/dependabot';

// 通知的數字與點開的清單共用同一組條件，兩邊才對得上
export const PR_LIST_URL = `https://github.com/${REPO}/pulls?q=${encodeURIComponent(OPEN_PRS)}`;
export const PR_COUNT_URL = `https://api.github.com/search/issues?per_page=1&q=${encodeURIComponent(`repo:${REPO} ${OPEN_PRS}`)}`;

/** PR 連結的 aria-label 與 tooltip；null 表示還沒查到或查詢失敗（快照見 tests/） */
export function prLinkLabel(count: number | null): string {
  if (count === null) return 'PR 列表';
  return count === 0 ? 'PR 列表：沒有待處理' : `PR 列表：${count} 個待處理`;
}
