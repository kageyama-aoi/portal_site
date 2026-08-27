# PLAN - やりたいこと

<!-- ここに思ったことを自由に書いてください。箇条書きでも口語でもOK -->
<!-- Claude がこの内容を読んでヒアリングし、SPEC.md を作成します -->



C:\Users\kageyama\Tools\portal_site_business\portal_site\.claude\settings.local.json

おすすめ設定こんなの出てきたきたけど　あなたの意見をきかせて
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [

      // ── 読み取り・調査系（すべて安全）──
      "Read",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(find:*)",
      "Bash(grep:*)",
      "Bash(echo:*)",

      // ── Git：状態確認・履歴（読み取り系）──
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git show:*)",
      "Bash(git branch:*)",

      // ── Git：通常の変更操作（確認なし）──
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git checkout:*)",
      "Bash(git switch:*)",
      "Bash(git fetch:*)",
      "Bash(git pull:*)",
      "Bash(git stash:*)",

      // ── gh CLI：issue・PR管理 ──
      "Bash(gh issue:*)",
      "Bash(gh pr:*)",
      "Bash(gh run:*)",
      "Bash(gh repo:*)",

      // ── WebFetch（参照先ドメイン限定）──
      "WebFetch(domain:github.com)",
      "WebFetch(domain:docs.anthropic.com)"
    ],
    "deny": [
      // ── 絶対にブロック ──
      "Bash(git push --force:*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean -fd:*)",
      "Bash(rm -rf:*)",
      "Bash(sudo:*)",
      "Read(.env)",
      "Read(.env.*)"
    ]
  }
}