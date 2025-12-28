/**
 * Trace MCP - Schema Comparator
 * Compares producer schemas (backend) against consumer usage (frontend)
 */

import type { ProducerSchema, ConsumerSchema, TraceResult, Mismatch, Match, SourceLocation } from '../types.js';
import type { DataFlowDirection } from '../core/types.js';

export interface CompareOptions {
  /** Strict mode: treat missing optional properties as warnings */
  strict?: boolean;
  /** Ignore certain property names */
  ignoreProperties?: string[];
  /**
   * Data flow direction for compatibility checking
   * - producer_to_consumer: API response flow (extra producer fields OK)
   * - consumer_to_producer: API request flow (extra consumer fields OK)
   * - bidirectional: Must match exactly
   * @default "producer_to_consumer"
   */
  direction?: DataFlowDirection;
}

/**
 * Compare backend producer schemas against frontend consumer expectations
 */
export function compareSchemas(
  producers: ProducerSchema[],
  consumers: ConsumerSchema[],
  options: CompareOptions = {}
): TraceResult {
  // Default to producer_to_consumer (API response pattern)
  const direction = options.direction || 'producer_to_consumer';

  console.log(`[Comparator] Comparing ${producers.length} producers vs ${consumers.length} consumers`);
  console.log(`[Comparator] Direction: ${direction}`);

  const matches: Match[] = [];
  const mismatches: Mismatch[] = [];

  // Index producers by tool name for quick lookup
  const producerMap = new Map<string, ProducerSchema>();
  for (const producer of producers) {
    producerMap.set(producer.toolName, producer);
  }

  // Analyze each consumer usage
  for (const consumer of consumers) {
    const producer = producerMap.get(consumer.toolName);

    if (!producer) {
      // Tool not found in producer definitions
      mismatches.push({
        toolName: consumer.toolName,
        issueType: 'UNKNOWN_TOOL',
        description: `Tool "${consumer.toolName}" is called but not defined in producer`,
        consumerLocation: consumer.callSite,
      });
      continue;
    }

    // Check argument mismatches (consumer → producer direction)
    const argMismatches = checkArgumentMismatches(producer, consumer, direction);
    mismatches.push(...argMismatches);

    // Check expected property mismatches (producer → consumer direction)
    const propMismatches = checkPropertyMismatches(producer, consumer, options, direction);
    mismatches.push(...propMismatches);

    // If no mismatches for this call, it's a match
    if (argMismatches.length === 0 && propMismatches.length === 0) {
      matches.push({
        toolName: consumer.toolName,
        producerLocation: producer.location,
        consumerLocation: consumer.callSite,
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    producerSource: producers.length > 0 ? producers[0].location.file : '',
    consumerSource: consumers.length > 0 ? consumers[0].callSite.file : '',
    matches,
    mismatches,
    summary: {
      totalTools: producers.length,
      totalCalls: consumers.length,
      matchCount: matches.length,
      mismatchCount: mismatches.length,
    },
  };
}

/**
 * Check if consumer provides correct arguments to the tool
 * This represents consumer → producer data flow (request direction)
 */
function checkArgumentMismatches(
  producer: ProducerSchema,
  consumer: ConsumerSchema,
  direction: DataFlowDirection
): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const inputSchema = producer.inputSchema;

  if (!inputSchema.properties) {
    return mismatches;
  }

  const requiredArgs = inputSchema.required || [];
  const definedArgs = Object.keys(inputSchema.properties);
  const providedArgs = Object.keys(consumer.argumentsProvided);

  // Check for missing required arguments
  // This is ALWAYS an error regardless of direction
  for (const required of requiredArgs) {
    if (!providedArgs.includes(required)) {
      mismatches.push({
        toolName: consumer.toolName,
        issueType: 'ARGUMENT_ERROR',
        description: `Missing required argument "${required}"`,
        producerLocation: producer.location,
        consumerLocation: consumer.callSite,
        details: { missingArg: required, providedArgs },
      });
    }
  }

  // Check for unknown arguments (consumer → producer direction)
  // Treatment depends on direction:
  // - consumer_to_producer: extra consumer args are OK (producer ignores them)
  // - producer_to_consumer: this shouldn't happen for arguments (arguments go consumer → producer)
  // - bidirectional: must match exactly
  for (const provided of providedArgs) {
    if (!definedArgs.includes(provided)) {
      // For consumer_to_producer direction, extra consumer fields are acceptable (downgrade to warning)
      const isError = direction !== 'consumer_to_producer';

      // Check for similar names (potential typo or naming convention mismatch)
      const similar = findSimilarName(provided, definedArgs);

      if (isError) {
        mismatches.push({
          toolName: consumer.toolName,
          issueType: 'ARGUMENT_ERROR',
          description: similar
            ? `Unknown argument "${provided}" - did you mean "${similar}"?`
            : `Unknown argument "${provided}" not in tool schema`,
          producerLocation: producer.location,
          consumerLocation: consumer.callSite,
          details: { unknownArg: provided, definedArgs, suggestedArg: similar },
        });
      } else {
        // In consumer_to_producer mode, this is just informational
        // (We don't have a warnings array in current schema, so skip for now)
        // TODO: Add warnings support
      }
    }
  }

  return mismatches;
}

/**
 * Check if consumer expects properties that producer doesn't provide
 * This represents producer → consumer data flow (response direction)
 * This is the core mismatch detection (e.g., expecting "characterClass" but producer has "class")
 */
function checkPropertyMismatches(
  producer: ProducerSchema,
  consumer: ConsumerSchema,
  options: CompareOptions,
  direction: DataFlowDirection
): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const ignoreProps = options.ignoreProperties || [];

  // For now, we can't fully know the output schema structure
  // But we can detect common patterns and warn about potential issues
  for (const expectedProp of consumer.expectedProperties) {
    if (ignoreProps.includes(expectedProp)) continue;

    // Check for common naming convention mismatches
    const potentialMatch = detectNamingMismatch(expectedProp, producer);

    if (potentialMatch) {
      // Property mismatches in producer → consumer direction:
      // - producer_to_consumer: consumer expects property producer doesn't have = ERROR
      // - consumer_to_producer: not applicable (this checks response properties)
      // - bidirectional: must match = ERROR
      const isError = direction !== 'consumer_to_producer';

      if (isError) {
        mismatches.push({
          toolName: consumer.toolName,
          issueType: 'MISSING_PROPERTY',
          description: `Consumer expects "${expectedProp}" but producer has "${potentialMatch}"`,
          producerLocation: producer.location,
          consumerLocation: consumer.callSite,
          details: {
            expected: expectedProp,
            actual: potentialMatch,
            suggestion: `Change "${expectedProp}" to "${potentialMatch}" in consumer code`,
            direction: direction,
          },
        });
      }
    }
  }

  return mismatches;
}

/**
 * Detect if expected property has a naming convention mismatch
 */
function detectNamingMismatch(expectedProp: string, producer: ProducerSchema): string | null {
  // Common patterns to check
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    // characterClass vs class
    [/^(.+)Class$/, (m) => m[1].toLowerCase()],
    [/^(.+)_class$/, (m) => m[1]],
    // className vs class
    [/^class(.+)$/, (m) => m[1].toLowerCase()],
    // charClass vs class
    [/^char(.+)$/i, (m) => m[1].toLowerCase()],
  ];
  
  // Check if expected property follows a pattern that suggests a simpler name in producer
  for (const [pattern, transform] of patterns) {
    const match = expectedProp.match(pattern);
    if (match) {
      const simpleName = transform(match);
      // Check if producer's input schema has the simpler name
      // (This is a heuristic - in reality we'd check the output)
      if (producer.inputSchema.properties?.[simpleName]) {
        return simpleName;
      }
      // Also check common variations
      if (simpleName === 'class') {
        return 'class'; // Known naming conflict with JS reserved word
      }
    }
  }
  
  return null;
}

