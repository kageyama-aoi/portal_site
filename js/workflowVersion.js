/**
 * @file workflowVersion.js
 * @brief 作業フローの版管理に使う純粋関数群。DOM・localStorage・fetch に依存しない。
 *        配布HTMLの「どの版か」を特定し、口頭で照合できるコードを作るためのもの。
 * @module workflowVersion
 */

/**
 * djb2 系の軽量文字列ハッシュ。暗号用途ではなく「内容が変わったか」の判定と
 * 短い照合コード生成のためだけに使う。
 * @param {string} str
 * @returns {number} 符号なし32bit整数
 */
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) + str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/**
 * 版の同一性判定に使う「内容部分」だけを正規化した文字列を返す。
 * 対象は title + description + steps(title/memo/prompt/promptType/linkId)。
 * freq・tags・rev・updatedAt などのメタ情報は含めない（変更しても版は上がらない）。
 * @param {object} wf
 * @returns {string}
 */
export function normalizeWorkflowContent(wf) {
  if (!wf || typeof wf !== 'object') return '';
  const steps = Array.isArray(wf.steps) ? wf.steps : [];
  const normSteps = steps.map(s => ({
    t: s.title || '',
    m: s.memo || '',
    p: s.prompt || '',
    pt: s.promptType || 'none',
    l: s.linkId || null
  }));
  return JSON.stringify({
    title: wf.title || '',
    description: wf.description || '',
    steps: normSteps
  });
}

/**
 * 内容ハッシュを英数字8文字で返す。
 * コミットSHA（16進）と見分けられるよう base36 で整形する。
 * @param {object} wf
 * @returns {string} 8文字の英数字
 */
export function workflowContentHash(wf) {
  const s = normalizeWorkflowContent(wf);
  const a = djb2(s);
  const b = djb2(s.split('').reverse().join('') + '::salt');
  return (a.toString(36) + '00000000').slice(0, 4) + (b.toString(36) + '00000000').slice(0, 4);
}

// 紛らわしい I/O/0/1 を除いた照合コード用アルファベット
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * 受領者と口頭で照合するための「照合コード」を生成する。
 * 形式: R{rev}-{MMDD}-{4文字}  例: R3-0827-KTMR
 * 16進8桁（＝コミットSHA連想）を避けるため、末尾は専用アルファベット4文字にする。
 * @param {number} rev
 * @param {string} contentHash - workflowContentHash() の値
 * @param {string|Date} [updatedAt] - 版の更新日。MMDD 部分に使う。
 * @returns {string}
 */
export function verificationCode(rev, contentHash, updatedAt) {
  const safeRev = (typeof rev === 'number' && rev >= 1) ? rev : 1;
  const d = updatedAt ? new Date(updatedAt) : new Date();
  const mmdd = isNaN(d.getTime())
    ? '0000'
    : String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  let seed = djb2(safeRev + ':' + (contentHash || ''));
  let tail = '';
  for (let i = 0; i < 4; i++) {
    tail += CODE_ALPHABET[seed % CODE_ALPHABET.length];
    seed = Math.floor(seed / CODE_ALPHABET.length) + 7;
  }
  return `R${safeRev}-${mmdd}-${tail}`;
}

/**
 * ワークフローに版情報フィールド（rev / updatedAt / contentHash）を補完する。
 * 旧データ（rev 無し）の読み込み時に使う。破壊的に wf を書き換える。
 * @param {object} wf
 * @param {string} [nowIso] - updatedAt 補完に使う時刻
 * @returns {boolean} 何か補った場合 true
 */
export function ensureVersionFields(wf, nowIso) {
  if (!wf || typeof wf !== 'object') return false;
  let changed = false;
  if (typeof wf.rev !== 'number' || wf.rev < 1) {
    wf.rev = 1;
    changed = true;
  }
  const hash = workflowContentHash(wf);
  if (wf.contentHash !== hash) {
    wf.contentHash = hash;
    changed = true;
  }
  if (!wf.updatedAt) {
    wf.updatedAt = nowIso || new Date().toISOString();
    changed = true;
  }
  return changed;
}

/**
 * 内容が変わっていれば rev を +1 し、updatedAt / contentHash を更新する。
 * WorkflowManager が保存系メソッドの最後に呼ぶ。
 * 初回（contentHash 未設定）はハッシュだけ記録し、rev は据え置く。
 * @param {object} wf
 * @param {string} [nowIso]
 * @returns {boolean} rev を上げた場合 true
 */
export function bumpRevIfContentChanged(wf, nowIso) {
  if (!wf || typeof wf !== 'object') return false;
  if (typeof wf.rev !== 'number' || wf.rev < 1) wf.rev = 1;
  const newHash = workflowContentHash(wf);
  const prevHash = wf.contentHash;
  if (prevHash === undefined || prevHash === null) {
    wf.contentHash = newHash;
    if (!wf.updatedAt) wf.updatedAt = nowIso || new Date().toISOString();
    return false;
  }
  if (newHash === prevHash) return false;
  wf.rev += 1;
  wf.contentHash = newHash;
  wf.updatedAt = nowIso || new Date().toISOString();
  return true;
}
