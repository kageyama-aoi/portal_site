/**
 * @file html.js
 * @brief HTML 文字列生成で使う小さなユーティリティ。
 * @module util/html
 */

/**
 * HTML特殊文字（& < > "）をエスケープします。テキストノード・二重引用符属性値の両方で安全です。
 * null / undefined は空文字を返します。
 * @param {*} value - 文字列化してエスケープする値。
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
