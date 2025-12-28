/**
 * Contract Comments Tool
 * Adds cross-reference comments to producer and consumer code
 * when a contract is validated as working.
 */

import { Project, SyntaxKind } from 'ts-morph';
import type { ProducerSchema, ConsumerSchema, Match } from '../types.js';

export interface ContractCommentOptions {
  /** The validated match to document */
  match: Match;
  /** Producer schema details */
  producer: ProducerSchema;
  /** Consumer schema details */
  consumer: ConsumerSchema;
  /** Comment style */
  style?: 'jsdoc' | 'inline' | 'block';
  /** Include timestamp */
  includeTimestamp?: boolean;
  /** Custom prefix for comments */
  prefix?: string;
}

export interface CommentResult {
  success: boolean;
  producerFile: string;
  consumerFile: string;
  producerComment: string;
  consumerComment: string;
  error?: string;
}

/**
 * Generate cross-reference comments for a validated contract
 */
export function generateContractComments(options: ContractCommentOptions): {
  producerComment: string;
  consumerComment: string;
} {
  const { match, producer, consumer, style = 'block', includeTimestamp = true, prefix = '@trace-contract' } = options;
  const timestamp = includeTimestamp ? ` | Validated: ${new Date().toISOString().split('T')[0]}` : '';
  
  // Producer comment points to consumer
  const producerComment = formatComment({
    style,
    lines: [
      `${prefix} PRODUCER`,
      `Tool: ${match.toolName}`,
      `Consumer: ${consumer.callSite.file}:${consumer.callSite.line}`,
      `Args: ${Object.keys(consumer.argumentsProvided).join(', ')}`,
      `Expected Props: ${consumer.expectedProperties.slice(0, 5).join(', ')}${consumer.expectedProperties.length > 5 ? '...' : ''}`,
      timestamp ? `Validated: ${timestamp}` : '',
    ].filter(Boolean),
  });

  // Consumer comment points to producer  
  const consumerComment = formatComment({
    style,
    lines: [
      `${prefix} CONSUMER`,
      `Tool: ${match.toolName}`,
      `Producer: ${producer.location.file}:${producer.location.line}`,
      `Required Args: ${producer.inputSchema.required?.join(', ') || 'none'}`,
      `Schema Props: ${Object.keys(producer.inputSchema.properties || {}).join(', ')}`,
      timestamp ? `Validated: ${timestamp}` : '',
    ].filter(Boolean),
  });

  return { producerComment, consumerComment };
}

/**
 * Format a comment based on style
 */
function formatComment(options: { style: 'jsdoc' | 'inline' | 'block'; lines: string[] }): string {
  const { style, lines } = options;
  
  switch (style) {
    case 'jsdoc':
      return `/**\n${lines.map(l => ` * ${l}`).join('\n')}\n */`;
    case 'inline':
      return lines.map(l => `// ${l}`).join('\n');
    case 'block':
    default:
      return `/*\n${lines.map(l => ` * ${l}`).join('\n')}\n */`;
  }
}

/**
 * Add contract comments to source files
 * WARNING: This modifies files! Use with caution.
 */
export async function addContractComments(options: ContractCommentOptions): Promise<CommentResult> {
  const { match, producer, consumer } = options;
  const { producerComment, consumerComment } = generateContractComments(options);
  
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  try {
    // Add comment to producer file
    const producerFile = project.addSourceFileAtPath(producer.location.file);
    const producerNode = findNodeAtLine(producerFile, producer.location.line);
    
    if (producerNode) {
      // Add comment before the tool definition
      producerNode.replaceWithText(`${producerComment}\n${producerNode.getText()}`);
    }

    // Add comment to consumer file
    const consumerFile = project.addSourceFileAtPath(consumer.callSite.file);
    const consumerNode = findNodeAtLine(consumerFile, consumer.callSite.line);
    
    if (consumerNode) {
      // Add comment before the callTool invocation
      consumerNode.replaceWithText(`${consumerComment}\n${consumerNode.getText()}`);
    }

    // Save changes
    await project.save();

    return {
      success: true,
      producerFile: producer.location.file,
      consumerFile: consumer.callSite.file,
      producerComment,
      consumerComment,
    };
  } catch (error) {
    return {
      success: false,
      producerFile: producer.location.file,
      consumerFile: consumer.callSite.file,
      producerComment,
      consumerComment,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Find the statement node at a specific line
 */
function findNodeAtLine(sourceFile: any, line: number): any {
  let targetNode: any = null;
  
  sourceFile.forEachDescendant((node: any) => {
    if (node.getStartLineNumber() === line) {
      // Prefer statement-level nodes
      const parent = node.getParent();
      if (parent && parent.getKind() === SyntaxKind.ExpressionStatement) {
        targetNode = parent;
      } else if (!targetNode) {
        targetNode = node;
      }
    }
  });
  
  return targetNode;
}

/**
 * Preview what comments would be added without modifying files
 */
export function previewContractComments(options: ContractCommentOptions): {
  producerPreview: string;
  consumerPreview: string;
} {
  const { producerComment, consumerComment } = generateContractComments(options);
  const { producer, consumer } = options;
  
  return {
    producerPreview: `// At ${producer.location.file}:${producer.location.line}\n${producerComment}`,
    consumerPreview: `// At ${consumer.callSite.file}:${consumer.callSite.line}\n${consumerComment}`,
  };
}
