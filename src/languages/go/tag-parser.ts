/**
 * Go Struct Tag Parser
 * Parses Go struct tags like `json:"name,omitempty"`
 */

import type { ParsedTag } from './types.js';

/**
 * Parse a complete struct tag string (e.g., `json:"name,omitempty" db:"col"`)
 * and extract the json tag value
 */
export function parseStructTags(tagString: string): {
  json?: ParsedTag;
  validate?: { required: boolean };
} {
  const result: { json?: ParsedTag; validate?: { required: boolean } } = {};

  // Match json tag: json:"value" or json:`value`
  const jsonMatch = tagString.match(/json:"([^"]*)"/) || tagString.match(/json:`([^`]*)`/);
  if (jsonMatch) {
    result.json = parseJsonTag(jsonMatch[1]);
  }

  // Match validate tag for required
  const validateMatch = tagString.match(/validate:"([^"]*)"/);
  if (validateMatch) {
    result.validate = {
      required: validateMatch[1].split(',').includes('required'),
    };
  }

  return result;
}

/**
 * Parse a JSON tag value (the part inside the quotes)
 * Examples:
 *   "name" -> { name: 'name', omitempty: false, skip: false }
 *   "name,omitempty" -> { name: 'name', omitempty: true, skip: false }
 *   "-" -> { name: '', omitempty: false, skip: true }
 *   ",omitempty" -> { name: '', omitempty: true, skip: false }
 *   ",string" -> { name: '', omitempty: false, skip: false, asString: true }
 */
export function parseJsonTag(tagValue: string): ParsedTag {
  // Check for skip
  if (tagValue === '-') {
    return { name: '', omitempty: false, skip: true, asString: false };
  }

  const parts = tagValue.split(',');
  const name = parts[0] || '';
  const options = parts.slice(1);

  return {
    name,
    omitempty: options.includes('omitempty'),
    skip: false,
    asString: options.includes('string'),
  };
}

/**
 * Extract the raw tag string from a Go struct field line
 * Returns the content between backticks
 */
export function extractTagString(fieldLine: string): string | null {
  const match = fieldLine.match(/`([^`]+)`/);
  return match ? match[1] : null;
}

/**
 * Class wrapper for tag parsing with stateful operations
 */
export class TagParser {
  /**
   * Parse struct tags from a field line
   */
  parseFieldTags(
    fieldLine: string
  ): { json?: ParsedTag; validate?: { required: boolean } } {
    const tagString = extractTagString(fieldLine);
    if (!tagString) {
      return {};
    }
    return parseStructTags(tagString);
  }

  /**
   * Get the JSON property name for a field
   * Returns the json tag name, or falls back to the Go field name
   */
  getJsonName(goFieldName: string, fieldLine: string): string {
    const tags = this.parseFieldTags(fieldLine);
    if (tags.json?.skip) {
      return ''; // Will be skipped
    }
    if (tags.json?.name) {
      return tags.json.name;
    }
    // Fall back to Go field name
    return goFieldName;
  }

  /**
   * Check if a field should be skipped in JSON serialization
   */
  shouldSkip(fieldLine: string): boolean {
    const tags = this.parseFieldTags(fieldLine);
    return tags.json?.skip ?? false;
  }

  /**
   * Check if a field has omitempty option
   */
  hasOmitempty(fieldLine: string): boolean {
    const tags = this.parseFieldTags(fieldLine);
    return tags.json?.omitempty ?? false;
  }

  /**
   * Check if a field has validate:"required"
   */
  isValidateRequired(fieldLine: string): boolean {
    const tags = this.parseFieldTags(fieldLine);
    return tags.validate?.required ?? false;
  }
}
