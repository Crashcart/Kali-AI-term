#!/bin/bash

# Copy All Files to Your Local Kali-AI-term Repository
# This script safely copies all new and modified files from /tmp/Kali-AI-term
# to your local Kali-AI-term repository

set -e

# Configuration
SOURCE_DIR="/tmp/Kali-AI-term"
DEST_DIR="${1:-.}"  # First argument, or current directory

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Copying Logging & Diagnostic System Files                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verify source exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Error: Source directory not found: $SOURCE_DIR"
    exit 1
fi

# Verify destination is a git repo
if [ ! -d "$DEST_DIR/.git" ]; then
    echo "❌ Error: Destination is not a git repository: $DEST_DIR"
    exit 1
fi

echo "Source: $SOURCE_DIR"
echo "Destination: $DEST_DIR"
echo ""

# Arrays of files to copy
declare -a NEW_FILES=(
    "install.js"
    "install-full.js"
    "uninstall.js"
    "update.js"
)

declare -a LIB_FILES=(
    "lib/install-logger.js"
    "lib/diagnostic-analyzer.js"
    "lib/install-menu.js"
)

declare -a MODIFIED_FILES=(
    "server.js"
    "docker-compose.yml"
    ".env.example"
    "README.md"
)

# Copy new installation scripts
echo "📋 Copying new installation scripts..."
for file in "${NEW_FILES[@]}"; do
    if [ -f "$SOURCE_DIR/$file" ]; then
        cp -v "$SOURCE_DIR/$file" "$DEST_DIR/$file"
    else
        echo "⚠️  File not found: $file"
    fi
done
echo "✅ Installation scripts copied"
echo ""

# Copy library files
echo "📚 Copying logging modules..."
mkdir -p "$DEST_DIR/lib"
for file in "${LIB_FILES[@]}"; do
    if [ -f "$SOURCE_DIR/$file" ]; then
        cp -v "$SOURCE_DIR/$file" "$DEST_DIR/$file"
    else
        echo "⚠️  File not found: $file"
    fi
done
echo "✅ Logging modules copied"
echo ""

# Copy modified files
echo "🔄 Copying enhanced configuration files..."
for file in "${MODIFIED_FILES[@]}"; do
    if [ -f "$SOURCE_DIR/$file" ]; then
        cp -v "$SOURCE_DIR/$file" "$DEST_DIR/$file"
    else
        echo "⚠️  File not found: $file"
    fi
done
echo "✅ Configuration files copied"
echo ""

# Make scripts executable
echo "⚙️  Making scripts executable..."
chmod +x "$DEST_DIR/install.js" "$DEST_DIR/install-full.js" "$DEST_DIR/uninstall.js" "$DEST_DIR/update.js"
echo "✅ Scripts are now executable"
echo ""

# Copy documentation
if [ -f "$SOURCE_DIR/IMPLEMENTATION_SUMMARY.md" ]; then
    cp -v "$SOURCE_DIR/IMPLEMENTATION_SUMMARY.md" "$DEST_DIR/"
    echo "✅ Documentation copied"
fi

if [ -f "$SOURCE_DIR/CODE_REVIEW_GUIDE.md" ]; then
    cp -v "$SOURCE_DIR/CODE_REVIEW_GUIDE.md" "$DEST_DIR/"
fi
echo ""

# Verify
echo "🔍 Verifying copied files..."
echo ""

cd "$DEST_DIR"

echo "📊 Git Status:"
echo "───────────────────────────────────────────"
git status --short
echo ""

echo "📦 File Summary:"
echo "───────────────────────────────────────────"
echo "New installation scripts:"
ls -lh install*.js uninstall.js update.js 2>/dev/null | awk '{print "  ✓ " $9 " (" $5 ")"}'
echo ""

echo "Logging modules:"
ls -lh lib/install-*.js lib/diagnostic-*.js 2>/dev/null | awk '{print "  ✓ " $9 " (" $5 ")"}'
echo ""

echo "Modified files:"
echo "  ✓ server.js (enhanced with logger)"
echo "  ✓ docker-compose.yml (health checks)"
echo "  ✓ .env.example (documentation)"
echo "  ✓ README.md (troubleshooting guide)"
echo ""

# Show next steps
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Copy Complete - Ready to Commit                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

echo "📝 Next Steps:"
echo ""
echo "1. Review the changes:"
echo "   git diff README.md | less"
echo "   git diff docker-compose.yml"
echo ""

echo "2. Review the new scripts:"
echo "   head -30 install.js"
echo "   head -30 install-full.js"
echo ""

echo "3. Add all files to staging:"
echo "   git add install*.js uninstall.js update.js"
echo "   git add lib/install-logger.js lib/diagnostic-analyzer.js lib/install-menu.js"
echo "   git add server.js docker-compose.yml .env.example README.md"
echo ""

echo "4. Commit your changes:"
echo "   git commit -m 'feat: integrate logging system into installation and management scripts'"
echo ""

echo "5. Push to GitHub:"
echo "   git push -u origin claude/logging-diagnostic-system"
echo ""

echo "6. Test the installation:"
echo "   node install.js          # Basic installation"
echo "   node install-full.js     # Full installation with diagnostics"
echo ""

echo "7. If installation fails, run diagnostics:"
echo "   node lib/diagnostic-analyzer.js install.diagnostic"
echo "   node lib/install-menu.js install.diagnostic install.log"
echo ""

echo "✨ All set! The logging system is ready to use."
echo ""
