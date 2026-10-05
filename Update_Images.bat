@echo off
setlocal enabledelayedexpansion

echo Generating list of images in allframes...

echo const frameFiles = [ > frames_list.js

:: Loop through all files in allframes directory and write their names to frames_list.js
for /f "delims=" %%f in ('dir /b /a-d "allframes\*" 2^>nul') do (
    echo     "allframes/%%f", >> frames_list.js
)

echo ]; >> frames_list.js

echo Update Complete!
echo You can now open index.html in your browser.
pause
