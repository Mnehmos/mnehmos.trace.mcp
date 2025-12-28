/**
 * Test script - Extract schemas from sample server
 */

import { extractFromFile } from '../src/extract/index.js';

async function runTest() {
  console.log('=== Testing Schema Extraction ===\n');
  
  const testFile = './test/fixtures/sample-server.ts';
  
  try {
    const schemas = await extractFromFile(testFile);
    
    console.log(`Found ${schemas.length} tool(s):\n`);
    
    for (const schema of schemas) {
      console.log(`📦 Tool: ${schema.toolName}`);
      console.log(`   Description: ${schema.description || '(none)'}`);
      console.log(`   Location: ${schema.location.file}:${schema.location.line}`);
      console.log(`   Input Schema:`);
      console.log(JSON.stringify(schema.inputSchema, null, 4).split('\n').map(l => '      ' + l).join('\n'));
      console.log('');
    }
    
    console.log('=== Test Complete ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest();
