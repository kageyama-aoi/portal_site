/**
 * @file workflowExporter.js
 * @brief 作業フローを配布用の単体HTML / 印刷用HTML(PDF) として書き出す。
 *        UI のDOM描画とは独立。事前に解決済みの workflows 配列と、
 *        リンク解決関数・ポータル情報・配布メタを受け取るモジュール。
 * @module workflowExporter
 */

import { escapeHtml } from './util/html.js';
import { verificationCode } from './workflowVersion.js';
import { freqLabel } from './workflowConstants.js';

/**
 * @typedef {object} ExportOptions
 * @property {{title?: string, subtitle?: string}|null} portal - アクティブポータル情報。
 * @property {(linkId: string) => ({link: object}|null)} resolveLink - リンクID→リンク解決。
 * @property {{reviewDue?: string, sourceHint?: string}} [exportMeta] - 出力ダイアログの入力値。
 */

/**
 * 作業フローを印刷用HTMLとして新規ウィンドウに開きます（ブラウザの印刷でPDF化）。
 * @param {object[]} workflows - 出力対象（空でない前提。呼び出し側で絞り込み済み）。
 * @param {ExportOptions} opts
 */
export function exportWorkflowsAsPdf(workflows, opts = {}) {
  const { portal, resolveLink, exportMeta = {} } = opts;
    const esc = (s) => escapeHtml(s);
    const sourceHint = (exportMeta && exportMeta.sourceHint) ? String(exportMeta.sourceHint) : '';

    const workflowsHtml = workflows.map(wf => {
      const rev = wf.rev || 1;
      const code = verificationCode(rev, wf.contentHash, wf.updatedAt);
      const updatedDate = wf.updatedAt
        ? new Date(wf.updatedAt).toLocaleDateString('ja-JP')
        : new Date().toLocaleDateString('ja-JP');
      const freq = freqLabel(wf.freq);
      const tags = (wf.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');

      const stepsHtml = wf.steps.map(step => {
        // 手順書としては「手順名」が主役なので、リンクは資料名を控えめに示す程度に留める。
        // ローカルパスも生のパスをそのまま前面に出さず、資料名を主表示・パスは小さい補足にする。
        let linkHtml = '';
        if (step.linkId) {
          const found = resolveLink(step.linkId);
          if (found) {
            const isLocal = found.link.url?.startsWith('opendir:');
            if (isLocal) {
              const path = found.link.url.replace('opendir:', '');
              linkHtml = `<div class="link-name">📁 ${esc(found.link.title)}</div><div class="link-path">${esc(path)}</div>`;
            } else {
              linkHtml = `<div class="link-name">🔗 <a href="${esc(found.link.url)}" class="link-url">${esc(found.link.title)}</a></div>`;
            }
          }
        }
        return `<tr>
          <td class="step-num">${step.step}</td>
          <td class="step-body">
            <div class="step-title">${esc(step.title)}</div>
            ${step.memo ? `<div class="step-memo">${esc(step.memo)}</div>` : ''}
          </td>
          <td class="step-resource">${linkHtml}</td>
        </tr>`;
      }).join('');

      return `<div class="workflow">
        <div class="wf-header">
          <h2>${esc(wf.title)}</h2>
          ${freq ? `<span class="freq-badge">${freq}</span>` : ''}
          <span class="wf-version">v${rev} ・ ${esc(updatedDate)} ・ ${esc(code)}</span>
        </div>
        ${wf.description ? `<p class="wf-desc">${esc(wf.description)}</p>` : ''}
        ${tags ? `<div class="wf-tags">${tags}</div>` : ''}
        <table class="steps-table"><tbody>${stepsHtml}</tbody></table>
      </div>`;
    }).join('');

    const title = portal?.title || '作業フロー';
    const subtitle = portal?.subtitle || '';
    const today = new Date().toLocaleDateString('ja-JP');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)} - 作業フロー</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 11pt; color: #1B2421; background: #fff; padding: 20mm 15mm; }
    h1 { font-size: 18pt; margin-bottom: 4px; }
    .subtitle { font-size: 10pt; color: #57645E; margin-bottom: 6px; }
    .export-date { font-size: 9pt; color: #8B968F; margin-bottom: 6px; }
    .dist-hint { font-size: 9pt; color: #57645E; margin-bottom: 24px; }
    .workflow { margin-bottom: 24px; border: 1px solid #DCE3DF; border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
    .wf-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #EAF0EE; border-bottom: 1px solid #DCE3DF; flex-wrap: wrap; }
    .wf-header h2 { font-size: 13pt; flex: 1; }
    .wf-version { font-size: 7.5pt; font-weight: 600; color: #57645E; background: #DCE3DF; padding: 1px 7px; border-radius: 8px; white-space: nowrap; }
    .freq-badge { font-size: 8pt; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: #d1fae5; color: #059669; white-space: nowrap; }
    .wf-desc { padding: 6px 14px; font-size: 10pt; color: #57645E; border-bottom: 1px solid #E8EDEA; }
    .wf-tags { padding: 4px 14px 6px; border-bottom: 1px solid #E8EDEA; }
    .tag { display: inline-block; font-size: 8.5pt; padding: 1px 6px; border-radius: 8px; background: #DCE3DF; color: #57645E; margin-right: 4px; }
    .steps-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .step-num { width: 36px; text-align: center; font-weight: 700; font-size: 10pt; color: #fff; background: #1F5F4A; vertical-align: top; padding: 10px 4px; }
    .step-body { padding: 10px 14px; vertical-align: top; border-bottom: 1px solid #E8EDEA; }
    /* 手順名・説明は左詰めの本文欄、資料（リンク）は右側の専用列にして
       本文と資料が同じ開始位置に並んで見えないようにする。資料は行の下端に揃える。 */
    .step-resource { width: 40%; padding: 10px 14px; vertical-align: bottom; border-bottom: 1px solid #E8EDEA; text-align: left; }
    .steps-table tr:last-child .step-body,
    .steps-table tr:last-child .step-num,
    .steps-table tr:last-child .step-resource { border-bottom: none; }
    .step-title { font-weight: 600; font-size: 11pt; }
    .step-memo { font-size: 10pt; font-weight: 400; color: #1B2421; margin-top: 3px; }
    .link-name { font-size: 9.5pt; color: #57645E; }
    .link-name .link-url { color: #57645E; text-decoration: none; }
    .link-path { font-size: 8pt; color: #9AA69F; font-family: monospace; margin-top: 1px; }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; size: A4; }
    }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ''}
  <div class="export-date">出力日: ${today}</div>
  ${sourceHint ? `<div class="dist-hint">最新版の入手先: ${esc(sourceHint)}</div>` : ''}
  ${workflowsHtml}
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
}

/**
 * 作業フローをサーバー不要・単体で動作するHTMLファイルとしてダウンロードさせます。
 * プロンプトコピー・リンク移動・内容編集＋再保存・チェックリスト・改変検知に対応。
 * @param {object[]} workflows - 出力対象（空でない前提）。
 * @param {ExportOptions} opts
 */
export function exportWorkflowsAsHtml(workflows, opts = {}) {
  const { portal, resolveLink, exportMeta = {} } = opts;
    const esc = (s) => escapeHtml(s);

    // 改変検知の基準値。配布時点の [data-editable] / .link-input の値を DOM 出現順に並べる。
    // 属性値だと改行が正規化されてしまうため、JSON にまとめて埋め込む。
    const baseEditables = [];
    const baseLinkInputs = [];
    const recEditable = (raw) => { baseEditables.push(raw == null ? '' : String(raw)); return esc(raw || ''); };
    const recLinkInput = (raw) => { baseLinkInputs.push(raw == null ? '' : String(raw)); return esc(raw || ''); };

    // wf-meta 用の版情報（配布物には Git 由来の文字列を一切入れない）
    const metaWorkflows = [];

    const pageTitle = portal?.title || '作業フロー';
    const pageSubtitle = portal?.subtitle || '';
    // ページ見出し（h1 → subtitle）は全ワークフローより前に DOM に出るので、真っ先に基準値を記録する
    const pageTitleHtml = recEditable(pageTitle);
    const pageSubtitleHtml = pageSubtitle ? recEditable(pageSubtitle) : '';

    const workflowsHtml = workflows.map(wf => {
      const rev = wf.rev || 1;
      const code = verificationCode(rev, wf.contentHash, wf.updatedAt);
      const updatedDate = wf.updatedAt
        ? new Date(wf.updatedAt).toLocaleDateString('ja-JP')
        : new Date().toLocaleDateString('ja-JP');
      metaWorkflows.push({ workflowId: wf.id, title: wf.title, rev, contentHash: wf.contentHash || '', code });

      const freq = freqLabel(wf.freq);
      const tags = (wf.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');

      // 改変検知の基準値は DOM 出現順に記録する必要があるため、
      // 見出し（h2 → wf-desc）を先に記録してからステップを組み立てる。
      const wfTitleHtml = recEditable(wf.title);
      const wfDescHtml = wf.description ? recEditable(wf.description) : '';

      const stepsHtml = wf.steps.map((step, stepIdx) => {
        let linkHtml = '';
        if (step.linkId) {
          const found = resolveLink(step.linkId);
          if (found && found.link.url) {
            const isLocal = found.link.url.startsWith('opendir:');
            // ローカルパスは opendir: を付けたままコピーすると、PowerShell等の
            // ターミナルに貼り付けた際にプロトコルURIとして解釈されず構文エラーになる
            // （かっこ等を含むフォルダ名だと特に顕著）。コピー・表示は生パスにし、
            // 「開く」を押したときだけ opendir: を付けてプロトコルハンドラに渡す。
            const displayValue = isLocal ? found.link.url.replace('opendir:', '') : found.link.url;
            // 手順書としては「手順名」が主役なので、資料名を控えめなラベルとして主表示にし、
            // 生のパス／URLとコピー・開くボタンはその下に一段小さく添える。
            linkHtml = `
              <div class="link-block${isLocal ? ' link-block-local' : ''}">
                <div class="link-name"><span class="icon-txt">${isLocal ? '📁' : '🔗'}</span> ${esc(found.link.title)}</div>
                <div class="link-controls">
                  <input type="text" class="link-input" value="${recLinkInput(displayValue)}" spellcheck="false" readonly ${isLocal ? 'data-scheme="opendir:"' : ''}>
                  <button type="button" class="mini-btn open-btn" onclick="wfOpenLink(this)">開く</button>
                  <button type="button" class="mini-btn copy-btn" onclick="wfCopyLink(this)">コピー</button>
                </div>
              </div>`;
          }
        }
        const hasVisiblePrompt = step.prompt && (step.promptType || 'prompt') !== 'none';
        // step-title → step-memo → prompt-text の順で改変検知の基準値を記録する
        const stepTitleHtml = recEditable(step.title);
        const stepMemoHtml = recEditable(step.memo || '');
        let promptHtml = '';
        if (hasVisiblePrompt) {
          const ptMeta = {
            prompt: { icon: '🤖', label: 'プロンプト', cls: '' },
            code: { icon: '💻', label: 'コード', cls: 'pt-code' },
            text: { icon: '📝', label: 'テキスト', cls: 'pt-text' }
          }[step.promptType] || { icon: '🤖', label: 'プロンプト', cls: '' };
          const promptTextHtml = recEditable(step.prompt || '');
          // 折りたたみ/展開ボタンをテキスト末尾ではなくヘッダーに置く。
          // プロンプトが長いと、末尾のボタンを押すためだけに毎回一番下まで
          // スクロールする必要があり、閉じる時も同様に不便だったため。
          promptHtml = `
              <div class="prompt-block ${ptMeta.cls}">
                <div class="prompt-header">
                  <span>${ptMeta.icon} ${ptMeta.label}</span>
                  <div class="prompt-header-actions">
                    <button type="button" class="mini-btn prompt-toggle-btn" onclick="wfToggleClamp(this)" style="display:none;">▼ 続きを見る</button>
                    <button type="button" class="mini-btn copy-btn" onclick="wfCopyPrompt(this)">📋 コピー</button>
                  </div>
                </div>
                <div class="prompt-text wf-clamp" data-editable contenteditable="false" data-placeholder="${ptMeta.label}を入力/貼り付け...">${promptTextHtml}</div>
              </div>`;
        }
        // 本文（タイトル・説明・プロンプト）は左詰めの列、資料（リンク）は右側の
        // 専用列にして、本文の開始位置と資料が同列に見えないようにする。
        // 資料は行の下端に揃え、複数ステップを見たときに資料だけが縦に
        // 並んだ落ち着いた一覧のように見えるようにする。
        return `<div class="step" data-si="${stepIdx}">
          <label class="step-check"><input type="checkbox" class="step-checkbox" aria-label="このステップを完了にする"></label>
          <div class="step-num">${step.step}</div>
          <div class="step-body">
            <div class="step-title" data-editable contenteditable="false">${stepTitleHtml}</div>
            <div class="step-memo" data-editable contenteditable="false" data-placeholder="補足メモ">${stepMemoHtml}</div>
            ${promptHtml}
          </div>
          ${linkHtml ? `<div class="step-resource">${linkHtml}</div>` : ''}
        </div>`;
      }).join('');

      return `<div class="workflow" data-wf="${esc(wf.id)}">
        <div class="wf-header">
          <h2 data-editable contenteditable="false">${wfTitleHtml}</h2>
          ${freq ? `<span class="freq-badge">${freq}</span>` : ''}
          <span class="wf-version" title="配布バージョン（受領者との照合用）">v${rev} ・ ${esc(updatedDate)} ・ ${esc(code)}</span>
          <div class="wf-progress" title="チェック済みステップの割合">
            <svg viewBox="0 0 44 44"><circle class="wp-track" cx="22" cy="22" r="19"></circle><circle class="wp-bar" cx="22" cy="22" r="19"></circle></svg>
            <span class="wp-pct">0%</span>
            <button type="button" class="wp-reset" title="チェックをすべて外す" onclick="wfResetChecks(this)">↺</button>
          </div>
        </div>
        ${wfDescHtml ? `<p class="wf-desc" data-editable contenteditable="false">${wfDescHtml}</p>` : ''}
        ${tags ? `<div class="wf-tags">${tags}</div>` : ''}
        <div class="wf-done-toggle" style="display:none;">
          <button type="button" onclick="wfToggleDone(this)">✓ 完了 <span class="wf-done-count">0</span> 件 <span class="wf-done-caret">▸</span></button>
        </div>
        <div class="steps">${stepsHtml}</div>
      </div>`;
    }).join('');

    const title = pageTitle;
    const subtitle = pageSubtitle;
    const today = new Date().toLocaleDateString('ja-JP');
    const exportedAtIso = new Date().toISOString();
    const dateStamp = exportedAtIso.slice(0, 10).replace(/-/g, '');
    // 単一フロー出力（通常経路）ならファイル名に版を入れる
    const revTag = metaWorkflows.length === 1 ? `_v${metaWorkflows[0].rev}` : '';
    const singleTitle = metaWorkflows.length === 1 ? metaWorkflows[0].title : title;
    const baseFileName = `${singleTitle}${revTag}_${dateStamp}`;
    const baseFileNameJs = JSON.stringify(baseFileName).replace(/<\/script/gi, '<\\/script');

    // 配布メタ（Git 由来の文字列は入れない）。改変検知の基準値もここに同梱する。
    const reviewDue = (exportMeta && exportMeta.reviewDue) ? String(exportMeta.reviewDue) : '';
    const sourceHint = (exportMeta && exportMeta.sourceHint) ? String(exportMeta.sourceHint) : '';
    const wfMetaJson = JSON.stringify({
      schema: 1,
      exportedAt: exportedAtIso,
      portalTitle: title,
      reviewDue,
      sourceHint,
      workflows: metaWorkflows
    }).replace(/</g, '\\u003c');
    const wfBaselineJson = JSON.stringify({
      editables: baseEditables,
      linkInputs: baseLinkInputs
    }).replace(/</g, '\\u003c');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - 作業フロー</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif; font-size: 15px; color: #1B2421; background: #F3F5F3; padding: 24px 16px 64px; line-height: 1.45; }
  .page { max-width: 760px; margin: 0 auto; }
  .page-header { margin-bottom: 6px; }
  h1 { font-size: 1.5rem; margin-bottom: 2px; }
  .subtitle { font-size: 0.9rem; color: #57645E; }
  /* 出力日・整合バッジ・編集ロック状態・編集トグルを1行にまとめる */
  .meta-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; margin-bottom: 12px; font-size: 0.75rem; color: #8B968F; }
  .meta-bar .edit-toggle { margin-left: auto; }
  .meta-sep { color: #C7D0CB; }
  .export-date, .export-note { font-size: 0.75rem; color: #8B968F; white-space: nowrap; }
  .edit-toggle { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .edit-toggle-label { font-size: 0.78rem; font-weight: 600; color: #57645E; white-space: nowrap; }
  .switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch .slider { position: absolute; inset: 0; background: #C7D0CB; border-radius: 22px; cursor: pointer; transition: 0.15s; }
  .switch .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.15s; }
  .switch input:checked + .slider { background: #dc2626; }
  .switch input:checked + .slider:before { transform: translateX(18px); }
  .status-bar { display: inline-flex; align-items: center; gap: 5px; margin: 0; padding: 2px 9px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; cursor: help; }
  .status-bar.locked { background: #fffbeb; color: #92400e; border: 1px solid #fcd34d; }
  .status-bar.editing { background: #fef2f2; color: #991b1b; border: 1px solid #fca5a5; }
  .status-hint { font-weight: 400; opacity: 0.7; }
  .workflow { margin-top: 14px; background: #fff; border: 1px solid #DCE3DF; border-radius: 10px; overflow: hidden; }
  .wf-header { display: flex; align-items: center; gap: 10px; padding: 10px 18px; background: #EAF0EE; border-bottom: 1px solid #DCE3DF; flex-wrap: wrap; }
  .wf-header h2 { font-size: 1.1rem; flex: 1 1 40%; min-width: 0; outline: none; }
  /* 円形プログレス（チェック済みステップの割合） */
  .wf-progress { position: relative; width: 42px; height: 42px; flex-shrink: 0; margin-left: auto; display: inline-grid; place-items: center; }
  .wf-progress svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .wf-progress .wp-track { stroke: #D6DFDA; fill: none; stroke-width: 5; }
  .wf-progress .wp-bar { stroke: #1F5F4A; fill: none; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset .3s cubic-bezier(.2,.8,.2,1); }
  .wf-progress .wp-pct { position: absolute; font-size: 0.6rem; font-weight: 700; color: #1F5F4A; }
  .wf-progress.is-complete .wp-bar { stroke: #164A38; }
  .wf-progress.is-complete .wp-pct { color: #164A38; }
  .wf-progress .wp-reset { position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; display: none; align-items: center; justify-content: center; font-size: 11px; line-height: 1; border: 1px solid #C7D0CB; border-radius: 50%; background: #fff; color: #57645E; cursor: pointer; padding: 0; }
  .wf-progress.has-progress .wp-reset { display: flex; }
  body.wf-edit-mode .wf-progress { display: none; }
  .freq-badge { font-size: 0.72rem; font-weight: 600; padding: 2px 10px; border-radius: 10px; background: #D7EAE1; color: #1F5F4A; white-space: nowrap; }
  .wf-desc { padding: 6px 18px; font-size: 0.85rem; color: #57645E; border-bottom: 1px solid #E8EDEA; outline: none; }
  .wf-tags { padding: 4px 18px 6px; border-bottom: 1px solid #E8EDEA; }
  .tag { display: inline-block; font-size: 0.75rem; padding: 2px 8px; border-radius: 8px; background: #DCE3DF; color: #57645E; margin-right: 4px; }
  .steps { }
  /* 本文（番号・タイトル・説明）は左詰めのまま上揃え、資料（.step-resource）だけ
     行の右側・下端に寄せる。本文の開始位置と資料が同じ列に並んで見えないようにし、
     資料だけが縦に連なると落ち着いた一覧のように見える。 */
  .step { display: flex; align-items: flex-start; gap: 12px; padding: 10px 18px; border-bottom: 1px solid #E8EDEA; }
  .step:last-child { border-bottom: none; }
  .step-check { flex-shrink: 0; display: flex; align-items: flex-start; padding-top: 3px; cursor: pointer; }
  .step-checkbox { width: 17px; height: 17px; margin: 0; cursor: pointer; accent-color: #1F5F4A; }
  body.wf-edit-mode .step-check { display: none; }
  /* チェック済みステップは打ち消し線＋淡色（番号の丸も淡い緑に退かせる。編集モード中は素の表示に戻す） */
  .step.is-done .step-title, .step.is-done .step-memo { text-decoration: line-through; color: #9AA69F; }
  .step.is-done .step-num { background: #9EC6B4; }
  .step.is-done .prompt-block, .step.is-done .step-resource { opacity: 0.5; }
  body.wf-edit-mode .step.is-done .step-title, body.wf-edit-mode .step.is-done .step-memo { text-decoration: none; color: #1B2421; }
  body.wf-edit-mode .step.is-done .step-num { background: #1F5F4A; }
  body.wf-edit-mode .step.is-done .prompt-block, body.wf-edit-mode .step.is-done .step-resource { opacity: 1; }
  /* 完了ステップはコンパクトな1行に畳む。クリックで一時的に開く（.step-peek）、
     見出し下のトグルでまとめて開く（.workflow.show-done）。編集モード中は畳まない。 */
  body:not(.wf-edit-mode) .workflow:not(.show-done) .step.is-done:not(.step-peek) .step-body > :not(.step-title),
  body:not(.wf-edit-mode) .workflow:not(.show-done) .step.is-done:not(.step-peek) .step-resource { display: none; }
  body:not(.wf-edit-mode) .workflow:not(.show-done) .step.is-done:not(.step-peek) { padding-top: 6px; padding-bottom: 6px; cursor: pointer; }
  body:not(.wf-edit-mode) .workflow:not(.show-done) .step.is-done:not(.step-peek):hover { background: #F3F5F3; }
  .wf-done-toggle { padding: 4px 18px 0; }
  .wf-done-toggle button { background: none; border: none; color: #8B968F; font-size: 0.75rem; cursor: pointer; padding: 2px 0; }
  .wf-done-toggle button:hover { color: #1F5F4A; }
  body.wf-edit-mode .wf-done-toggle { display: none !important; }
  .step-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: #1F5F4A; color: #fff; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; justify-content: center; transition: background .2s; }
  .step-resource { flex: 0 0 auto; align-self: flex-end; width: 42%; min-width: 220px; max-width: 320px; }
  .step-body { flex: 1; min-width: 0; }
  .step-title { font-weight: 600; font-size: 1rem; outline: none; padding: 1px 0; }
  .step-title[contenteditable]:focus, .step-memo[contenteditable]:focus, .prompt-text[contenteditable]:focus { background: #E7F1EC; border-radius: 4px; }
  .step-memo { font-size: 0.9rem; font-weight: 400; color: #1B2421; margin-top: 1px; outline: none; padding: 1px 0; min-height: 1.2em; }
  /* メモが空のときは、PDF出力と同じく枠ごと場所を取らないようにする。
     「クリックして追加」のプレースホルダーは、実際に編集できる編集モード中だけ出す。 */
  .step-memo:empty { min-height: 0; margin-top: 0; padding: 0; }
  body.wf-edit-mode .step-memo:empty { min-height: 1.2em; margin-top: 1px; padding: 1px 0; }
  body.wf-edit-mode .step-memo:empty:before { content: attr(data-placeholder); color: #AEB8B2; }
  .prompt-block { margin-top: 6px; border: 1px dashed #9EC6B4; border-radius: 8px; overflow: hidden; background: #E7F1EC; }
  .prompt-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 10px; font-size: 0.75rem; font-weight: 600; color: #164A38; background: #D7EAE1; }
  .prompt-header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .prompt-text { padding: 6px 10px; font-family: 'Consolas', 'Menlo', monospace; font-size: 0.82rem; white-space: pre-wrap; outline: none; color: #1C3226; min-height: 1.4em; }
  .prompt-text:empty:before { content: attr(data-placeholder); color: #9EC6B4; }
  .prompt-text.wf-clamp { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  /* 折りたたみ/展開ボタンはヘッダー内の他ボタンと同じ mini-btn の見た目に揃える
     （プロンプトの色テーマに合わせた着色はせず、コピーボタンと同じ中立トーンにする）。 */
  .prompt-block.pt-code { border-color: #94a3b8; background: #DCE3DF; }
  .prompt-block.pt-code .prompt-header { color: #334155; background: #CBD5D1; }
  .prompt-block.pt-code .prompt-text { color: #1B2421; }
  .prompt-block.pt-text { border-color: #9EC6B4; background: #EAF0EE; }
  .prompt-block.pt-text .prompt-header { color: #164A38; background: #D7EAE1; }
  .prompt-block.pt-text .prompt-text { color: #1C3226; font-family: inherit; }
  /* 資料名（link-name）を主表示にし、生のパス／URL（link-controls）は
     コピー・開くのために残しつつ、一段小さく控えめな見た目にする。 */
  .link-block { margin-top: 8px; }
  .link-name { font-size: 0.82rem; font-weight: 500; color: #57645E; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; }
  .link-controls { display: flex; align-items: center; gap: 6px; }
  .icon-txt { font-size: 0.9rem; flex-shrink: 0; }
  .link-input { flex: 1; min-width: 0; font-size: 0.76rem; padding: 4px 7px; border: 1px solid #E8EDEA; border-radius: 5px; font-family: 'Consolas', 'Menlo', monospace; }
  .link-input:read-only { background: #F3F5F3; color: #8B968F; }
  .mini-btn { flex-shrink: 0; font-size: 0.72rem; padding: 4px 9px; border-radius: 6px; border: 1px solid #DCE3DF; background: #fff; color: #57645E; cursor: pointer; }
  .mini-btn:hover { background: #E7F1EC; color: #1F5F4A; }
  .mini-btn.copied { background: #1F5F4A; color: #fff; border-color: #1F5F4A; }
  .footer-bar { max-width: 760px; margin: 24px auto 0; display: flex; justify-content: flex-end; }
  #saveHtmlBtn { font-size: 0.85rem; padding: 9px 16px; border-radius: 8px; border: none; background: #1F5F4A; color: #fff; cursor: pointer; }
  #saveHtmlBtn:hover { background: #164A38; }
  #saveHtmlBtn:disabled { background: #C7D0CB; cursor: not-allowed; }
  .origin-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 0.72rem; font-weight: 700; padding: 2px 9px; border-radius: 10px; margin-left: 8px; vertical-align: middle; }
  .origin-badge.origin-original { background: #dbeafe; color: #1e40af; }
  .origin-badge.origin-copy { background: #fef3c7; color: #92400e; }
  .wf-version { font-size: 0.68rem; font-weight: 600; color: #57645E; background: #DCE3DF; padding: 2px 8px; border-radius: 8px; white-space: nowrap; letter-spacing: 0.02em; }
  .dist-info { max-width: 760px; margin: 14px auto 0; font-size: 0.76rem; color: #57645E; display: flex; flex-direction: column; gap: 3px; }
  .dist-info .review-warn { color: #92400e; font-weight: 600; }
  .dist-info .src-hint b { color: #1B2421; }
  [data-editable]:not([contenteditable="true"]) { cursor: default; }
  body.wf-edit-mode [data-editable][contenteditable="true"] { cursor: text; }
  body.wf-edit-mode [data-editable][contenteditable="true"]:hover { background: #EAF0EE; border-radius: 4px; }
  @media (max-width: 600px) {
    .step { flex-wrap: wrap; }
    .step-resource { align-self: stretch; width: 100%; max-width: none; margin-left: 38px; }
    .link-controls { flex-wrap: wrap; }
    .link-input { flex-basis: 100%; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="page-header">
    <h1 data-editable contenteditable="false">${pageTitleHtml}</h1>
    ${pageSubtitleHtml ? `<div class="subtitle" data-editable contenteditable="false">${pageSubtitleHtml}</div>` : ''}
  </div>
  <div class="meta-bar">
    <span class="export-date">出力日: ${today}</span>
    <span class="meta-sep">·</span>
    <span id="wfIntegrityBadge" class="origin-badge origin-original">📄 配布時のまま</span>
    <span class="status-bar locked" id="wfStatusBar" title="タイトル・メモ・プロンプト・リンク先のURLやパスは、「編集する」をONにすると直接書き換えられます。書き換えた内容は下部の「保存」ボタンで新しいHTMLファイルとして書き出せます（このファイル自体は上書きされません）。">
      <span id="wfStatusIcon">🔒</span><span id="wfStatusText">編集ロック中</span><span class="status-hint">ⓘ</span>
    </span>
    <label class="edit-toggle">
      <span class="edit-toggle-label">編集する</span>
      <span class="switch"><input type="checkbox" id="wfEditToggle"><span class="slider"></span></span>
    </label>
  </div>
  ${workflowsHtml}
</div>
<div class="dist-info" id="wfDistInfo">
  ${sourceHint ? `<div class="src-hint">最新版の入手先: <b>${esc(sourceHint)}</b></div>` : ''}
  <div class="review-note" id="wfReviewNote" data-review-due="${esc(reviewDue)}"></div>
</div>
<div class="footer-bar">
  <button type="button" id="saveHtmlBtn" onclick="wfSaveAsHtml()" disabled title="「編集する」をONにすると使えます">💾 この内容をHTMLとして保存</button>
</div>
<script type="application/json" id="wf-meta">${wfMetaJson}</script>
<script type="application/json" id="wf-baseline">${wfBaselineJson}</script>
<script>
var wfBaseFileName = ${baseFileNameJs};
function wfShowFeedback(btn, ok) {
  var orig = btn.textContent;
  btn.textContent = ok ? '✓ コピー済' : '× 失敗';
  btn.classList.toggle('copied', ok);
  setTimeout(function () { btn.textContent = orig; btn.classList.remove('copied'); }, 1400);
}
function wfCopyText(btn, text) {
  function done(ok) { wfShowFeedback(btn, ok); }
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(function () { done(true); }, function () { wfFallbackCopy(text, done); });
  } else {
    wfFallbackCopy(text, done);
  }
}
function wfFallbackCopy(text, done) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  done(ok);
}
function wfCopyPrompt(btn) {
  var block = btn.closest('.prompt-block');
  var text = block.querySelector('.prompt-text').innerText;
  wfCopyText(btn, text);
}
function wfCopyLink(btn) {
  var input = btn.parentElement.querySelector('.link-input');
  wfCopyText(btn, input.value);
}
function wfOpenLink(btn) {
  var input = btn.parentElement.querySelector('.link-input');
  if (!input.value) return;
  var scheme = input.dataset.scheme || '';
  window.open(scheme + input.value, '_blank');
}
function wfUpdateClampToggle(text, btn) {
  if (!text || !btn) return;
  btn.textContent = '▼ 続きを見る';
  btn.style.display = (text.scrollHeight > text.clientHeight + 1) ? 'inline-block' : 'none';
}
function wfToggleClamp(btn) {
  var text = btn.closest('.prompt-block').querySelector('.prompt-text');
  var stillClamped = text.classList.toggle('wf-clamp');
  btn.textContent = stillClamped ? '▼ 続きを見る' : '▲ 折りたたむ';
}
function wfInitClamps() {
  document.querySelectorAll('.prompt-block').forEach(function (block) {
    wfUpdateClampToggle(block.querySelector('.prompt-text'), block.querySelector('.prompt-toggle-btn'));
  });
}
function wfSetEditMode(on) {
  document.querySelectorAll('[data-editable]').forEach(function (el) {
    el.setAttribute('contenteditable', on ? 'true' : 'false');
  });
  document.querySelectorAll('.link-input').forEach(function (el) {
    el.readOnly = !on;
  });
  document.body.classList.toggle('wf-edit-mode', on);
  var saveBtn = document.getElementById('saveHtmlBtn');
  if (saveBtn) saveBtn.disabled = !on;
  var statusBar = document.getElementById('wfStatusBar');
  if (statusBar) {
    statusBar.classList.toggle('locked', !on);
    statusBar.classList.toggle('editing', on);
    document.getElementById('wfStatusIcon').textContent = on ? '✏️' : '🔒';
    document.getElementById('wfStatusText').textContent = on ? '編集モード中' : '編集ロック中';
  }
  // 編集中はプロンプト全文が見えるよう展開し、ロックに戻したら折りたたみ状態を再計算する
  document.querySelectorAll('.prompt-block').forEach(function (block) {
    var text = block.querySelector('.prompt-text');
    var btn = block.querySelector('.prompt-toggle-btn');
    if (!text) return;
    if (on) {
      text.classList.remove('wf-clamp');
      if (btn) btn.style.display = 'none';
    } else {
      text.classList.add('wf-clamp');
      wfUpdateClampToggle(text, btn);
    }
  });
}
// ── 改変検知: 配布時点の基準値（wf-baseline）と現在の内容を突き合わせる ──
function wfReadBaseline() {
  try {
    var el = document.getElementById('wf-baseline');
    return el ? JSON.parse(el.textContent) : { editables: [], linkInputs: [] };
  } catch (e) {
    return { editables: [], linkInputs: [] };
  }
}
function wfCheckIntegrity() {
  var base = wfReadBaseline();
  var changed = false;
  var eds = document.querySelectorAll('[data-editable]');
  for (var i = 0; i < eds.length; i++) {
    if ((base.editables[i] != null ? base.editables[i] : '') !== eds[i].textContent) { changed = true; break; }
  }
  if (!changed) {
    var lis = document.querySelectorAll('.link-input');
    for (var j = 0; j < lis.length; j++) {
      if ((base.linkInputs[j] != null ? base.linkInputs[j] : '') !== lis[j].value) { changed = true; break; }
    }
  }
  var badge = document.getElementById('wfIntegrityBadge');
  if (badge) {
    badge.textContent = changed ? '⚠ 配布後に内容が変更されています' : '📄 配布時のまま';
    badge.className = 'origin-badge ' + (changed ? 'origin-copy' : 'origin-original');
  }
  return changed;
}
function wfInitReviewNote() {
  var note = document.getElementById('wfReviewNote');
  if (!note) return;
  var due = note.getAttribute('data-review-due') || '';
  if (!/^\\d{4}-\\d{2}$/.test(due)) { note.style.display = 'none'; return; }
  var parts = due.split('-');
  var end = new Date(Number(parts[0]), Number(parts[1]), 0); // 当月末
  var now = new Date();
  if (now > end) {
    note.className = 'review-warn';
    note.textContent = '⏰ この手順書は ' + due + ' に見直し予定でした。最新版を入手先にご確認ください。';
  } else {
    note.textContent = '次回見直し予定: ' + due;
  }
}
// ── チェックリスト: 各ステップの完了チェックと円形プログレス ──
function wfReadMeta() {
  try {
    var el = document.getElementById('wf-meta');
    return el ? JSON.parse(el.textContent) : {};
  } catch (e) { return {}; }
}
function wfCheckKey(wfEl) {
  var id = wfEl.getAttribute('data-wf') || '';
  var hash = '';
  var meta = wfReadMeta();
  (meta.workflows || []).forEach(function (w) { if (w.workflowId === id) hash = w.contentHash || ''; });
  // 版（contentHash）が変わったら別キー＝進捗リセット
  return 'wfcheck:' + id + ':' + hash;
}
function wfSaveChecks(wfEl, arr) {
  try { localStorage.setItem(wfCheckKey(wfEl), JSON.stringify(arr)); } catch (e) {}
}
function wfUpdateProgress(wfEl) {
  var boxes = wfEl.querySelectorAll('.step-checkbox');
  var total = boxes.length;
  var done = 0;
  boxes.forEach(function (b) {
    var step = b.closest('.step');
    if (!step) return;
    if (b.checked) { done++; step.classList.add('is-done'); }
    else { step.classList.remove('is-done'); step.classList.remove('step-peek'); }
  });
  // 完了ステップのまとめ開閉トグル
  var dt = wfEl.querySelector('.wf-done-toggle');
  if (dt) {
    dt.style.display = done > 0 ? '' : 'none';
    var c = dt.querySelector('.wf-done-count');
    if (c) c.textContent = done;
    if (done === 0) wfEl.classList.remove('show-done');
  }
  var prog = wfEl.querySelector('.wf-progress');
  if (!prog || !total) { if (prog) prog.style.display = 'none'; return; }
  var frac = done / total;
  var bar = prog.querySelector('.wp-bar');
  var track = prog.querySelector('.wp-track');
  var C = 2 * Math.PI * 19;
  bar.setAttribute('stroke-dasharray', C);
  track.setAttribute('stroke-dasharray', C);
  bar.setAttribute('stroke-dashoffset', C * (1 - frac));
  prog.querySelector('.wp-pct').textContent = Math.round(frac * 100) + '%';
  prog.setAttribute('title', done + ' / ' + total + ' 完了');
  prog.classList.toggle('has-progress', done > 0);
  prog.classList.toggle('is-complete', done === total);
}
function wfToggleDone(btn) {
  var wfEl = btn.closest('.workflow');
  var showing = wfEl.classList.toggle('show-done');
  var caret = btn.querySelector('.wf-done-caret');
  if (caret) caret.textContent = showing ? '▾' : '▸';
  // まとめ操作を優先し、個別に開いていたものは畳む
  wfEl.querySelectorAll('.step.step-peek').forEach(function (s) { s.classList.remove('step-peek'); });
}
function wfInitChecklist() {
  document.querySelectorAll('.workflow').forEach(function (wfEl) {
    var boxes = [].slice.call(wfEl.querySelectorAll('.step-checkbox'));
    var raw = null;
    try { raw = localStorage.getItem(wfCheckKey(wfEl)); } catch (e) {}
    if (raw !== null) {
      var saved = [];
      try { saved = JSON.parse(raw) || []; } catch (e) { saved = []; }
      boxes.forEach(function (b, i) { b.checked = saved.indexOf(i) !== -1; });
    } else {
      // 初回: 配布時に焼き込まれた checked 属性を採用して保存する
      var checked = [];
      boxes.forEach(function (b, i) { if (b.checked) checked.push(i); });
      if (checked.length) wfSaveChecks(wfEl, checked);
    }
    wfUpdateProgress(wfEl);
  });
}
function wfPersistChecks(wfEl) {
  var boxes = [].slice.call(wfEl.querySelectorAll('.step-checkbox'));
  var checked = [];
  boxes.forEach(function (b, i) { if (b.checked) checked.push(i); });
  wfSaveChecks(wfEl, checked);
}
function wfResetChecks(btn) {
  var wfEl = btn.closest('.workflow');
  wfEl.querySelectorAll('.step-checkbox').forEach(function (b) { b.checked = false; });
  wfPersistChecks(wfEl);
  wfUpdateProgress(wfEl);
}
document.addEventListener('change', function (e) {
  if (!e.target || !e.target.classList || !e.target.classList.contains('step-checkbox')) return;
  var wfEl = e.target.closest('.workflow');
  if (!wfEl) return;
  // チェックしたステップは畳む（個別に開いていた状態はクリア）
  var step = e.target.closest('.step');
  if (step && e.target.checked) step.classList.remove('step-peek');
  wfPersistChecks(wfEl);
  wfUpdateProgress(wfEl);
});
// 畳まれた完了ステップをクリックで一時的に開く（チェックボックス・リンク・ボタン操作は除外）
document.addEventListener('click', function (e) {
  if (document.body.classList.contains('wf-edit-mode')) return;
  if (!e.target.closest) return;
  var step = e.target.closest('.step.is-done');
  if (!step) return;
  if (e.target.closest('.step-check, a, button, input, textarea, .link-input')) return;
  var wfEl = step.closest('.workflow');
  if (wfEl && wfEl.classList.contains('show-done')) return; // まとめ表示中は個別トグルしない
  step.classList.toggle('step-peek');
});

wfInitClamps();
wfCheckIntegrity();
wfInitReviewNote();
wfInitChecklist();
document.getElementById('wfEditToggle').addEventListener('change', function (e) {
  wfSetEditMode(e.target.checked);
});
document.addEventListener('input', function (e) {
  if (e.target && (e.target.matches('[data-editable]') || e.target.classList.contains('link-input'))) {
    wfCheckIntegrity();
  }
});
function wfSaveAsHtml() {
  // 配布事故防止のため、保存する内容は必ず「編集不可」状態に戻してから書き出す
  var toggle = document.getElementById('wfEditToggle');
  if (toggle) toggle.checked = false;
  wfSetEditMode(false);
  // 基準値（wf-baseline）は配布時点のまま据え置く。編集して保存し直したコピーは
  // 「⚠ 配布後に内容が変更されています」と表示され続け、原本との乖離が一目で分かる。
  wfCheckIntegrity();
  document.querySelectorAll('.link-input').forEach(function (el) {
    el.setAttribute('value', el.value);
    el.setAttribute('readonly', 'readonly');
  });
  // 現在のチェック状態を属性として焼き込む（進捗つきで他人に渡せるようにする）
  document.querySelectorAll('.step-checkbox').forEach(function (el) {
    if (el.checked) el.setAttribute('checked', 'checked');
    else el.removeAttribute('checked');
  });
  var html = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
  var blob = new Blob([html], { type: 'text/html' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  a.download = wfBaseFileName + '_複製_' + hh + mm + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
<\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseFileName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
