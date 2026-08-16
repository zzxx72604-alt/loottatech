@echo off
REM ============================================================================
REM  LoottaTech - start everything
REM
REM  Double-click this file. It opens three windows:
REM     1. the ASP.NET Core API        http://localhost:5197
REM     2. the customer website        http://localhost:4200
REM     3. the admin website           http://localhost:4300
REM
REM  Runs in CMD rather than PowerShell on purpose: PowerShell blocks npm.ps1
REM  by default on a fresh Windows install, which looks like a broken project
REM  when it is only a security setting.
REM ============================================================================

title LoottaTech launcher
setlocal
set "ROOT=%~dp0"

REM Stops the Angular CLI asking about analytics, which would hang this script
REM waiting for an answer nobody is there to give.
set NG_CLI_ANALYTICS=false

echo.
echo   LoottaTech
echo   ==========
echo.

REM ---------------------------------------------------------------- checks --

where dotnet >nul 2>nul
if errorlevel 1 (
    echo   [X] .NET SDK not found.
    echo       Install .NET 8 from https://dotnet.microsoft.com/download
    echo.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo   [X] Node.js not found.
    echo       Install Node 20 or newer from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo   [ok] .NET and Node found.
echo.

REM ------------------------------------------------- first-run npm install --

if not exist "%ROOT%loottatech\frontend\node_modules" (
    echo   Installing customer website packages. First run only, a few minutes.
    pushd "%ROOT%loottatech\frontend"
    call npm install --no-audit --no-fund
    popd
    echo.
)

if not exist "%ROOT%loottaAdmin\node_modules" (
    echo   Installing admin website packages. First run only, a few minutes.
    pushd "%ROOT%loottaAdmin"
    call npm install --no-audit --no-fund
    popd
    echo.
)

REM ------------------------------------------------------------ launch x3 --
REM  /D sets each window's starting folder, which avoids quoting a path that
REM  contains brackets - "S2-Setec(2)" breaks naive CMD quoting.

echo   Starting the API...
start "LoottaTech API  (do not close)" /D "%ROOT%API\lootta\lootta" cmd /k dotnet run

REM The websites proxy to the API, so give it a moment to bind its port.
timeout /t 6 /nobreak >nul

echo   Starting the customer website...
start "LoottaTech Customer  (do not close)" /D "%ROOT%loottatech\frontend" cmd /k npm start

echo   Starting the admin website...
start "LoottaTech Admin  (do not close)" /D "%ROOT%loottaAdmin" cmd /k npm start

REM Angular needs roughly 10-20 seconds for its first compile.
echo.
echo   Waiting for the websites to compile...
timeout /t 22 /nobreak >nul

start "" http://localhost:4200
start "" http://localhost:4300

echo.
echo   ------------------------------------------------------------------
echo     Customer   http://localhost:4200
echo     Admin      http://localhost:4300
echo     API docs   http://localhost:5197/swagger
echo.
echo     Admin login    admin@loottatech.com  /  Admin123
echo     Customer login dara@gmail.com        /  Dara123
echo   ------------------------------------------------------------------
echo.
echo   Three windows are now running. Closing them stops the app.
echo   You can close THIS window safely.
echo.
pause
