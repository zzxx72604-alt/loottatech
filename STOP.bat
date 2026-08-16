@echo off
REM ============================================================================
REM  LoottaTech - stop everything
REM
REM  Frees ports 5197, 4200 and 4300 if a window was closed badly and left a
REM  process behind. Normally you just close the three windows instead.
REM ============================================================================

title LoottaTech - stopping
echo.
echo   Stopping anything holding ports 5197, 4200 and 4300...
echo.

for %%P in (5197 4200 4300) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
        echo   port %%P  ->  killing process %%A
        taskkill /PID %%A /F >nul 2>nul
    )
)

echo.
echo   Done. You can run START.bat again.
echo.
pause
