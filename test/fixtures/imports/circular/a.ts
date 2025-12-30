/**
 * Circular reference test: A imports B which imports A.
 * This file defines NodeA which references NodeB.
 */

import type { NodeB } from './b';

/**
 * Node A in a graph - references Node B (creates circular import)
 */
export interface NodeA {
  /** Node identifier */
  id: string;
  
  /** Node label */
  label: string;
  
  /** 
   * Connected NodeB instances (circular reference).
   * When resolved, should be represented as a type ref, not inlined.
   */
  connections: NodeB[];
  
  /** Optional parent node (self-reference) */
  parent?: NodeA;
}

/**
 * Helper type for A-related operations
 */
export type NodeAId = NodeA['id'];
