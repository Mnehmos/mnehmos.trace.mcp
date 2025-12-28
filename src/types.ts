/**
 * Trace MCP - Core Domain Types
 * Based on DESIGN.md specifications
 */

import { z } from 'zod';

// ============================================================================
// JSON Schema representation (simplified)
// ============================================================================
export type JSONSchema = {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  description?: string;
  [key: string]: unknown;
};

// ============================================================================
// Location in source code
// ============================================================================
export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}

// ============================================================================
// Producer Schema - What an MCP tool PROVIDES
// ============================================================================
export interface ProducerSchema {
  toolName: string;
  description?: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  location: SourceLocation;
}

// ============================================================================
// Consumer Schema - What client code EXPECTS
// ============================================================================
export interface ConsumerSchema {
  toolName: string;
  callSite: SourceLocation;
  argumentsProvided: Record<string, unknown>;
  expectedProperties: string[]; // Properties accessed on the result
}

// ============================================================================
// Analysis Results
// ============================================================================
export type MismatchType = 
  | 'MISSING_PROPERTY'    // Consumer expects property producer doesn't provide
  | 'TYPE_MISMATCH'       // Types don't align
  | 'ARGUMENT_ERROR'      // Wrong arguments passed to tool
  | 'UNKNOWN_TOOL';       // Tool called but not defined

export interface Mismatch {
  toolName: string;
  issueType: MismatchType;
  description: string;
  producerLocation?: SourceLocation;
  consumerLocation: SourceLocation;
  details?: Record<string, unknown>;
}

export interface Match {
  toolName: string;
  producerLocation: SourceLocation;
  consumerLocation: SourceLocation;
}

export interface TraceResult {
  timestamp: string;
  producerSource: string;
  consumerSource: string;
  matches: Match[];
  mismatches: Mismatch[];
  summary: {
    totalTools: number;
    totalCalls: number;
    matchCount: number;
    mismatchCount: number;
  };
}

// ============================================================================
// Zod Validators (for runtime safety)
// ============================================================================
export const SourceLocationSchema = z.object({
  file: z.string(),
  line: z.number(),
  column: z.number().optional(),
});

export const MismatchSchema = z.object({
  toolName: z.string(),
  issueType: z.enum(['MISSING_PROPERTY', 'TYPE_MISMATCH', 'ARGUMENT_ERROR', 'UNKNOWN_TOOL']),
  description: z.string(),
  producerLocation: SourceLocationSchema.optional(),
  consumerLocation: SourceLocationSchema,
  details: z.record(z.unknown()).optional(),
});
