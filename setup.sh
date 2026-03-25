#!/bin/bash
set -e

# =============================================================================
# MemoryBench Setup Script for Memsy
# 
# This script:
# 1. Clones the MemoryBench repository
# 2. Injects the Memsy provider adapter
# 3. Patches MemoryBench to register Memsy as a provider
# 4. Installs dependencies
# =============================================================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/supermemoryai/memorybench"
TARGET_DIR="memorybench"

# Detect script location to find adapter source
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_SRC="$SCRIPT_DIR/adapter"
PROVIDER_DEST="$TARGET_DIR/src/providers/memsy"

echo -e "${BLUE}🚀 Setting up MemoryBench for Memsy...${NC}"

# =============================================================================
# Prerequisites Check
# =============================================================================

echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check for bun
if ! command -v bun &> /dev/null; then
    # Try common install locations
    if [ -f "$HOME/.bun/bin/bun" ]; then
        export PATH="$HOME/.bun/bin:$PATH"
    else
        echo -e "${RED}❌ Error: bun is not installed.${NC}"
        echo "   Install with: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
fi
echo -e "   ✅ bun $(bun --version)"

# Check for git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Error: git is not installed.${NC}"
    exit 1
fi
echo -e "   ✅ git available"

# Check adapter source exists
if [ ! -d "$ADAPTER_SRC" ]; then
    echo -e "${RED}❌ Error: Adapter source not found at $ADAPTER_SRC${NC}"
    echo "   Expected files: $ADAPTER_SRC/index.ts and $ADAPTER_SRC/prompts.ts"
    exit 1
fi
echo -e "   ✅ Adapter source found"

# =============================================================================
# Clone MemoryBench
# =============================================================================

if [ -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}⚠️  MemoryBench directory exists. Updating adapter files only...${NC}"
else
    echo -e "${BLUE}📦 Cloning MemoryBench...${NC}"
    git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
fi

# =============================================================================
# Install Memsy Provider
# =============================================================================

echo -e "${BLUE}📂 Installing Memsy Provider...${NC}"
mkdir -p "$PROVIDER_DEST"
cp "$ADAPTER_SRC/index.ts" "$PROVIDER_DEST/index.ts"
cp "$ADAPTER_SRC/prompts.ts" "$PROVIDER_DEST/prompts.ts"
echo -e "   ✅ Copied adapter files to $PROVIDER_DEST"

# =============================================================================
# Patch MemoryBench to Register Memsy Provider
# =============================================================================

PROVIDERS_INDEX="$TARGET_DIR/src/providers/index.ts"
PROVIDER_TYPES="$TARGET_DIR/src/types/provider.ts"

# Patch providers/index.ts
if ! grep -q "MemsyProvider" "$PROVIDERS_INDEX" 2>/dev/null; then
    echo -e "${BLUE}🔧 Patching providers/index.ts...${NC}"
    
    # Add import statement after existing imports
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed
        sed -i '' '/import .* from "\.\/zep"/a\
import { MemsyProvider } from "./memsy"' "$PROVIDERS_INDEX"
        
        # Add to providers object
        sed -i '' '/zep: ZepProvider,/a\
  memsy: MemsyProvider,' "$PROVIDERS_INDEX"
        
        # Add to export
        sed -i '' 's/export { SupermemoryProvider, Mem0Provider, ZepProvider }/export { SupermemoryProvider, Mem0Provider, ZepProvider, MemsyProvider }/' "$PROVIDERS_INDEX"
    else
        # Linux sed
        sed -i '/import .* from "\.\/zep"/a import { MemsyProvider } from "./memsy"' "$PROVIDERS_INDEX"
        sed -i '/zep: ZepProvider,/a\  memsy: MemsyProvider,' "$PROVIDERS_INDEX"
        sed -i 's/export { SupermemoryProvider, Mem0Provider, ZepProvider }/export { SupermemoryProvider, Mem0Provider, ZepProvider, MemsyProvider }/' "$PROVIDERS_INDEX"
    fi
    echo -e "   ✅ Patched providers/index.ts"
else
    echo -e "   ✅ providers/index.ts already patched"
fi

# Patch types/provider.ts
if ! grep -q '"memsy"' "$PROVIDER_TYPES" 2>/dev/null; then
    echo -e "${BLUE}🔧 Patching types/provider.ts...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/export type ProviderName = "supermemory" | "mem0" | "zep"/export type ProviderName = "supermemory" | "mem0" | "zep" | "memsy"/' "$PROVIDER_TYPES"
    else
        sed -i 's/export type ProviderName = "supermemory" | "mem0" | "zep"/export type ProviderName = "supermemory" | "mem0" | "zep" | "memsy"/' "$PROVIDER_TYPES"
    fi
    echo -e "   ✅ Patched types/provider.ts"
else
    echo -e "   ✅ types/provider.ts already patched"
fi

