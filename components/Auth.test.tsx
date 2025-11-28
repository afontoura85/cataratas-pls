
// This is a test file and assumes a testing environment like Vitest or Jest is available.
// To run this, you would need to set up a test runner in your project.

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getFirebaseErrorMessage } from './Auth';

describe('getFirebaseErrorMessage', () => {

  it('should return the correct message for auth/invalid-email', () => {
    const error = { code: 'auth/invalid-email', message: 'Invalid email' };
    const expectedMessage = 'O formato do e-mail é inválido.';
    expect(getFirebaseErrorMessage(error)).toBe(expectedMessage);
  });

  it('should return the correct message for auth/user-not-found', () => {
    const error = { code: 'auth/user-not-found', message: 'User not found' };
    const expectedMessage = 'E-mail ou senha incorretos.';
    expect(getFirebaseErrorMessage(error)).toBe(expectedMessage);
  });

  it('should return the correct message for auth/wrong-password', () => {
    const error = { code: 'auth/wrong-password', message: 'Wrong password' };
    const expectedMessage = 'E-mail ou senha incorretos.';
    expect(getFirebaseErrorMessage(error)).toBe(expectedMessage);
  });
  
  it('should return a generic message for an unknown Firebase error code', () => {
    const error = { code: 'auth/some-new-unhandled-error', message: 'Something new happened' };
    const expectedMessage = 'Ocorreu um erro (auth/some-new-unhandled-error). Tente novamente.';
    expect(getFirebaseErrorMessage(error)).toBe(expectedMessage);
  });

  it('should return the message from a standard Error object if no code is present', () => {
    const error = new Error('A standard network error');
    const expectedMessage = 'A standard network error';
    expect(getFirebaseErrorMessage(error)).toBe(expectedMessage);
  });

  it('should return a generic unknown error message for non-error objects', () => {
    const error = { someOtherProperty: 'value' };
    const expectedMessage = 'Ocorreu um erro desconhecido.';
    expect(getFirebaseErrorMessage(error)).toBe(expectedMessage);
  });

  it('should handle null and undefined inputs gracefully', () => {
    const expectedMessage = 'Ocorreu um erro desconhecido.';
    expect(getFirebaseErrorMessage(null)).toBe(expectedMessage);
    expect(getFirebaseErrorMessage(undefined)).toBe(expectedMessage);
  });
});
