#!/usr/bin/env node

/**
 * ACE Auto-Capture Post-Test Hook
 * 
 * This script runs automatically after `npm test` to capture test execution results.
 * It only runs if:
 * 1. ACE is initialized in the project (.ace directory exists)
 * 2. A current bead ID is set in environment variable ACE_CURRENT_BEAD
 * 
 * Usage:
 * - Automatic: npm test (this script runs via posttest hook)
 * - Manual with bead: ACE_CURRENT_BEAD=ACE_Beads_Amp-123 npm test
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const cwd = process.cwd();
const testExitCode = process.env.npm_lifecycle_event === 'posttest' ? 
  (process.env.npm_package_scripts_test_exit_code || '0') : '0';

// Check if ACE is present (matches MANDATORY rule in ~/.config/AGENTS.md)
const hasACE = existsSync(join(cwd, '.ace.json')) || 
               existsSync(join(cwd, 'AGENTS.md')) || 
               existsSync(join(cwd, 'logs'));

if (!hasACE) {
  // Silently exit if ACE not present
  process.exit(0);
}

// Get active bead ID from beads system
function getActiveBeadId() {
  // 1. Check explicit env var first (for manual override)
  if (process.env.ACE_CURRENT_BEAD) return process.env.ACE_CURRENT_BEAD;
  
  try {
    // 2. Query beads for in-progress issues
    const result = execSync('bd list --status in_progress --json', { 
      cwd, 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']  // Suppress stderr
    }).trim();
    
    if (!result) return null;
    
    const issues = JSON.parse(result);
    
    // If exactly one in-progress issue, use it
    if (Array.isArray(issues) && issues.length === 1) {
      return issues[0].id;
    }
    
    // If multiple in-progress, check for most recently updated
    if (Array.isArray(issues) && issues.length > 1) {
      if (process.env.ACE_VERBOSE) {
        console.log(`[ACE] Multiple in-progress beads found (${issues.length}), using most recent`);
      }
      // Sort by updated_at descending
      issues.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return issues[0].id;
    }
    
    return null;
  } catch (err) {
    // bd command failed or not installed
    if (process.env.ACE_VERBOSE) {
      console.log('[ACE] Could not query beads:', err.message);
    }
    return null;
  }
}

const beadId = getActiveBeadId();

// Check if a bead ID is available
if (!beadId) {
  // No active bead - skip auto-capture
  if (process.env.ACE_VERBOSE) {
    console.log('[ACE] No in-progress bead found. Skipping auto-capture.');
  }
  process.exit(0);
}

/**
 * Parse Vitest JSON output to extract test metrics
 * Vitest JSON reporter outputs structured test results
 */
function parseVitestJson() {
  const jsonFile = join(cwd, '.test-results.json');
  
  if (!existsSync(jsonFile)) {
    return {};
  }
  
  try {
    const data = JSON.parse(readFileSync(jsonFile, 'utf-8'));
    
    const metrics = {
      tests_passed: 0,
      tests_failed: 0,
      test_files_passed: 0,
      test_files_failed: 0,
      duration_ms: data.testResults?.reduce((sum, r) => sum + (r.assertionResults?.reduce((s, a) => s + (a.duration || 0), 0) || 0), 0) || 0
    };
    
    // Count test results
    if (data.testResults) {
      for (const fileResult of data.testResults) {
        let filePassed = true;
        
        if (fileResult.assertionResults) {
          for (const test of fileResult.assertionResults) {
            if (test.status === 'passed') {
              metrics.tests_passed++;
            } else if (test.status === 'failed') {
              metrics.tests_failed++;
              filePassed = false;
            }
          }
        }
        
        if (filePassed && fileResult.assertionResults?.length > 0) {
          metrics.test_files_passed++;
        } else if (!filePassed) {
          metrics.test_files_failed++;
        }
      }
    }
    
    // Clean up JSON file
    try {
      unlinkSync(jsonFile);
    } catch {}
    
    return metrics;
  } catch (error) {
    if (process.env.ACE_VERBOSE) {
      console.log('[ACE] Could not parse test results JSON:', error.message);
    }
    return {};
  }
}

// Capture test results with execution details
try {
  const outcome = testExitCode === '0' ? 'success' : 'failure';
  const metrics = parseVitestJson();
  
  // Create execution result JSON
  const execution = {
    runner: 'vitest',
    command: 'npm test',
    status: testExitCode === '0' ? 'pass' : 'fail',
    errors: [],
    metrics: Object.keys(metrics).length > 0 ? metrics : undefined
  };
  
  // Write execution JSON to temp file
  const execFile = join(tmpdir(), `ace-exec-${process.pid}.json`);
  writeFileSync(execFile, JSON.stringify([execution], null, 2), 'utf-8');
  
  const captureCmd = `ace capture --bead "${beadId}" --desc "Auto-captured test run" --outcome ${outcome} --exec "${execFile}" --json`;
  
  if (process.env.ACE_VERBOSE) {
    console.log(`[ACE] Auto-capturing test results for ${beadId} (outcome: ${outcome})`);
    if (metrics.tests_passed !== undefined) {
      console.log(`[ACE] Tests: ${metrics.tests_passed} passed, ${metrics.tests_failed || 0} failed`);
    }
  }
  
  execSync(captureCmd, { 
    stdio: process.env.ACE_VERBOSE ? 'inherit' : 'pipe',
    cwd 
  });
  
  // Clean up temp file
  try {
    unlinkSync(execFile);
  } catch {}
  
  if (process.env.ACE_VERBOSE) {
    console.log('[ACE] ✓ Test results captured successfully');
  }
} catch (error) {
  // Don't fail the build if capture fails
  if (process.env.ACE_VERBOSE) {
    console.error('[ACE] Warning: Failed to capture test results:', error.message);
  }
}

process.exit(0);
