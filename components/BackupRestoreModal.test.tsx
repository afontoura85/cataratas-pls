// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isValidProjectArray } from './BackupRestoreModal';

// Mock project data for testing. Only includes properties checked by the function.
const validProject1 = {
    id: 'proj_1',
    name: 'Test Project 1',
    created_at: new Date().toISOString(),
    cost_of_works: 100000,
};

const validProject2 = {
    id: 'proj_2',
    name: 'Test Project 2',
    created_at: new Date().toISOString(),
    cost_of_works: 250000,
};

describe('isValidProjectArray', () => {

  it('should return true for a valid array with one project', () => {
    const data = [validProject1];
    expect(isValidProjectArray(data)).toBe(true);
  });

  it('should return true for a valid array with multiple projects', () => {
    const data = [validProject1, validProject2];
    expect(isValidProjectArray(data)).toBe(true);
  });

  it('should return true for an empty array', () => {
    const data: any[] = [];
    expect(isValidProjectArray(data)).toBe(true);
  });

  it('should return false for non-array data types', () => {
    expect(isValidProjectArray(null)).toBe(false);
    expect(isValidProjectArray(undefined)).toBe(false);
    expect(isValidProjectArray({})).toBe(false);
    expect(isValidProjectArray("not an array")).toBe(false);
    expect(isValidProjectArray(123)).toBe(false);
  });

  it('should return false for an array containing non-object items', () => {
    const data = [validProject1, "a string", null, 123];
    expect(isValidProjectArray(data)).toBe(false);
  });

  it('should return false if a project is missing the "id" property', () => {
    const { id, ...invalidProject } = validProject1;
    const data = [invalidProject];
    expect(isValidProjectArray(data)).toBe(false);
  });

  it('should return false if a project is missing the "name" property', () => {
    const { name, ...invalidProject } = validProject1;
    const data = [invalidProject];
    expect(isValidProjectArray(data)).toBe(false);
  });
  
  it('should return false if a project is missing the "created_at" property', () => {
    const { created_at, ...invalidProject } = validProject1;
    const data = [invalidProject];
    expect(isValidProjectArray(data)).toBe(false);
  });
  
  it('should return false if a project is missing the "cost_of_works" property', () => {
    const { cost_of_works, ...invalidProject } = validProject1;
    const data = [invalidProject];
    expect(isValidProjectArray(data)).toBe(false);
  });

  it('should return false if "id" is not a string', () => {
    const invalidProject = { ...validProject1, id: 123 };
    const data = [invalidProject];
    expect(isValidProjectArray(data)).toBe(false);
  });

  it('should return false if "name" is not a string', () => {
    const invalidProject = { ...validProject1, name: null };
    const data = [invalidProject];
    expect(isValidProjectArray(data)).toBe(false);
  });
  
  it('should return false if "created_at" is not a string', () => {
    const invalidProject = { ...validProject1, created_at: new Date() }; // Date object, not string
    const data = [invalidProject];
    expect(isValidProjectArray(data)).toBe(false);
  });

  it('should return false if "cost_of_works" is not a number', () => {
    const invalidProject = { ...validProject1, cost_of_works: "100000" };
    const data = [invalidProject];
    expect(isValidProjectArray(data)).toBe(false);
  });
  
  it('should return false if any project in the array is invalid', () => {
    const invalidProject = { ...validProject2, name: 12345 };
    const data = [validProject1, invalidProject];
    expect(isValidProjectArray(data)).toBe(false);
  });
  
});