#!/bin/bash
echo "============================================"
echo " Project Manager - Build Script (macOS/Linux)"
echo "============================================"

echo ""
echo "[1/2] Building frontend..."
cd frontend
npm ci 2>/dev/null
npm run build
if [ $? -ne 0 ]; then
    echo "Frontend build failed!"
    exit 1
fi
cd ..

echo ""
echo "[2/2] Building Go binary..."
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -o dist/project-manager-mac-intel .
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o dist/project-manager-mac-arm .

echo ""
echo "============================================"
echo " Build complete:"
echo "   Intel Mac: dist/project-manager-mac-intel"
echo "   Apple Silicon: dist/project-manager-mac-arm"
echo "============================================"
echo ""
echo "To run: ./project-manager-mac-arm (or -intel)"
echo "Database will be created as project-data.db"
echo "To migrate data: copy project-data.db with the binary"
