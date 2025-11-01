#!/bin/bash
# ACE Framework Starter Kit Generator
# Creates a minimal ACE setup in any project directory

set -e

TARGET_DIR="${1:-.}"

echo "🚀 Creating ACE Framework in $TARGET_DIR"

cd "$TARGET_DIR"

# 1. Create directory structure
echo "📁 Creating directories..."
mkdir -p agents mcp logs scripts

# 2. Copy core files (assumes running from ACE_Beads_Amp repo)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACE_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📦 Copying ACE framework files..."

# Core agents
cp "$ACE_ROOT/agents/Generator.ts" agents/ 2>/dev/null || echo "Note: Generator.ts not found"
cp "$ACE_ROOT/agents/Reflector.ts" agents/ 2>/dev/null || echo "Note: Reflector.ts not found"
cp "$ACE_ROOT/agents/Curator.ts" agents/ 2>/dev/null || echo "Note: Curator.ts not found"

# Supporting files
cp "$ACE_ROOT/mcp/types.ts" mcp/ 2>/dev/null || echo "Note: types.ts not found"
cp "$ACE_ROOT/mcp/beads-client.ts" mcp/ 2>/dev/null || echo "Note: beads-client.ts not found"

# Scripts
cp "$ACE_ROOT/scripts/ace-learn-cycle.ts" scripts/ 2>/dev/null || echo "Note: ace-learn-cycle.ts not found"

# 3. Initialize log files
echo "📝 Creating log files..."
touch logs/execution_traces.jsonl
touch logs/insights.jsonl

# 4. Create AGENTS.md if it doesn't exist
if [ ! -f "AGENTS.md" ]; then
  echo "📄 Creating AGENTS.md..."
  cat > AGENTS.md << 'EOF'
# Project Guide

## Build Commands
```bash
npm run build
npm test
npm run lint
```

## Learned Patterns (ACE-managed)
<!-- This section is managed by the ACE Curator -->
<!-- Format: [Bullet #ID, helpful:N, harmful:M] Pattern description -->

### Build & Test Patterns
<!-- Curator adds build/test insights here -->

### TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

### Dependency Patterns
<!-- Curator adds dependency insights here -->

### Architecture Patterns
<!-- Curator adds high-level design insights here -->
EOF
fi

# 5. Check/create TypeScript config
if [ ! -f "tsconfig.json" ]; then
  echo "⚙️  Creating tsconfig.json..."
  cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node"
  },
  "include": ["agents/**/*", "mcp/**/*", "scripts/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
fi

# 6. Check/update package.json
if [ ! -f "package.json" ]; then
  echo "📦 Creating package.json..."
  npm init -y
fi

echo "📝 Updating package.json..."
npm pkg set type="module"
npm pkg set scripts.build="tsc"
npm pkg set scripts.ace-learn="tsx scripts/ace-learn-cycle.ts"

# 7. Install dependencies
echo "📥 Installing dependencies..."
npm install --save-dev typescript @types/node tsx

# 8. Initialize Beads if bd is available
if command -v bd &> /dev/null; then
  if [ ! -d ".beads" ]; then
    echo "🔵 Initializing Beads..."
    bd init
  fi
else
  echo "⚠️  Beads (bd) not found. Install from: https://github.com/steveyegge/beads"
fi

# 9. Build
echo "🔨 Building TypeScript..."
npm run build

echo ""
echo "✅ ACE Framework installed successfully!"
echo ""
echo "Next steps:"
echo "  1. Create a task: bd create 'Your first task' -t task -p 1"
echo "  2. Work on it with Amp"
echo "  3. Run learning: npm run ace-learn"
echo "  4. Check AGENTS.md for new patterns"
echo ""
echo "Files created:"
echo "  - agents/Generator.ts, Reflector.ts, Curator.ts"
echo "  - mcp/types.ts, beads-client.ts"
echo "  - scripts/ace-learn-cycle.ts"
echo "  - logs/execution_traces.jsonl, insights.jsonl"
echo "  - AGENTS.md (if new)"
echo ""
echo "📖 See INTEGRATION_GUIDE.md for detailed usage"
