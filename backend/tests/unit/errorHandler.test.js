/**
 * Unit tests for the global error-handling middleware.
 *
 * Covers src/middleware/errorHandler.js
 *
 * errorHandler is a pure Express error middleware (err, req, res, next).
 * We feed it synthetic Error objects of each supported type and verify the
 * HTTP status + JSON body it produces.
 */
import { describe, test, expect, jest } from '@jest/globals';

import { errorHandler } from '../../src/middleware/errorHandler.js';

function makeReqRes() {
  const req = { method: 'GET', url: '/test', originalUrl: '/test' };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('errorHandler — Mongoose ValidationError', () => {
  test('returns 400 with a list of field error messages', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    err.errors = {
      email: { message: 'Email is required' },
      password: { message: 'Password too short' },
    };
    const { req, res, next } = makeReqRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Validation Error',
        errors: expect.arrayContaining(['Email is required', 'Password too short']),
      }),
    );
  });
});

describe('errorHandler — Mongoose duplicate key (code 11000)', () => {
  test('returns 400 with a "field already exists" message', () => {
    const err = new Error('Duplicate key');
    err.code = 11000;
    err.keyValue = { email: 'test@example.com' };
    const { req, res, next } = makeReqRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'email already exists',
      }),
    );
  });
});

describe('errorHandler — Mongoose CastError (invalid ObjectId)', () => {
  test('returns 400 with "Invalid ID format"', () => {
    const err = new Error('Cast to ObjectId failed');
    err.name = 'CastError';
    const { req, res, next } = makeReqRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Invalid ID format',
      }),
    );
  });
});

describe('errorHandler — JWT errors', () => {
  test('JsonWebTokenError → 401 "Invalid token"', () => {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';
    const { req, res, next } = makeReqRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid token' }),
    );
  });

  test('TokenExpiredError → 401 "Token expired"', () => {
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    const { req, res, next } = makeReqRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Token expired' }),
    );
  });
});

describe('errorHandler — generic errors', () => {
  test('returns err.statusCode if present (e.g. 503)', () => {
    const err = new Error('Service unavailable');
    err.statusCode = 503;
    const { req, res, next } = makeReqRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  test('defaults to 500 when no statusCode is set', () => {
    const err = new Error('Something went wrong');
    const { req, res, next } = makeReqRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Something went wrong',
      }),
    );
  });

  test('defaults message to "Internal Server Error" when err.message is empty', () => {
    const err = new Error('');
    const { req, res, next } = makeReqRes();
    errorHandler(err, req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal Server Error' }),
    );
  });

  test('includes a stack trace when NODE_ENV is "development"', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      const err = new Error('Dev error');
      err.stack = 'Error: Dev error\n    at test.js:1';
      const { req, res, next } = makeReqRes();
      errorHandler(err, req, res, next);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('stack');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  test('does NOT include a stack trace when NODE_ENV is "production"', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const err = new Error('Prod error');
      err.stack = 'Error: Prod error\n    at test.js:1';
      const { req, res, next } = makeReqRes();
      errorHandler(err, req, res, next);
      const body = res.json.mock.calls[0][0];
      expect(body).not.toHaveProperty('stack');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
