import { ApolloServer, type BaseContext } from '@apollo/server';
import { Hono } from 'hono';
import { honoMiddleware } from '../src';
import { resolvers, typeDefs } from './schema';

interface MyContext extends BaseContext {
  token?: string | null;
}

const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
});

// Create a new Hono app
const app = new Hono();

await server.start();

// Apply the Apollo Server middleware to the Hono app
app.use('/graphql', honoMiddleware(server));

// Add a simple health check route
app.get('/health', (c) => c.text('OK'));

const port = 3000;

console.log(`🚀 Server ready at http://localhost:${port}/graphql`);

export default {
  port,
  fetch: app.fetch,
};
