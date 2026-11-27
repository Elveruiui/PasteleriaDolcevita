@echo off
setlocal
chcp 65001 >nul
schtasks /Delete /F /TN "DOLCEVITA\Backup diario"
schtasks /Delete /F /TN "DOLCEVITA\Verificacion del sistema"
echo Tareas de DOLCEVITA eliminadas del Programador de tareas.
endlocal
pause
