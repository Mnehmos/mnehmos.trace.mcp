/**
 * Schema Caching
 * Checksum-based caching for extracted schemas and traced usage
 */

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { join, relative } from 'path';
import type { ProducerSchema, ConsumerSchema } from '../types.js';
import type { TraceProject } from './project.js';

// ============================================================================
// Types
// ============================================================================

interface FileChecksum {
  path: string;
  mtime: number;
  size: number;
  hash: string;
}

interface CacheMetadata {
  version: string;
  timestamp: string;
  checksums: Record<string, FileChecksum>;
}

interface ProducerCache {
  metadata: CacheMetadata;
  schemas: ProducerSchema[];
}

interface ConsumerCache {
  metadata: CacheMetadata;
  usage: ConsumerSchema[];
}

// ============================================================================
// Cache File Names
// ============================================================================

const PRODUCER_CACHE = 'producer-schemas.json';
const CONSUMER_CACHE = 'consumer-usage.json';
const CACHE_VERSION = '1.0.0';

// ============================================================================
// SchemaCache Class
// ============================================================================

export class SchemaCache {
  private project: TraceProject;

  constructor(project: TraceProject) {
    this.project = project;
  }

  // --------------------------------------------------------------------------
  // Producer Cache
  // --------------------------------------------------------------------------

