import { ApolloServer } from '@apollo/server';
import { describe, expect, it, mock } from 'bun:test';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { errorMessages, honoMiddleware } from '../index';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

describe('errorMessages', () => {
  it('should return formatted error messages', () => {
    const messages = ['Error 1', 'Error 2'];
    const result = errorMessages(messages);
    expect(result).toEqual({
      errors: [{ message: 'Error 1' }, { message: 'Error 2' }],
    });
  });

  it('should return GraphQL errors if provided', () => {
    const messages = ['Error 1'];
    const graphqlErrors = [{ message: 'GraphQL Error' }];
    const result = errorMessages(messages, graphqlErrors);
    expect(result).toEqual({
      errors: graphqlErrors,
    });
  });
});

describe('honoMiddleware', () => {
  it('should handle POST requests', async () => {
    const server = new ApolloServer({
      typeDefs: 'type Query {f: ID}',
      resolvers: {
        Query: {
          f: () => 'f',
        },
      },
    });

    await server.start();

    const app = new Hono();
    app.post('/graphql', honoMiddleware(server));

    const response = await app.request('/graphql', {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ query: 'query { f }' }),
    });

    expect(response.status).toBe(200);

    await server.stop();
  });

  it('should return 405 status for non-GET/POST requests', async () => {
    const mockServer = {
      assertStarted: mock(() => {}),
    } as unknown as ApolloServer<any>;

    const middleware = honoMiddleware(mockServer);

    const mockContext = {
      req: {
        method: 'PUT',
        header: () => ({}),
      },
      json: mock((data, status, headers) => ({ data, status, headers })),
      status: mock((code) => ({ code })),
    } as unknown as Context;

    const mockNext = mock(() => Promise.resolve());

    await middleware(mockContext, mockNext);

    expect(mockContext.json).toHaveBeenCalledWith(
      {
        errors: [
          {
            message: 'GraphQL only supports GET and POST requests.',
          },
        ],
      },
      405,
      {
        Allow: 'GET, POST',
      },
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle POST requests with JSON body', async () => {
    const server = new ApolloServer({
      typeDefs: 'type Query { echo(message: String!): String }',
      resolvers: {
        Query: {
          echo: (_, { message }) => message,
        },
      },
    });

    await server.start();

    const app = new Hono();
    app.post('/graphql', honoMiddleware(server));

    const response = await app.request('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'query($message: String!) { echo(message: $message) }',
        variables: { message: 'Hello, GraphQL!' },
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: { echo: 'Hello, GraphQL!' } });

    await server.stop();
  });
});

// Add more tests for the errorMessages function if needed
describe('errorMessages additional tests', () => {
  it('should handle empty input', () => {
    const result = errorMessages([]);
    expect(result).toEqual({ errors: [] });
  });

  it('should prioritize graphqlErrors when both inputs are provided', () => {
    const messages = ['Regular error'];
    const graphqlErrors = [{ message: 'GraphQL error' }];
    const result = errorMessages(messages, graphqlErrors);
    expect(result).toEqual({ errors: graphqlErrors });
  });
});
