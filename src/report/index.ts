/**
 * Trace MCP - Reporter (Stub)
 * Formats TraceResult into various output formats
 */

import type { TraceResult } from '../types.js';

export type OutputFormat = 'json' | 'markdown' | 'summary';

/**
 * Format trace results for output
 */
export function formatResult(
  result: TraceResult,
  format: OutputFormat = 'json'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);
    
    case 'markdown':
      return formatMarkdown(result);
    
    case 'summary':
      return formatSummary(result);
    
    default:
      return JSON.stringify(result, null, 2);
  }
}

function formatMarkdown(result: TraceResult): string {
  const lines: string[] = [
    '# Trace MCP Analysis Report',
    '',
    `**Generated**: ${result.timestamp}`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total Tools | ${result.summary.totalTools} |`,
    `| Total Calls | ${result.summary.totalCalls} |`,
    `| Matches | ${result.summary.matchCount} |`,
    `| Mismatches | ${result.summary.mismatchCount} |`,
    '',
  ];
  
  if (result.mismatches.length > 0) {
    lines.push('## Mismatches', '');
    for (const m of result.mismatches) {
      lines.push(`### ${m.toolName}`);
      lines.push(`- **Type**: ${m.issueType}`);
      lines.push(`- **Description**: ${m.description}`);
      lines.push(`- **Consumer**: ${m.consumerLocation.file}:${m.consumerLocation.line}`);
      if (m.producerLocation) {
        lines.push(`- **Producer**: ${m.producerLocation.file}:${m.producerLocation.line}`);
      }
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

function formatSummary(result: TraceResult): string {
  const status = result.mismatches.length === 0 ? '✅ PASS' : '❌ FAIL';
  return `${status} - ${result.summary.matchCount} matches, ${result.summary.mismatchCount} mismatches`;
}