  /**
   * Get cached producer schemas if still valid
   */
  getProducerSchemas(files: string[]): ProducerSchema[] | null {
    const cachePath = join(this.project.cachePath, PRODUCER_CACHE);
    
    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const cache: ProducerCache = JSON.parse(readFileSync(cachePath, 'utf-8'));
      
      // Check version
      if (cache.metadata.version !== CACHE_VERSION) {
        return null;
      }

      // Check all files are still valid
      for (const file of files) {
        const relPath = relative(this.project.rootDir, file);
        const cached = cache.metadata.checksums[relPath];
        
        if (!cached || !this.isFileValid(file, cached)) {
          return null; // Cache invalidated
        }
      }

      return cache.schemas;
    } catch {
      return null;
    }
  }

  /**
   * Save producer schemas to cache
   */
  saveProducerSchemas(schemas: ProducerSchema[], files: string[]): void {
    const checksums: Record<string, FileChecksum> = {};
    
    for (const file of files) {
      const relPath = relative(this.project.rootDir, file);
      checksums[relPath] = this.computeChecksum(file);
    }

    const cache: ProducerCache = {
      metadata: {
        version: CACHE_VERSION,
        timestamp: new Date().toISOString(),
        checksums,
      },
      schemas,
    };

    writeFileSync(
      join(this.project.cachePath, PRODUCER_CACHE),
      JSON.stringify(cache, null, 2)
    );
  }

  // --------------------------------------------------------------------------
  // Consumer Cache
  // --------------------------------------------------------------------------

  /**
   * Get cached consumer usage if still valid
   */
  getConsumerUsage(files: string[]): ConsumerSchema[] | null {
    const cachePath = join(this.project.cachePath, CONSUMER_CACHE);
    
    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const cache: ConsumerCache = JSON.parse(readFileSync(cachePath, 'utf-8'));
      
      if (cache.metadata.version !== CACHE_VERSION) {
        return null;
      }

      for (const file of files) {
        const relPath = relative(this.project.rootDir, file);
        const cached = cache.metadata.checksums[relPath];
        
        if (!cached || !this.isFileValid(file, cached)) {
          return null;
        }
      }

      return cache.usage;
    } catch {
      return null;
    }
  }

  /**
   * Save consumer usage to cache
   */
  saveConsumerUsage(usage: ConsumerSchema[], files: string[]): void {
    const checksums: Record<string, FileChecksum> = {};
    
    for (const file of files) {
      const relPath = relative(this.project.rootDir, file);
      checksums[relPath] = this.computeChecksum(file);
    }

    const cache: ConsumerCache = {
      metadata: {
        version: CACHE_VERSION,
        timestamp: new Date().toISOString(),
        checksums,
      },
      usage,
    };

    writeFileSync(
      join(this.project.cachePath, CONSUMER_CACHE),
      JSON.stringify(cache, null, 2)
    );
  }

  // --------------------------------------------------------------------------
  // Incremental Updates
  // --------------------------------------------------------------------------

  /**
   * Check which files have changed since last cache
   */
  getChangedFiles(files: string[], side: 'producer' | 'consumer'): string[] {
    const cachePath = join(
      this.project.cachePath,
      side === 'producer' ? PRODUCER_CACHE : CONSUMER_CACHE
    );

    if (!existsSync(cachePath)) {
      return files; // All files are "changed" (no cache)
    }

    try {
      const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
      const changed: string[] = [];

      for (const file of files) {
        const relPath = relative(this.project.rootDir, file);
        const cached = cache.metadata?.checksums?.[relPath];

        if (!cached || !this.isFileValid(file, cached)) {
          changed.push(file);
        }
      }

      return changed;
    } catch {
      return files;
    }
  }

  /**
   * Invalidate cache for specific files
   */
  invalidateFiles(files: string[]): void {
    // For now, just delete the entire cache
    // Future: Could do incremental invalidation
    const producerPath = join(this.project.cachePath, PRODUCER_CACHE);
    const consumerPath = join(this.project.cachePath, CONSUMER_CACHE);

    // We could be smarter here and just remove the affected checksums
    // but full invalidation is safer for now
    if (existsSync(producerPath)) {
      const cache: ProducerCache = JSON.parse(readFileSync(producerPath, 'utf-8'));
      let invalidated = false;

      for (const file of files) {
        const relPath = relative(this.project.rootDir, file);
        if (cache.metadata.checksums[relPath]) {
          delete cache.metadata.checksums[relPath];
          invalidated = true;
        }
      }

      if (invalidated) {
        // Mark cache as partially invalid
        cache.metadata.timestamp = new Date().toISOString();
        writeFileSync(producerPath, JSON.stringify(cache, null, 2));
      }
    }

    // Same for consumer
    if (existsSync(consumerPath)) {
      const cache: ConsumerCache = JSON.parse(readFileSync(consumerPath, 'utf-8'));
      let invalidated = false;

      for (const file of files) {
        const relPath = relative(this.project.rootDir, file);
        if (cache.metadata.checksums[relPath]) {
          delete cache.metadata.checksums[relPath];
          invalidated = true;
        }
      }

      if (invalidated) {
        cache.metadata.timestamp = new Date().toISOString();
        writeFileSync(consumerPath, JSON.stringify(cache, null, 2));
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const producerPath = join(this.project.cachePath, PRODUCER_CACHE);
    const consumerPath = join(this.project.cachePath, CONSUMER_CACHE);

    if (existsSync(producerPath)) {
      writeFileSync(producerPath, JSON.stringify({ schemas: [], metadata: { checksums: {} } }));
    }
    if (existsSync(consumerPath)) {
      writeFileSync(consumerPath, JSON.stringify({ usage: [], metadata: { checksums: {} } }));
    }
  }

  // --------------------------------------------------------------------------
  // Checksum Utilities
  // --------------------------------------------------------------------------

  private computeChecksum(filePath: string): FileChecksum {
    const stat = statSync(filePath);
    const content = readFileSync(filePath);
    const hash = createHash('sha256').update(content).digest('hex');

    return {
      path: relative(this.project.rootDir, filePath),
      mtime: stat.mtimeMs,
      size: stat.size,
      hash,
    };
  }

  private isFileValid(filePath: string, cached: FileChecksum): boolean {
    if (!existsSync(filePath)) {
      return false;
    }

    const stat = statSync(filePath);

    // Quick check: mtime and size
    if (stat.mtimeMs !== cached.mtime || stat.size !== cached.size) {
      return false;
    }

    // If mtime/size match, trust the cache (avoid expensive hash)
    return true;
  }
}
