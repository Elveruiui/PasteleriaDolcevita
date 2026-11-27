@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0.."

set "URL=http://localhost:8093/actuator/health"
set "CARPETA=%CD%\logs"
if not exist "%CARPETA%" mkdir "%CARPETA%"

curl -s -o "%TEMP%\dolcevita-health.json" -w "%%{http_code}" "%URL%" > "%TEMP%\dolcevita-codigo.txt" 2>nul
set /p CODIGO=<"%TEMP%\dolcevita-codigo.txt"

findstr /c:"\"status\":\"UP\"" "%TEMP%\dolcevita-health.json" >nul 2>&1
if "%CODIGO%"=="200" if not errorlevel 1 (
    echo %DATE% %TIME% OK sistema DOLCEVITA en linea>> "%CARPETA%\verificacion.log"
    echo [OK] El sistema DOLCEVITA esta funcionando.
    exit /b 0
)

echo %DATE% %TIME% ALERTA el sistema no responde correctamente (HTTP %CODIGO%)>> "%CARPETA%\verificacion.log"
echo [ALERTA] El sistema DOLCEVITA no responde correctamente (HTTP %CODIGO%).
exit /b 1
