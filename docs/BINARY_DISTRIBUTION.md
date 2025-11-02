# ACE Binary Distribution

ACE can be distributed as a single standalone binary that requires no dependencies (no Node.js, npm, or Bun needed).

## Building Binaries

### Quick Build (Current Platform)

```bash
npm run build:cli
```

This creates `dist/ace` - a standalone executable for your current platform.

### Multi-Platform Builds

```bash
npm run build:binaries
```

Creates release-ready archives in `dist/binaries/`:
- `ace-{platform}-{arch}.tar.gz` - Compressed binary
- `ace-{platform}-{arch}.tar.gz.sha256` - Checksum file

**Note**: Bun currently only cross-compiles for the host platform. To build for all platforms, use GitHub Actions (see below) or run the script on each target platform.

## Supported Platforms

| Platform | Architecture | Binary Name |
|----------|--------------|-------------|
| macOS | arm64 (Apple Silicon) | `ace-darwin-arm64` |
| macOS | x64 (Intel) | `ace-darwin-x64` |
| Linux | arm64 | `ace-linux-arm64` |
| Linux | x64 | `ace-linux-x64` |

## Using the Binary

### Installation

**macOS/Linux:**
```bash
# Download and extract
tar -xzf ace-darwin-arm64.tar.gz

# Move to PATH
sudo mv ace-darwin-arm64 /usr/local/bin/ace
chmod +x /usr/local/bin/ace

# Verify
ace --version
```

**Quick Install (one-liner):**
```bash
curl -fsSL https://github.com/YOUR_ORG/ace/releases/latest/download/ace-darwin-arm64.tar.gz | \
  tar -xz && sudo mv ace-darwin-arm64 /usr/local/bin/ace
```

### Usage

Once installed, use `ace` commands directly:

```bash
ace init
ace capture --bead bd-123 --exec errors.json
ace learn --beads bd-123
```

No `npm`, `node`, or `bun` required!

## GitHub Actions Release

Create `.github/workflows/release.yml`:

```yaml
name: Build and Release Binaries

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    name: Build ${{ matrix.platform }}-${{ matrix.arch }}
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          - os: macos-latest
            platform: darwin
            arch: arm64
          - os: macos-13
            platform: darwin
            arch: x64
          - os: ubuntu-latest
            platform: linux
            arch: x64
          - os: ubuntu-latest
            platform: linux
            arch: arm64

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Build binary
        run: bun build src/cli.ts --compile --outfile ace
      
      - name: Create archive
        run: |
          BINARY_NAME="ace-${{ matrix.platform }}-${{ matrix.arch }}"
          mv ace "$BINARY_NAME"
          tar -czf "${BINARY_NAME}.tar.gz" "$BINARY_NAME"
          shasum -a 256 "${BINARY_NAME}.tar.gz" > "${BINARY_NAME}.tar.gz.sha256"
      
      - name: Upload Release Asset
        uses: softprops/action-gh-release@v1
        with:
          files: |
            ace-${{ matrix.platform }}-${{ matrix.arch }}.tar.gz
            ace-${{ matrix.platform }}-${{ matrix.arch }}.tar.gz.sha256
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Triggering Releases

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions will automatically build binaries for all platforms and create a release.

## Binary Size

Typical binary sizes:
- macOS arm64: ~57MB (compressed: ~21MB)
- macOS x64: ~60MB (compressed: ~22MB)
- Linux x64: ~55MB (compressed: ~20MB)
- Linux arm64: ~52MB (compressed: ~19MB)

Bun bundles the runtime and all dependencies into a single executable.

## Development vs Production

| Use Case | Method | Pros |
|----------|--------|------|
| Development | `npm run dev` + `npm run cli` | Fast iteration, debugging |
| Testing | `npm run build:cli` | Test binary locally |
| CI/CD | `npm run build:binaries` | Automated builds |
| Distribution | GitHub Releases | Users download pre-built binaries |

## Troubleshooting

### "Permission denied" when running binary
```bash
chmod +x ace-darwin-arm64
```

### "Cannot be opened because the developer cannot be verified" (macOS)
```bash
xattr -d com.apple.quarantine ace-darwin-arm64
```

Or allow in System Preferences → Security & Privacy.

### Binary doesn't work on target platform
Ensure you downloaded the correct platform/architecture binary:
```bash
uname -s  # Darwin = macOS, Linux = Linux
uname -m  # arm64 or x86_64 (= x64)
```

## Updating

To update ACE:

1. Download new binary from releases
2. Replace existing binary in `/usr/local/bin/ace`
3. Verify: `ace --version`

## Uninstalling

```bash
sudo rm /usr/local/bin/ace
```
