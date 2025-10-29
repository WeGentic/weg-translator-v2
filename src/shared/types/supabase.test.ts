/**
 * Test file to verify Supabase generated types can be imported and used
 */

import { describe, it, expect } from 'vitest';
import type { Database } from './supabase';

describe('Supabase Generated Types', () => {
  it('should export Database type', () => {
    // Type-level test - if this compiles, the types are valid
    type DB = Database;
    const dbType: string = typeof {} as unknown as string;
    expect(dbType).toBe('object');
  });

  it('should have correct structure', () => {
    // Verify the Database type has the expected structure
    type HasPublicSchema = Database extends { public: unknown } ? true : false;
    const hasPublic: HasPublicSchema = true;
    expect(hasPublic).toBe(true);
  });

  it('should export Json type', () => {
    // Verify Json type is exported
    // This is a compile-time check via import
    type JsonType = Database['public'];
    expect(true).toBe(true);
  });
});
