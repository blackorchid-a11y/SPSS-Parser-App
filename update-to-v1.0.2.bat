@echo off
echo ================================================
echo   Updating SPSS Parser to v1.0.2
echo ================================================
echo.

echo [1/5] Checking git status...
git status
echo.

echo [2/5] Adding all changes...
git add .
echo.

echo [3/5] Committing changes...
git commit -m "Release v1.0.2: Add bilingual support for English and Spanish SPSS output"
echo.

echo [4/5] Creating git tag v1.0.2...
git tag -a v1.0.2 -m "Version 1.0.2 - Bilingual Support"
echo.

echo [5/5] Pushing to GitHub...
git push origin main
git push origin v1.0.2
echo.

echo ================================================
echo   Successfully updated to v1.0.2!
echo ================================================
echo.
echo Changes pushed to GitHub:
echo - Updated App.jsx with bilingual support
echo - Updated package.json to v1.0.2
echo - Added CHANGELOG.md
echo - Added BILINGUAL_SUPPORT.md
echo.
pause