# Patch utils/config.ts to add memsy provider config
CONFIG_FILE="$TARGET_DIR/src/utils/config.ts"
if ! grep -q 'memsyApiUrl' "$CONFIG_FILE" 2>/dev/null; then
    echo -e "${BLUE}🔧 Patching utils/config.ts...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Add memsyApiUrl to Config interface
        sed -i '' '/zepApiKey: string/a\
  memsyApiUrl: string' "$CONFIG_FILE"
        
        # Add memsyApiUrl to config object
        sed -i '' '/zepApiKey: process.env.ZEP_API_KEY/a\
  memsyApiUrl: process.env.MEMSY_API_URL || "http://localhost:8003",' "$CONFIG_FILE"
        
        # Add memsy case to getProviderConfig (simpler approach - insert after zepApiKey return line)
        sed -i '' '/return { apiKey: config.zepApiKey }/a\
    case "memsy":\
      return { apiKey: "", baseUrl: config.memsyApiUrl }' "$CONFIG_FILE"
    else
        # Linux sed
        sed -i '/zepApiKey: string/a\  memsyApiUrl: string' "$CONFIG_FILE"
        sed -i '/zepApiKey: process.env.ZEP_API_KEY/a\  memsyApiUrl: process.env.MEMSY_API_URL || "http://localhost:8003",' "$CONFIG_FILE"
        sed -i '/return { apiKey: config.zepApiKey }/a\    case "memsy":\n      return { apiKey: "", baseUrl: config.memsyApiUrl }' "$CONFIG_FILE"
    fi
    echo -e "   ✅ Patched utils/config.ts"
else
    echo -e "   ✅ utils/config.ts already patched"
fi

# =============================================================================
# Apply Custom Patches
# =============================================================================

# 1. Passed/failed scenarios (--show-passed, judge parsing, report output)
PATCH_DEBUG="$SCRIPT_DIR/patches/debugging_failures.patch"
if [ -f "$PATCH_DEBUG" ]; then
    echo -e "${BLUE}🔧 Applying custom patches...${NC}"
    if ! grep -q "FAILED SCENARIOS" "$TARGET_DIR/src/orchestrator/phases/report.ts" 2>/dev/null; then
        (cd "$TARGET_DIR" && git apply "$PATCH_DEBUG")
        if [ $? -eq 0 ]; then
            echo -e "   ✅ Applied debugging_failures.patch"
        else
            echo -e "${RED}❌ Failed to apply debugging_failures.patch${NC}"
            exit 1
        fi
    else
        echo -e "   ✅ debugging_failures.patch already applied"
    fi
fi

# 2. Random sampling (--limit-round-robin N for exact N questions across categories)
PATCH_SAMPLING="$SCRIPT_DIR/patches/random-sampling.patch"
if [ -f "$PATCH_SAMPLING" ]; then
    if ! grep -q "limitRoundRobin" "$TARGET_DIR/src/types/checkpoint.ts" 2>/dev/null; then
        (cd "$TARGET_DIR" && git apply "$PATCH_SAMPLING")
        if [ $? -eq 0 ]; then
            echo -e "   ✅ Applied random-sampling.patch"
        else
            echo -e "${RED}❌ Failed to apply random-sampling.patch${NC}"
            exit 1
        fi
    else
        echo -e "   ✅ random-sampling.patch already applied"
    fi
fi

# 3. Display retrieved memories in report (FAILED/PASSED scenarios)
PATCH_RETRIEVED="$SCRIPT_DIR/patches/display-retrieved-memories.patch"
if [ -f "$PATCH_RETRIEVED" ]; then
    if ! grep -q "Retrieved Memories" "$TARGET_DIR/src/orchestrator/phases/report.ts" 2>/dev/null; then
        (cd "$TARGET_DIR" && git apply "$PATCH_RETRIEVED")
        if [ $? -eq 0 ]; then
            echo -e "   ✅ Applied display-retrieved-memories.patch"
        else
            echo -e "${RED}❌ Failed to apply display-retrieved-memories.patch${NC}"
            exit 1
        fi
    else
        echo -e "   ✅ display-retrieved-memories.patch already applied"
    fi
fi

# =============================================================================
# Install Dependencies
# =============================================================================

echo -e "${BLUE}📦 Installing dependencies...${NC}"
cd "$TARGET_DIR" && bun install

# =============================================================================
# Done
# =============================================================================

echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Start Memsy API:  ${BLUE}source .env && .venv/bin/uvicorn memsy.http.api:app --port 8003${NC}"
echo -e "  2. Run benchmark:    ${BLUE}./benchmark/run.sh [LIMIT] [WAIT_SECS] [SHOW_PASSED]${NC}"
echo -e "     Examples:"
echo -e "       ${BLUE}./benchmark/run.sh 5${NC}          # 5 questions (random sampling)"
echo -e "       ${BLUE}./benchmark/run.sh 7 10${NC}       # 7 questions, wait 10s for indexing"
echo -e "       ${BLUE}./benchmark/run.sh 1 2 true${NC}   # 1 question, wait 2s, show passed scenarios"
echo ""
