@echo off
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
if not exist "%ADB%" (
  echo adb nao encontrado em %ADB%
  echo Instale Android SDK Platform-Tools pelo Android Studio ^(SDK Manager^).
  exit /b 1
)
"%ADB%" %*
