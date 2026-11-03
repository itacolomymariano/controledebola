# Atualiza controledebolasite/public/.well-known/assetlinks.json com upload + Play App Signing SHA-256.
# Uso:
#   .\scripts\sync-play-assetlinks.ps1 -PlayAppSigningSha256 "AA:BB:..."
#   .\scripts\sync-play-assetlinks.ps1   # le android/play-app-signing-sha256.local.txt
#   .\scripts\sync-play-assetlinks.ps1 -PushSite   # commit + push no repo do site (se -PlayAppSigningSha256 ou arquivo local)

param(
  [string]$PlayAppSigningSha256,
  [switch]$PushSite
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$siteRoot = Join-Path (Split-Path -Parent $root) 'controledebolasite'
$assetlinksPath = Join-Path $siteRoot 'public\.well-known\assetlinks.json'
$localShaPath = Join-Path $root 'android\play-app-signing-sha256.local.txt'

# Upload key (release keystore local) — mantida para sideload/APK assinado localmente.
$uploadKeySha = '64:A3:5D:86:0E:C4:13:CD:FD:31:F0:2D:AB:66:31:B2:3F:AB:48:6F:C1:60:A7:DF:E8:E8:CA:5B:60:85:89:5A'

function Normalize-Sha256Colon([string]$raw) {
  $t = $raw.Trim().ToUpperInvariant()
  if ($t -match '^([0-9A-F]{2}:){19}[0-9A-F]{2}$') { return $t }
  $hex = ($t -replace ':', '').ToUpperInvariant()
  if ($hex.Length -ne 64 -or $hex -notmatch '^[0-9A-F]+$') {
    throw "SHA-256 invalido (esperado 64 hex com ou sem dois pontos): $raw"
  }
  $parts = for ($i = 0; $i -lt 64; $i += 2) { $hex.Substring($i, 2) }
  return ($parts -join ':')
}

if (-not $PlayAppSigningSha256 -and (Test-Path $localShaPath)) {
  $PlayAppSigningSha256 = (Get-Content $localShaPath -Raw).Trim()
}

if (-not $PlayAppSigningSha256) {
  Write-Host ''
  Write-Host 'Falta o SHA-256 da App signing key (Play Console -> Integridade do app).'
  Write-Host '  -Param PlayAppSigningSha256 "XX:XX:..."'
  Write-Host "  ou grave uma linha em: $localShaPath"
  Write-Host ''
  Write-Host 'URL direta (apos login): https://play.google.com/console/developers/app/keymanagement'
  exit 1
}

$playSha = Normalize-Sha256Colon $PlayAppSigningSha256

if (-not (Test-Path $siteRoot)) {
  throw "Repo do site nao encontrado: $siteRoot"
}

$payload = @"
[
  {
    `"relation`": [`"delegate_permission/common.handle_all_urls`"],
    `"target`": {
      `"namespace`": `"android_app`",
      `"package_name`": `"com.minhapelada.app`",
      `"sha256_cert_fingerprints`": [
        `"$uploadKeySha`",
        `"$playSha`"
      ]
    }
  }
]
"@

New-Item -ItemType Directory -Force -Path (Split-Path $assetlinksPath) | Out-Null
[System.IO.File]::WriteAllText($assetlinksPath, $payload.TrimEnd() + "`n", [System.Text.UTF8Encoding]::new($false))

Write-Host "Atualizado: $assetlinksPath"
Write-Host "Fingerprints: upload key + Play App Signing ($playSha)"

if ($PushSite) {
  Push-Location $siteRoot
  try {
    git add public/.well-known/assetlinks.json
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
      Write-Host 'Nenhuma mudanca para commit no site.'
      return
    }
    git commit -m @"
Add Play App signing SHA-256 to assetlinks.json for App Links verification.

Play Console deep links require the app signing certificate fingerprint, not only the upload key.
"@
    git push
    Write-Host 'Push do site concluido (Cloudflare deploy).'
  }
  finally {
    Pop-Location
  }
}
