@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0.."

set "USUARIO=root"
set "CLAVE=root123"
set "CARPETA=%CD%\backups"
set "MYSQL_BIN="

if not defined MYSQL_BIN for /d %%d in ("C:\Program Files\MySQL\MySQL Server*") do set "MYSQL_BIN=%%~fd\bin"
if not exist "%MYSQL_BIN%\mysql.exe" (
    echo [ERROR] No se encontro mysql.exe. Escribe la ruta de la carpeta bin de MySQL en MYSQL_BIN.
    exit /b 1
)

set "ARCHIVO=%~1"
if "%ARCHIVO%"=="" (
    echo Backups disponibles en %CARPETA%:
    dir /b /o-d "%CARPETA%\*.sql"
    echo.
    set /p "NOMBRE=Escribe el nombre del backup a restaurar: "
)
if "%ARCHIVO%"=="" set "ARCHIVO=%CARPETA%\%NOMBRE%"
if not exist "%ARCHIVO%" (
    echo [ERROR] No existe el archivo: %ARCHIVO%
    exit /b 1
)

echo.
echo ATENCION: se reemplazaran los datos actuales de la base de datos con:
echo %ARCHIVO%
set /p "CONFIRMA=Escribe SI para continuar: "
if /i not "%CONFIRMA%"=="SI" (
    echo Restauracion cancelada.
    exit /b 0
)

set "CREDENCIALES=%TEMP%\dolcevita-restaurar-%RANDOM%.cnf"
> "%CREDENCIALES%" echo [client]
>> "%CREDENCIALES%" echo user="%USUARIO%"
>> "%CREDENCIALES%" echo password="%CLAVE%"

"%MYSQL_BIN%\mysql.exe" --defaults-extra-file="%CREDENCIALES%" < "%ARCHIVO%"
set "RESULTADO=%ERRORLEVEL%"
del /q "%CREDENCIALES%" >nul 2>&1

if not "%RESULTADO%"=="0" (
    echo [ERROR] La restauracion fallo con codigo %RESULTADO%.
    exit /b %RESULTADO%
)
echo %DATE% %TIME% RESTAURADO %ARCHIVO%>> "%CARPETA%\backup.log"
echo [OK] Base de datos restaurada desde %ARCHIVO%
endlocal
exit /b 0
