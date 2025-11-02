import { createYoga, createSchema } from 'graphql-yoga';

// Environment bindings interface
interface Env {
	DB: D1Database;
}

// TypeScript types for our domain
interface Todo {
	id: number;
	title: string;
	completed: boolean;
	createdAt: string;
}

// GraphQL schema definition
const typeDefs = /* GraphQL */ `
	type Todo {
		id: Int!
		title: String!
		completed: Boolean!
		createdAt: String!
	}

	type Query {
		todos: [Todo!]!
		todo(id: Int!): Todo
	}

	type Mutation {
		createTodo(title: String!): Todo!
		updateTodo(id: Int!, title: String, completed: Boolean): Todo
		deleteTodo(id: Int!): Boolean!
	}
`;

// GraphQL resolvers
const resolvers = {
	Query: {
		todos: async (_parent: unknown, _args: unknown, context: { db: D1Database }): Promise<Todo[]> => {
			const { results } = await context.db
				.prepare('SELECT * FROM todos ORDER BY created_at DESC')
				.all<{ id: number; title: string; completed: number; created_at: string }>();

			return results.map((row) => ({
				id: row.id,
				title: row.title,
				completed: Boolean(row.completed),
				createdAt: row.created_at,
			}));
		},

		todo: async (_parent: unknown, args: { id: number }, context: { db: D1Database }): Promise<Todo | null> => {
			const result = await context.db
				.prepare('SELECT * FROM todos WHERE id = ?')
				.bind(args.id)
				.first<{ id: number; title: string; completed: number; created_at: string }>();

			if (!result) return null;

			return {
				id: result.id,
				title: result.title,
				completed: Boolean(result.completed),
				createdAt: result.created_at,
			};
		},
	},

	Mutation: {
		createTodo: async (_parent: unknown, args: { title: string }, context: { db: D1Database }): Promise<Todo> => {
			const result = await context.db
				.prepare('INSERT INTO todos (title) VALUES (?) RETURNING *')
				.bind(args.title)
				.first<{ id: number; title: string; completed: number; created_at: string }>();

			if (!result) {
				throw new Error('Failed to create todo');
			}

			return {
				id: result.id,
				title: result.title,
				completed: Boolean(result.completed),
				createdAt: result.created_at,
			};
		},

		updateTodo: async (
			_parent: unknown,
			args: { id: number; title?: string; completed?: boolean },
			context: { db: D1Database }
		): Promise<Todo | null> => {
			const updates: string[] = [];
			const params: (string | number)[] = [];

			if (args.title !== undefined) {
				updates.push('title = ?');
				params.push(args.title);
			}

			if (args.completed !== undefined) {
				updates.push('completed = ?');
				params.push(args.completed ? 1 : 0);
			}

			if (updates.length === 0) {
				throw new Error('No fields to update');
			}

			params.push(args.id);

			const result = await context.db
				.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
				.bind(...params)
				.first<{ id: number; title: string; completed: number; created_at: string }>();

			if (!result) return null;

			return {
				id: result.id,
				title: result.title,
				completed: Boolean(result.completed),
				createdAt: result.created_at,
			};
		},

		deleteTodo: async (_parent: unknown, args: { id: number }, context: { db: D1Database }): Promise<boolean> => {
			const result = await context.db.prepare('DELETE FROM todos WHERE id = ? RETURNING id').bind(args.id).first();

			return result !== null;
		},
	},
};

// Create executable schema
const schema = createSchema({
	typeDefs,
	resolvers,
});

// Cloudflare Workers fetch handler
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Create GraphQL Yoga instance with context
		const yoga = createYoga({
			schema,
			graphqlEndpoint: '/graphql',
			landingPage: true,
			context: {
				db: env.DB,
			},
		});

		return yoga.fetch(request, {}, ctx);
	},
};
