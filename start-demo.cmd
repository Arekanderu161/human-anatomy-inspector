@echo off
cd /d "%~dp0"
echo Human Anatomy local demo
echo Open http://127.0.0.1:4176 in your browser.
echo Keep this window open while using the demo.
node serve.mjs 4176
pause
