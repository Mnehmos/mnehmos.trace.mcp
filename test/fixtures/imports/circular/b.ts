/**
 * Circular reference test: B imports A which imports B.
 * This file defines NodeB which references NodeA.
 */

import type { NodeA } from './a';

/**
 * Node B in a graph - references Node A (creates circular import)
 */
export interface NodeB {
  /** Node identifier */
  id: string;
  
  /** Node weight */
  weight: number;
  
  /** 
   * Source NodeA (circular reference back to a.ts).
   * When resolved, should be represented as a type ref.
   */
  source: NodeA;
  
  /**
   * Target NodeA (circular reference).
   */
  target: NodeA;
  
  /** Edge metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Helper type for B-related operations
 */
export type NodeBId = NodeB['id'];

/**
 * Edge weight extractor
 */
export type EdgeWeight = NodeB['weight'];
