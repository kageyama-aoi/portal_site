param([string]$uri)

Add-Type -AssemblyName System.Windows.Forms

$logFile = "$env:TEMP\opendir_debug.log"

function Write-Log([string]$msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

# -WindowStyle Hidden で起動してもMessageBoxは独立したウィンドウとして表示されるため、
# 「クリックしても何も起きない」状態を避け、失敗理由をその場で提示する。
function Show-OpenDirError([string]$message) {
    Write-Log "ERROR: $message"
    [System.Windows.Forms.MessageBox]::Show(
        $message,
        'フォルダを開けませんでした',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
}

try {
    $path = $uri -replace '^opendir:', ''
    $path = [System.Uri]::UnescapeDataString($path)
    $path = $path.Replace('/', '\')
    Write-Log "uri=$uri -> path=$path"

    # -LiteralPath: フォルダ名に [ ] * などが含まれていてもワイルドカードとして
    # 誤解釈しないようにする（括弧付きフォルダ名で問題になった経緯があるため）
    if (-not (Test-Path -LiteralPath $path)) {
        Show-OpenDirError "指定されたフォルダが見つかりません。`n`n$path`n`nパスが変更・削除されたか、ネットワークドライブが切断されている可能性があります。"
        exit 1
    }

    try {
        Start-Process -FilePath 'explorer.exe' -ArgumentList "`"$path`""
        Write-Log "opened OK"
    } catch {
        # パス自体は存在するのに開けない場合＝実行が何らかの理由でブロックされたケース
        # （セキュリティソフト、グループポリシー、実行ポリシーなど）を切り分けて伝える
        Show-OpenDirError "フォルダは存在しますが、開く処理を実行できませんでした。`n`nセキュリティソフトやシステムのポリシーにより、explorer.exeの起動がブロックされた可能性があります。`n`n$path`n`n詳細: $($_.Exception.Message)"
    }
} catch {
    Show-OpenDirError "予期しないエラーが発生しました。`n`nURI: $uri`n`n詳細: $($_.Exception.Message)"
}
