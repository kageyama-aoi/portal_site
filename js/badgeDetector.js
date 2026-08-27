/**
 * @file badgeDetector.js
 * @brief URL文字列からリンクの種類（バッジ）を推測するユーティリティ。
 * @module badgeDetector
 */

/**
 * ホスト名ベースの判定ルール。上から順に評価し、最初にマッチしたものを採用する。
 * badge の値は index.html の <select id="linkBadgeInput"> の value と対応させること。
 *
 * 単純な文字列/正規表現の部分一致（例: /x\.com/）は "dropbox.com" のような
 * 無関係なドメインの末尾に偶然含まれるだけで誤判定するため、
 * 必ずホスト名（サブドメイン境界）単位で比較する。
 */
const HOSTNAME_RULES = [
  { badge: 'video', hosts: ['youtube.com', 'youtu.be', 'vimeo.com', 'nicovideo.jp'] },
  { badge: 'code', hosts: ['github.com', 'gitlab.com', 'bitbucket.org'] },
  { badge: 'sns', hosts: ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'threads.net'] },
  // Googleドライブは利用頻度が高いため、他のクラウドストレージ（cloud）とは別枠で判定する
  { badge: 'drive', hosts: ['drive.google.com'] },
  { badge: 'cloud', hosts: ['dropbox.com', 'onedrive.live.com', 'icloud.com', 'sharepoint.com'] },
  { badge: 'tool', hosts: ['notion.so', 'atlassian.net', 'trello.com', 'asana.com', 'backlog.com', 'backlog.jp', 'slack.com', 'chatwork.com'] },
];

/** ファイル拡張子（パス末尾）ベースの判定ルール。 */
const EXTENSION_RULES = [
  { badge: 'spreadsheet', extensions: ['xlsx', 'xls', 'csv', 'ods'] },
  { badge: 'doc', extensions: ['docx', 'doc', 'pptx', 'ppt', 'pdf'] },
];

/**
 * hostname が指定ドメイン自身、またはそのサブドメインかどうかを判定します。
 * （"dropbox.com" は "x.com" のサブドメインでも本体でもないので false になる）
 * @param {string} hostname
 * @param {string} domain
 * @returns {boolean}
 */
function isHostOrSubdomain(hostname, domain) {
  return hostname === domain || hostname.endsWith('.' + domain);
}

/**
 * URLからバッジ種別を推測します。
 * opendir: で始まるローカルパス（Googleドライブ等のクラウド同期フォルダをドライブ文字で
 * 開いている場合も含む）は、Webサービスの 'drive'/'cloud' ではなく 'local' として扱います。
 * どのルールにもマッチしない場合、http(s) の一般URLなら 'website'、
 * それ以外（空文字、不正なURLなど）は null を返します。
 * @param {string} url - 判定対象のURL文字列。
 * @returns {string|null} 推測したバッジ種別。判定不能な場合は null。
 */
export function detectBadge(url) {
  const value = (url || '').trim();
  if (!value) return null;
  if (value.startsWith('opendir:')) return 'local';

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  // Googleスプレッドシート / ドキュメント / スライド（パスで種類が分かれる）
  if (hostname === 'docs.google.com') {
    if (pathname.startsWith('/spreadsheets')) return 'spreadsheet';
    if (pathname.startsWith('/document') || pathname.startsWith('/presentation')) return 'doc';
  }

  // ファイル拡張子（Excel/CSV、Word/PowerPoint/PDFの直リンク）
  for (const rule of EXTENSION_RULES) {
    if (rule.extensions.some(ext => pathname.endsWith('.' + ext))) return rule.badge;
  }

  // よく使うサービスのホスト名判定
  for (const rule of HOSTNAME_RULES) {
    if (rule.hosts.some(host => isHostOrSubdomain(hostname, host))) return rule.badge;
  }

  return 'website';
}
