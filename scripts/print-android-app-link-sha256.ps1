# Extrai SHA-256 do keystore de release (somente fingerprint; nao imprime senhas).
# Uso: .\scripts\print-android-app-link-sha256.ps1
# Cole o resultado em controledebolasite/public/.well-known/assetlinks.json

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$propsPath = Join-Path $root 'android\keystore.properties'
if (-not (Test-Path $propsPath)) {
  Write-Error "Arquivo nao encontrado: $propsPath"
}

$props = @{}
Get-Content $propsPath | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_.Split('=', 2)
  $props[$k.Trim()] = $v.Trim()
}

$storeFile = $props['storeFile']
$keyAlias = $props['keyAlias']
$storePassword = $props['storePassword']
if (-not $storeFile -or -not $keyAlias -or -not $storePassword) {
  Write-Error 'keystore.properties incompleto (storeFile, keyAlias, storePassword).'
}

if (-not [System.IO.Path]::IsPathRooted($storeFile)) {
  $storeFile = Join-Path (Join-Path $root 'android') $storeFile
}

$keytool = $null
if ($env:JAVA_HOME) {
  $candidate = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
  if (Test-Path $candidate) { $keytool = $candidate }
}
if (-not $keytool) {
  $keytool = 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
}
if (-not (Test-Path $keytool)) {
  Write-Error 'keytool nao encontrado. Defina JAVA_HOME ou instale Android Studio JBR.'
}

$output = & $keytool -list -v -keystore $storeFile -alias $keyAlias -storepass $storePassword 2>&1 | Out-String
$match = [regex]::Match($output, 'SHA256:\s*([0-9A-Fa-f:]+)')
if (-not $match.Success) {
  Write-Error 'Nao foi possivel ler SHA256 do keystore.'
}

$sha = ($match.Groups[1].Value -replace ':', '').ToUpperInvariant()
$shaColon = $match.Groups[1].Value.ToUpperInvariant()

Write-Host ''
Write-Host 'Cole em assetlinks.json (com dois pontos, formato Google):'
Write-Host $shaColon
Write-Host ''
Write-Host 'Forma sem dois pontos (referencia):'
Write-Host $sha
Write-Host ''
