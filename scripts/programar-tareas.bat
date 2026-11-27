@echo off
setlocal
chcp 65001 >nul

set "SCRIPTS=%~dp0"

echo Registrando tareas en el Programador de tareas de Windows...
schtasks /Create /F /TN "DOLCEVITA\Backup diario" /TR "\"%SCRIPTS%backup.bat\"" /SC DAILY /ST 08:00
schtasks /Create /F /TN "DOLCEVITA\Verificacion del sistema" /TR "\"%SCRIPTS%verificar-sistema.bat\"" /SC HOURLY

echo.
echo Tareas registradas:
schtasks /Query /TN "DOLCEVITA\Backup diario"
schtasks /Query /TN "DOLCEVITA\Verificacion del sistema"
echo.
echo Para verlas abre "Programador de tareas" y busca la carpeta DOLCEVITA.
endlocal
pause
