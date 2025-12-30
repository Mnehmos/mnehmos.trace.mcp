/**
 * Circular reference test: Part of indirect circular chain A → B → C → A.
 * This file completes the cycle by importing from a.ts.
 */

import type { NodeA } from './a';
import type { NodeB } from './b';

/**
 * Node C forms the third point in a circular dependency chain.
 * A → B → C → A creates an indirect circular reference.
 */
export interface NodeC {
  /** Node identifier */
  id: string;
  
  /** Node description */
  description: string;
  
  /**
   * Reference to NodeA (completing the cycle).
   */
  referenceToA: NodeA;
  
  /**
   * Reference to NodeB.
   */
  referenceToB: NodeB;
  
  /**
   * Nested structure with circular refs
   */
  nested: {
    nodeA: NodeA;
    nodeB: NodeB;
  };
}

/**
 * Graph combining all three node types.
 * This creates multiple circular reference paths.
 */
export interface Graph {
  nodes: {
    a: NodeA[];
    b: NodeB[];
    c: NodeC[];
  };
  
  /** Optional root node */
  root?: NodeA | NodeB | NodeC;
}

/**
 * Self-referencing type for tree structures
 */
export interface TreeNode {
  id: string;
  value: string;
  /** Self-reference - node contains its own children */
  children: TreeNode[];
  /** Parent reference - another self-reference */
  parent?: TreeNode;
}
