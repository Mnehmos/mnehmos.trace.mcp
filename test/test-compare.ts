/**
 * Test script - Full end-to-end comparison
 */

import { extractFromFile } from '../src/extract/index.js';
import { traceFromFile } from '../src/trace/index.js';
import { compareSchemas } from '../src/compare/index.js';
import { formatResult } from '../src/report/index.js';

async function runTest() {
  console.log('=== End-to-End Comparison Test ===\n');
  
  // Step 1: Extract producer schemas from sample server
  console.log('📦 Extracting backend schemas...');
  const producers = await extractFromFile('./test/fixtures/sample-server.ts');
  console.log(`   Found ${producers.length} tools\n`);
  
  // Step 2: Trace consumer usage from sample consumer
  console.log('🔍 Tracing frontend usage...');
  const consumers = await traceFromFile('./test/fixtures/sample-consumer.ts');
  console.log(`   Found ${consumers.length} tool calls\n`);
  
  // Step 3: Compare!
  console.log('⚖️  Comparing schemas...\n');
  const result = compareSchemas(producers, consumers);
  
  // Step 4: Report
  console.log('=== RESULTS ===\n');
  console.log(formatResult(result, 'markdown'));
  
  // Summary
  console.log('\n=== Summary ===');
  if (result.mismatches.length > 0) {
    console.log(`❌ Found ${result.mismatches.length} mismatch(es)!`);
    for (const m of result.mismatches) {
      console.log(`   - ${m.toolName}: ${m.description}`);
    }
  } else {
    console.log('✅ No mismatches found!');
  }
}

runTest().catch(console.error);
