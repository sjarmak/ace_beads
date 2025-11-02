#!/bin/bash
# Build ACE binaries for multiple platforms
# Requires Bun 1.0+ with cross-compilation support

set -e

VERSION="${1:-0.1.0}"
DIST_DIR="dist/binaries"
ENTRY="src/cli.ts"

echo "🔨 Building ACE v${VERSION} binaries for all platforms..."
echo ""

# Clean previous builds
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Platform configurations
# Note: Bun currently only supports compiling for the host platform
# Cross-compilation requires building on each target platform

PLATFORMS=(
  "darwin:arm64:ace-darwin-arm64"
  "darwin:x64:ace-darwin-x64"
  "linux:arm64:ace-linux-arm64"
  "linux:x64:ace-linux-x64"
)

# Detect current platform
CURRENT_OS=$(uname -s | tr '[:upper:]' '[:lower:]')
CURRENT_ARCH=$(uname -m)

if [ "$CURRENT_ARCH" = "aarch64" ]; then
  CURRENT_ARCH="arm64"
elif [ "$CURRENT_ARCH" = "x86_64" ]; then
  CURRENT_ARCH="x64"
fi

echo "Current platform: ${CURRENT_OS}-${CURRENT_ARCH}"
echo ""

# Build for current platform
BINARY_NAME="ace-${CURRENT_OS}-${CURRENT_ARCH}"
echo "✅ Building ${BINARY_NAME}..."
bun build "$ENTRY" --compile --outfile "$DIST_DIR/$BINARY_NAME"

# Create archive
cd "$DIST_DIR"
tar -czf "${BINARY_NAME}.tar.gz" "$BINARY_NAME"
CHECKSUM=$(shasum -a 256 "${BINARY_NAME}.tar.gz" | awk '{print $1}')
echo "$CHECKSUM  ${BINARY_NAME}.tar.gz" > "${BINARY_NAME}.tar.gz.sha256"
cd - > /dev/null

echo "✅ Built and archived ${BINARY_NAME}"
echo "   SHA256: $CHECKSUM"
echo ""

# Note about cross-compilation
echo "ℹ️  Note: Bun currently only supports building for the host platform."
echo "   To build for other platforms, run this script on each target platform."
echo "   Or use GitHub Actions with matrix builds (see .github/workflows/release.yml)"
echo ""

echo "📦 Binaries ready in $DIST_DIR/"
ls -lh "$DIST_DIR/"
