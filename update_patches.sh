#!/bin/bash
# Save current manual changes in memorybench to the patch file
cd "$(dirname "$0")/../memorybench" || exit 1

echo "Updating patch file with changes from src/judges/base.ts and src/orchestrator/phases/report.ts..."
git diff src/judges/base.ts src/orchestrator/phases/report.ts > ../benchmark/patches/debugging_failures.patch

echo "Done! Don't forget to commit benchmark/patches/debugging_failures.patch"
