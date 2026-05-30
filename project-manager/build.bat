@echo off
echo ============================================
echo  Project Manager - Build Script (Windows)
echo ============================================

echo.
echo [1/2] Building frontend...
cd frontend
call npm ci 2>nul
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Frontend build failed!
    exit /b 1
)
cd ..

echo.
echo [2/2] Building Go binary...
set CGO_ENABLED=0
set GOOS=windows
set GOARCH=amd64
go build -o dist\project-manager.exe .
if %ERRORLEVEL% NEQ 0 (
    echo Go build failed!
    exit /b 1
)

echo.
echo ============================================
echo  Build complete: dist\project-manager.exe
echo ============================================
echo.
echo To run: double-click project-manager.exe
echo Database will be created as project-data.db
echo To migrate data: copy project-data.db with the .exe
