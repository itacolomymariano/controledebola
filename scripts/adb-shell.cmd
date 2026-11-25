@echo off
rem CMD com adb no PATH (platform-tools do repo). Feche e reabra janelas antigas do Windows para PATH global.
set "ADB_HOME=%~dp0..\tools\platform-tools"
set "PATH=%ADB_HOME%;%PATH%"
set "ANDROID_SDK_ROOT=%~dp0..\tools\android-sdk"
if exist "%~dp0..\android\local.properties" (
  for /f "tokens=1,* delims==" %%a in ('findstr /b "sdk.dir=" "%~dp0..\android\local.properties"') do set "ANDROID_SDK_ROOT=%%b"
)
set "ANDROID_HOME=%ANDROID_SDK_ROOT%"
echo adb: %ADB_HOME%\adb.exe
"%ADB_HOME%\adb.exe" version
echo.
"%ADB_HOME%\adb.exe" devices -l
echo.
echo Dica: depuracao USB no celular + aceitar o aviso RSA.
cmd /k