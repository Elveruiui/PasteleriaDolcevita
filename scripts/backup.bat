@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0.."

set "BD=pasteleriaweb"
set "USUARIO=root"
set "CLAVE=1234"
set "CARPETA=%CD%\backups"
set "DIAS_RETENCION=15"
set "MYSQL_BIN="

if not defined MYSQL_BIN for /d %%d in ("C:\Program Files\MySQL\MySQL Server*") do set "MYSQL_BIN=%%~fd\bin"
if not exist "%MYSQL_BIN%\mysqldump.exe" (
    echo [ERROR] No se encontro mysqldump.exe. Escribe la ruta de la carpeta bin de MySQL en MYSQL_BIN.
    exit /b 1
)

if not exist "%CARPETA%" mkdir "%CARPETA%"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set "FECHA=%%i"
set "ARCHIVO=%CARPETA%\%BD%_%FECHA%.sql"
set "CREDENCIALES=%TEMP%\dolcevita-backup-%RANDOM%.cnf"

> "%CREDENCIALES%" echo [client]
>> "%CREDENCIALES%" echo user="%USUARIO%"
>> "%CREDENCIALES%" echo password="%CLAVE%"

echo Generando backup de %BD%...
"%MYSQL_BIN%\mysqldump.exe" --defaults-extra-file="%CREDENCIALES%" --single-transaction --routines --triggers --databases %BD% --result-file="%ARCHIVO%"
set "RESULTADO=%ERRORLEVEL%"
del /q "%CREDENCIALES%" >nul 2>&1

if not "%RESULTADO%"=="0" (
    echo %DATE% %TIME% ERROR backup fallido con codigo %RESULTADO%>> "%CARPETA%\backup.log"
    echo [ERROR] El backup fallo. Revisa usuario, clave y que MySQL este encendido.
    if exist "%ARCHIVO%" del /q "%ARCHIVO%"
    exit /b %RESULTADO%
)

for %%f in ("%ARCHIVO%") do set "TAMANO=%%~zf"
echo %DATE% %TIME% OK %ARCHIVO% (%TAMANO% bytes)>> "%CARPETA%\backup.log"
echo [OK] Backup guardado en: %ARCHIVO%

forfiles /p "%CARPETA%" /m *.sql /d -%DIAS_RETENCION% /c "cmd /c del /q @path && echo Eliminado backup antiguo: @file" 2>nul
echo %DATE% %TIME% Limpieza: backups con mas de %DIAS_RETENCION% dias eliminados>> "%CARPETA%\backup.log"
endlocal
exit /b 0
