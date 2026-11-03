# Verifica assetlinks.json publico (apex + www) e contagem de fingerprints.
$ErrorActionPreference = 'Stop'

foreach ($domain in @('controledebola.com', 'www.controledebola.com')) {
  $url = "https://$domain/.well-known/assetlinks.json"
  $r = Invoke-WebRequest -Uri $url -UseBasicParsing
  $doc = $r.Content | ConvertFrom-Json
  $fps = @($doc[0].target.sha256_cert_fingerprints)
  Write-Host "$url"
  Write-Host "  Content-Type: $($r.Headers['Content-Type'])"
  Write-Host "  Fingerprints: $($fps.Count)"
  foreach ($fp in $fps) { Write-Host "    $fp" }
  if ($fps.Count -lt 2) {
    Write-Host '  AVISO: esperado >= 2 (upload + Play App signing) apos app na Play.' -ForegroundColor Yellow
  }
}

Write-Host ''
Write-Host 'Dispositivo (app da Play): adb shell pm get-app-links com.minhapelada.app'
