/**
 * @file tagSuggest.js
 * @brief タグ入力欄（カンマ区切り）向けの共通サジェストドロップダウン。
 *        新規タグは自由入力・既存タグは候補から選択、の両方を成立させる。
 *        linkDialog.js と workflowDialog.js の両方から使われる。
 * @module tagSuggest
 */

/**
 * カンマ区切りのタグ入力欄に、既存タグを候補表示するサジェストUIを設定します。
 * 「今入力中の1タグ分」（最後のカンマより後ろ）だけを対象に候補を絞り込みます。
 * @param {object} opts
 * @param {HTMLInputElement} opts.inputEl - タグ入力欄。
 * @param {HTMLElement} opts.boxEl - 候補を表示するドロップダウン要素。
 * @param {() => string[]} opts.getKnownTags - 候補となるタグ一覧を返す関数。
 *   呼び出し側でキャッシュした配列を返すこと（キー入力のたびに全リンクを
 *   スキャンし直すと、リンク数が多いポータルで入力が重くなるため）。
 */
export function initTagsSuggest({ inputEl, boxEl, getKnownTags }) {
  if (!inputEl || !boxEl) return;

  const currentSegment = () => {
    const parts = inputEl.value.split(',');
    return parts[parts.length - 1].trim();
  };

  const showSuggestions = () => {
    const query = currentSegment().toLowerCase();
    const known = getKnownTags();
    const alreadyChosen = inputEl.value.split(',').map(t => t.trim()).filter(Boolean);
    const matches = known.filter(t =>
      !alreadyChosen.includes(t) && (!query || t.toLowerCase().includes(query))
    );

    if (matches.length === 0) {
      boxEl.style.display = 'none';
      return;
    }
    boxEl.innerHTML = '';
    matches.slice(0, 20).forEach(tag => {
      const item = document.createElement('div');
      item.className = 'tag-suggest-item';
      item.textContent = tag;
      // input の blur より先に選択を確定させたいので mousedown で処理する
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const parts = inputEl.value.split(',');
        parts[parts.length - 1] = ` ${tag}`;
        inputEl.value = parts.map(p => p.trim()).filter(Boolean).join(', ') + ', ';
        boxEl.style.display = 'none';
        inputEl.focus();
      });
      boxEl.appendChild(item);
    });
    boxEl.style.display = 'block';
  };

  inputEl.addEventListener('focus', showSuggestions);
  inputEl.addEventListener('input', showSuggestions);
  inputEl.addEventListener('blur', () => {
    // mousedown 側の preventDefault で選択は先に確定するため、少し遅らせて閉じる
    setTimeout(() => { boxEl.style.display = 'none'; }, 150);
  });
}
