# Repara entradas quebradas no PATH do usuario (aspas, %PATH% literal, duplicatas).
# Backup em %USERPROFILE%\path-user-backup-YYYYMMDD-HHmmss.txt

$ErrorActionPreference = 'Stop'
$raw = [Environment]::GetEnvironmentVariable('Path', 'User')
$backup = Join-Path $env:USERPROFILE ("path-user-backup-{0:yyyyMMdd-HHmmss}.txt" -f (Get-Date))
Set-Content -Path $backup -Value $raw -Encoding UTF8
Write-Host "Backup: $backup"

$platformTools = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools'
$androidSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

$seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$clean = [System.Collections.Generic.List[string]]::new()

foreach ($part in ($raw -split ';')) {
  $p = $part.Trim().Trim('"').Trim()
  if (-not $p) { continue }
  if ($p -match '%PATH%') { continue }
  if ($p.Contains('"')) { continue }
  if ($seen.Add($p)) {
    $clean.Add($p)
  }
}

foreach ($required in @($platformTools, $androidSdk)) {
  if ((Test-Path $required) -and $seen.Add($required)) {
    $clean.Insert(0, $required)
  }
}

$newPath = ($clean | Where-Object { $_ }) -join ';'
[Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
Write-Host "PATH do usuario atualizado ($($clean.Count) entradas)."
Write-Host "Feche e abra o Prompt de Comando, depois: adb devices"
