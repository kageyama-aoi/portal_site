/**
 * @file clipboard.js
 * @brief クリップボードコピー（Clipboard API ＋ execCommand フォールバック）。アプリ内UI用。
 *        出力HTML（単体ファイル）側は自前の実装を持つ（モジュールを import できないため）。
 * @module util/clipboard
 */

/**
 * @private execCommand('copy') を使ったフォールバックコピー。
 * @param {string} text
 * @returns {boolean} 成功したか
 */
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

/**
 * テキストをクリップボードにコピーします。
 * Clipboard API が使えない / 失敗した場合は execCommand へフォールバックします。
 * @param {string} text
 * @param {(ok: boolean) => void} [onResult] - 成否を受け取るコールバック。
 */
export function copyToClipboard(text, onResult = () => {}) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(
      () => onResult(true),
      () => onResult(fallbackCopy(text))
    );
  } else {
    onResult(fallbackCopy(text));
  }
}