/**
 * Find a similar name in a list (for typo detection)
 */
function findSimilarName(name: string, candidates: string[]): string | null {
  const nameLower = name.toLowerCase();
  
  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase();
    
    // Exact match (different case)
    if (nameLower === candidateLower) {
      return candidate;
    }
    
    // One is a suffix/prefix of the other
    if (nameLower.includes(candidateLower) || candidateLower.includes(nameLower)) {
      return candidate;
    }
    
    // Levenshtein distance <= 2
    if (levenshteinDistance(nameLower, candidateLower) <= 2) {
      return candidate;
    }
  }
  
  return null;
}

/**
 * Simple Levenshtein distance for typo detection
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Quick check: does producer provide all properties consumer expects?
 */
export function checkPropertyCoverage(
  producer: ProducerSchema,
  consumer: ConsumerSchema
): Mismatch[] {
  return checkPropertyMismatches(producer, consumer, {}, 'producer_to_consumer');
}

/**
 * Convenience function: Compare a backend directory against a frontend directory
 */
export async function compareDirectories(
  backendDir: string,
  frontendDir: string,
  options: CompareOptions = {}
): Promise<TraceResult> {
  // Import dynamically to avoid circular deps
  const { extractProducerSchemas } = await import('../extract/index.js');
  const { traceConsumerUsage } = await import('../trace/index.js');
  
  console.log(`\n[Compare] Backend: ${backendDir}`);
  console.log(`[Compare] Frontend: ${frontendDir}\n`);
  
  const producers = await extractProducerSchemas({ rootDir: backendDir });
  const consumers = await traceConsumerUsage({ rootDir: frontendDir });
  
  return compareSchemas(producers, consumers, options);
}
