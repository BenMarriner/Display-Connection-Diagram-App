@echo off
setlocal
cd /d "%~dp0"

rem Use the bundled runtime when available, without changing the user's PATH.
set "PLANNER_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%PLANNER_NODE%" (
  set "PLANNER_NODE="
  for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined PLANNER_NODE set "PLANNER_NODE=%%N"
)

if not defined PLANNER_NODE (
  echo Node.js could not be found. See README.md for setup requirements.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\vite\bin\vite.js" (
  echo Application dependencies are missing. Run pnpm install once after setup.
  echo See README.md for details.
  pause
  exit /b 1
)

echo Starting Signalpath at http://127.0.0.1:5173/
echo Keep this window open while using the app. Press Ctrl+C to stop.
echo.
"%PLANNER_NODE%" "%~dp0node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 5173 --strictPort
set "PLANNER_EXIT=%ERRORLEVEL%"
if not "%PLANNER_EXIT%"=="0" (
  echo.
  echo Signalpath could not start. Check the message above.
  pause
)
exit /b %PLANNER_EXIT%
