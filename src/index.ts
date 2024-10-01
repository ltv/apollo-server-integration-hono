import {
  HeaderMap,
  type ApolloServer,
  type BaseContext,
  type ContextFunction,
  type HTTPGraphQLRequest,
} from '@apollo/server';
import type { WithRequired } from '@apollo/utils.withrequired';
import type { Context, Env, Input, MiddlewareHandler } from 'hono';
import { stream } from 'hono/streaming';
import type { StatusCode } from 'hono/utils/http-status';

import type { GraphQLError, GraphQLFormattedError } from 'graphql';
import { parseBody } from './parse-body';

export interface HonoContextFunctionArgument<
  E extends Env = any,
  P extends string = any,
  I extends Input = {},
> {
  c: Context<E, P, I>;
}

interface HonoMiddlewareOptions<TContext extends BaseContext> {
  context?: ContextFunction<[HonoContextFunctionArgument], TContext>;
}

export function honoMiddleware(
  server: ApolloServer<BaseContext>,
  options?: HonoMiddlewareOptions<BaseContext>,
): MiddlewareHandler;
export function honoMiddleware<TContext extends BaseContext>(
  server: ApolloServer<TContext>,
  options: WithRequired<HonoMiddlewareOptions<TContext>, 'context'>,
): MiddlewareHandler;
export function honoMiddleware<TContext extends BaseContext>(
  server: ApolloServer<TContext>,
  options?: HonoMiddlewareOptions<TContext>,
): MiddlewareHandler {
  server.assertStarted('honoMiddleware()');

  const defaultContext: ContextFunction<
    [HonoContextFunctionArgument],
    any
  > = async () => ({});

  const context: ContextFunction<[HonoContextFunctionArgument], TContext> =
    options?.context ?? defaultContext;

  return async (c) => {
    const { req } = c;
    // GraphQL / Apollo only support GET and POST
    if (req.method !== 'GET' && req.method !== 'POST') {
      return c.json(
        errorMessages(['GraphQL only supports GET and POST requests.']),
        405,
        {
          Allow: 'GET, POST',
        },
      );
    }

    const body = await parseBody(req.raw);

    if (!body) {
      c.status(500);
      return c.body(
        '`req.body` is not set; this probably means you forgot to set up the ' +
          '`json` middleware before the Apollo Server middleware.',
      );
    }

    // Convert Hono headers to Apollo Server HeaderMap
    const headers = new HeaderMap();
    for (const [key, value] of Object.entries(req.header())) {
      if (value !== undefined && value !== null) {
        headers.set(
          key,
          Array.isArray(value) ? value.join(', ') : String(value),
        );
      }
    }

    const httpGraphQLRequest: HTTPGraphQLRequest = {
      method: req.method.toUpperCase(),
      headers,
      search: new URL(req.url).search,
      body,
    };

    return server
      .executeHTTPGraphQLRequest({
        httpGraphQLRequest,
        context: () => context({ c }),
      })
      .then(async (res) => {
        const { status, headers, body: resBody } = res;
        c.status((status as StatusCode) ?? 200);

        for (const [key, value] of headers) {
          c.header(key, value);
        }

        if (resBody.kind === 'complete') {
          return c.body(resBody.string);
        }

        if (resBody.kind === 'chunked') {
          c.header('Content-Type', 'application/json');
          c.header('Transfer-Encoding', 'chunked');
          return stream(c, async (stream) => {
            for await (const chunk of resBody.asyncIterator) {
              await stream.write(chunk);
            }
          });
        }

        return c.json(errorMessages(['Unknown response type']), 500);
      })
      .catch((error) => {
        console.error('Error in honoMiddleware:', error);

        return c.json(
          errorMessages(['Internal server error', error.message]),
          500,
        );
      });
  };
}

export const errorMessages = (
  messages: string[],
  graphqlErrors?: readonly GraphQLError[] | readonly GraphQLFormattedError[],
) => {
  if (graphqlErrors) {
    return { errors: graphqlErrors };
  }

  return { errors: messages.map((message) => ({ message })) };
};
