/**
 * @file workflowConstants.js
 * @brief 作業フロー関連の共有定数。UI・ワークフローダイアログ・エクスポートで使う。
 * @module workflowConstants
 */

/**
 * 頻度コード → 日本語ラベル。
 * @type {Record<'daily'|'weekly'|'monthly'|'rare', string>}
 */
export const FREQ_LABELS = {
  daily: '毎日',
  weekly: '週次',
  monthly: '月次',
  rare: 'たまに'
};

/**
 * 頻度コードの日本語ラベルを返します。未知・未設定なら空文字。
 * @param {string} [freq]
 * @returns {string}
 */
export function freqLabel(freq) {
  return FREQ_LABELS[freq] || '';
}
