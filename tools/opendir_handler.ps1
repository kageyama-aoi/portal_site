param([string]$uri)

$logFile = "$env:TEMP\opendir_debug.log"

function Write-Log([string]$msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
}

try {
    $path = $uri -replace '^opendir:', ''
    $path = [System.Uri]::UnescapeDataString($path)
    $path = $path.Replace('/', '\')
    Write-Log "uri=$uri -> path=$path (exists=$(Test-Path $path))"
    Start-Process -FilePath 'explorer.exe' -ArgumentList "`"$path`""
} catch {
    Write-Log "ERROR: $_"
}
