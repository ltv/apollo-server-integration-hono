import { describe, it, expect, mock } from 'bun:test';
import { parseBody } from '../parse-body';

describe('parseBody', () => {
  it('should return an empty object for no content-type', async () => {
    const mockRequest = new Request('https://example.com');
    const result = await parseBody(mockRequest);
    expect(result).toEqual({});
  });

  it('should parse application/graphql content', async () => {
    const mockRequest = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/graphql' },
      body: 'query { hello }',
    });
    const result = await parseBody(mockRequest);
    expect(result).toEqual({ query: 'query { hello }' });
  });

  it('should parse application/json content', async () => {
    const mockRequest = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'query { hello }' }),
    });
    const result = await parseBody(mockRequest);
    expect(result).toEqual({ query: 'query { hello }' });
  });

  it('should throw an error for invalid JSON', async () => {
    const mockRequest = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'invalid json',
    });
    expect(parseBody(mockRequest)).rejects.toThrow(
      'POST body sent invalid JSON',
    );
  });

  it('should parse application/x-www-form-urlencoded content', async () => {
    const mockRequest = new Request('https://example.com', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'query=query+%7B+hello+%7D',
    });
    const result = await parseBody(mockRequest);
    expect(result).toEqual({ query: 'query { hello }' });
  });

  it('should return an empty object for unsupported content-type', async () => {
    const mockRequest = new Request('https://example.com', {
      headers: { 'content-type': 'text/plain' },
    });
    const result = await parseBody(mockRequest);
    expect(result).toEqual({});
  });
});
