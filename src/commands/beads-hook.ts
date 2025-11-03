import { mkdir, writeFile, chmod, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

interface BeadsHookOptions {
  json?: boolean;
  verbose?: boolean;
}

export async function beadsHookInstallCommand(options: BeadsHookOptions = {}): Promise<void> {
  const { json = false, verbose = false } = options;

  try {
    const cwd = process.cwd();
    const beadsHooksDir = join(cwd, '.beads', 'hooks');
    const onCloseHookPath = join(beadsHooksDir, 'on-close');

    // Create .beads/hooks directory
    await mkdir(beadsHooksDir, { recursive: true });
    if (verbose) console.log(`Created directory: ${beadsHooksDir}`);

    // Create on-close hook script
    const onCloseScript = `#!/bin/bash
# ACE auto-learn hook for Beads
# Runs when closing a bead to capture final state and trigger learning
set -e

BEAD_ID=$1

if [ -z "$BEAD_ID" ]; then
  echo "❌ Error: Bead ID not provided"
  exit 1
fi

echo "🔍 Running ACE learning for $BEAD_ID..."

# Run final tests to capture last execution state
npm test
TEST_EXIT=$?

# Capture final test results
ace capture \\
  --bead "$BEAD_ID" \\
  --desc "Final test run before close" \\
  --outcome $([ $TEST_EXIT -eq 0 ] && echo "success" || echo "failure") \\
  --json > /dev/null 2>&1 || true

# Run ACE canonical loop: Generator→Reflector→Curator→Evaluator
# Online mode processes this single bead immediately with P→P' evaluation
ace learn --beads "$BEAD_ID" --mode online --json > /dev/null 2>&1 || true

# If tests failed, prevent close and create discovered issues
if [ $TEST_EXIT -ne 0 ]; then
  echo "❌ Tests failed! Cannot close bead while tests are failing."
  echo ""
  echo "Please fix the test failures before closing this bead."
  echo "Run 'npm test' to see the failures."
  echo ""
  echo "Once fixed, you can close the bead again."
  exit 1
fi

echo "✓ ACE learning complete for $BEAD_ID"
exit 0
`;

    await writeFile(onCloseHookPath, onCloseScript, 'utf-8');
    if (verbose) console.log(`Created hook script: ${onCloseHookPath}`);

    // Make hook executable
    await chmod(onCloseHookPath, 0o755);
    if (verbose) console.log(`Made executable: ${onCloseHookPath}`);

    // Verify the hook is executable
    try {
      await access(onCloseHookPath, constants.X_OK);
    } catch {
      throw new Error(`Failed to make hook executable: ${onCloseHookPath}`);
    }

    if (json) {
      console.log(JSON.stringify({
        success: true,
        hooks: {
          'on-close': onCloseHookPath
        },
        message: 'ACE Beads hooks installed successfully'
      }, null, 2));
    } else {
      console.log('✓ ACE Beads hooks installed successfully');
      console.log('');
      console.log('Installed hooks:');
      console.log(`  - on-close: ${onCloseHookPath}`);
      console.log('');
      console.log('The on-close hook will:');
      console.log('  1. Run final tests before closing a bead');
      console.log('  2. Capture test results automatically');
      console.log('  3. Run ACE learning cycle to update knowledge base');
      console.log('  4. Prevent closing if tests fail');
      console.log('');
      console.log('Next steps:');
      console.log('  - Ensure beads supports on-close hooks');
      console.log('  - Try closing a bead to trigger the hook');
    }
  } catch (error) {
    if (json) {
      console.error(JSON.stringify({
        success: false,
        error: {
          code: 'HOOK_INSTALL_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      }, null, 2));
    } else {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error installing hooks: ${errMsg}`);
    }
    process.exit(1);
  }
}
