@echo off
rem Abre CMD com ANDROID_HOME e adb no PATH (sessao atual).
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%PATH%"
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo ANDROID_HOME=%ANDROID_HOME%
adb version
cmd /k
