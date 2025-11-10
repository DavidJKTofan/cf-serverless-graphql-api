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

// Database row type (as returned from D1)
interface TodoRow {
	id: number;
	title: string;
	completed: number;
	created_at: string;
}

// Input validation constants
const VALIDATION = {
	TITLE_MIN_LENGTH: 1,
	TITLE_MAX_LENGTH: 500,
	MAX_TODOS_QUERY: 1000,
} as const;

// Validation helper functions
function validateTitle(title: string): void {
	if (!title || typeof title !== 'string') {
		throw new Error('Title is required and must be a string');
	}

	const trimmed = title.trim();
	if (trimmed.length < VALIDATION.TITLE_MIN_LENGTH) {
		throw new Error(`Title must be at least ${VALIDATION.TITLE_MIN_LENGTH} character(s)`);
	}

	if (trimmed.length > VALIDATION.TITLE_MAX_LENGTH) {
		throw new Error(`Title must not exceed ${VALIDATION.TITLE_MAX_LENGTH} characters`);
	}
}

function validateId(id: number): void {
	if (!Number.isInteger(id) || id < 1) {
		throw new Error('ID must be a positive integer');
	}
}

function sanitizeTitle(title: string): string {
	return title.trim();
}

function mapTodoRow(row: TodoRow): Todo {
	return {
		id: row.id,
		title: row.title,
		completed: Boolean(row.completed),
		createdAt: row.created_at,
	};
}

// Structured logging helper
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
	const logEntry = {
		timestamp: new Date().toISOString(),
		level,
		message,
		...data,
	};
	console[level === 'error' ? 'error' : 'log'](JSON.stringify(logEntry));
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

// GraphQL resolvers with error handling and logging
const resolvers = {
	Query: {
		todos: async (_parent: unknown, _args: unknown, context: { db: D1Database }): Promise<Todo[]> => {
			const startTime = Date.now();

			try {
				log('info', 'Fetching all todos');

				const { results } = await context.db
					.prepare(`SELECT * FROM todos ORDER BY created_at DESC LIMIT ?`)
					.bind(VALIDATION.MAX_TODOS_QUERY)
					.all<TodoRow>();

				log('info', 'Fetched todos successfully', {
					count: results.length,
					durationMs: Date.now() - startTime,
				});

				return results.map(mapTodoRow);
			} catch (error) {
				log('error', 'Failed to fetch todos', {
					error: error instanceof Error ? error.message : String(error),
					durationMs: Date.now() - startTime,
				});
				throw new Error('Failed to fetch todos. Please try again later.');
			}
		},

		todo: async (_parent: unknown, args: { id: number }, context: { db: D1Database }): Promise<Todo | null> => {
			const startTime = Date.now();

			try {
				validateId(args.id);

				log('info', 'Fetching todo by ID', { id: args.id });

				const result = await context.db.prepare('SELECT * FROM todos WHERE id = ?').bind(args.id).first<TodoRow>();

				if (!result) {
					log('info', 'Todo not found', {
						id: args.id,
						durationMs: Date.now() - startTime,
					});
					return null;
				}

				log('info', 'Fetched todo successfully', {
					id: args.id,
					durationMs: Date.now() - startTime,
				});

				return mapTodoRow(result);
			} catch (error) {
				log('error', 'Failed to fetch todo', {
					id: args.id,
					error: error instanceof Error ? error.message : String(error),
					durationMs: Date.now() - startTime,
				});

				// Re-throw validation errors
				if (error instanceof Error && error.message.includes('must be')) {
					throw error;
				}

				throw new Error('Failed to fetch todo. Please try again later.');
			}
		},
	},

	Mutation: {
		createTodo: async (_parent: unknown, args: { title: string }, context: { db: D1Database }): Promise<Todo> => {
			const startTime = Date.now();

			try {
				validateTitle(args.title);
				const sanitizedTitle = sanitizeTitle(args.title);

				log('info', 'Creating new todo', { titleLength: sanitizedTitle.length });

				const result = await context.db.prepare('INSERT INTO todos (title) VALUES (?) RETURNING *').bind(sanitizedTitle).first<TodoRow>();

				if (!result) {
					throw new Error('Database returned no result after insert');
				}

				log('info', 'Created todo successfully', {
					id: result.id,
					durationMs: Date.now() - startTime,
				});

				return mapTodoRow(result);
			} catch (error) {
				log('error', 'Failed to create todo', {
					error: error instanceof Error ? error.message : String(error),
					durationMs: Date.now() - startTime,
				});

				// Re-throw validation errors
				if (error instanceof Error && error.message.includes('must')) {
					throw error;
				}

				throw new Error('Failed to create todo. Please try again later.');
			}
		},

		updateTodo: async (
			_parent: unknown,
			args: { id: number; title?: string; completed?: boolean },
			context: { db: D1Database }
		): Promise<Todo | null> => {
			const startTime = Date.now();

			try {
				validateId(args.id);

				const updates: string[] = [];
				const params: (string | number)[] = [];

				if (args.title !== undefined) {
					validateTitle(args.title);
					const sanitizedTitle = sanitizeTitle(args.title);
					updates.push('title = ?');
					params.push(sanitizedTitle);
				}

				if (args.completed !== undefined) {
					if (typeof args.completed !== 'boolean') {
						throw new Error('Completed must be a boolean');
					}
					updates.push('completed = ?');
					params.push(args.completed ? 1 : 0);
				}

				if (updates.length === 0) {
					throw new Error('No fields to update. Provide at least title or completed.');
				}

				params.push(args.id);

				log('info', 'Updating todo', {
					id: args.id,
					fields: updates.length,
				});

				const result = await context.db
					.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ? RETURNING *`)
					.bind(...params)
					.first<TodoRow>();

				if (!result) {
					log('info', 'Todo not found for update', {
						id: args.id,
						durationMs: Date.now() - startTime,
					});
					return null;
				}

				log('info', 'Updated todo successfully', {
					id: args.id,
					durationMs: Date.now() - startTime,
				});

				return mapTodoRow(result);
			} catch (error) {
				log('error', 'Failed to update todo', {
					id: args.id,
					error: error instanceof Error ? error.message : String(error),
					durationMs: Date.now() - startTime,
				});

				// Re-throw validation errors
				if (error instanceof Error && error.message.includes('must')) {
					throw error;
				}

				throw new Error('Failed to update todo. Please try again later.');
			}
		},

		deleteTodo: async (_parent: unknown, args: { id: number }, context: { db: D1Database }): Promise<boolean> => {
			const startTime = Date.now();

			try {
				validateId(args.id);

				log('info', 'Deleting todo', { id: args.id });

				const result = await context.db.prepare('DELETE FROM todos WHERE id = ? RETURNING id').bind(args.id).first();

				const deleted = result !== null;

				log('info', deleted ? 'Deleted todo successfully' : 'Todo not found for deletion', {
					id: args.id,
					deleted,
					durationMs: Date.now() - startTime,
				});

				return deleted;
			} catch (error) {
				log('error', 'Failed to delete todo', {
					id: args.id,
					error: error instanceof Error ? error.message : String(error),
					durationMs: Date.now() - startTime,
				});

				// Re-throw validation errors
				if (error instanceof Error && error.message.includes('must be')) {
					throw error;
				}

				throw new Error('Failed to delete todo. Please try again later.');
			}
		},
	},
};

// Create executable schema
const schema = createSchema({
	typeDefs,
	resolvers,
});

// CORS headers for security
const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*', // Update with specific origin in production
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Access-Control-Max-Age': '86400',
};

// Cloudflare Workers fetch handler
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const startTime = Date.now();
		const requestId = crypto.randomUUID();

		try {
			// Log incoming request
			log('info', 'Incoming request', {
				requestId,
				method: request.method,
				url: request.url,
				userAgent: request.headers.get('user-agent'),
			});

			// Handle CORS preflight
			if (request.method === 'OPTIONS') {
				return new Response(null, {
					status: 204,
					headers: CORS_HEADERS,
				});
			}

			// Validate database binding
			if (!env.DB) {
				log('error', 'Database binding not found', { requestId });
				return new Response(JSON.stringify({ error: 'Service temporarily unavailable' }), {
					status: 503,
					headers: {
						'Content-Type': 'application/json',
						...CORS_HEADERS,
					},
				});
			}

			// Create GraphQL Yoga instance with context
			const yoga = createYoga({
				schema: schema as any,
				graphqlEndpoint: '/graphql',
				landingPage: true,
				context: {
					db: env.DB,
					requestId,
				},
				// Disable introspection in production for security
				// maskedErrors: true, // Uncomment for production to hide error details
			});

			const response = await yoga.fetch(request, {}, ctx);

			// Add CORS headers to response
			const corsResponse = new Response(response.body, response);
			Object.entries(CORS_HEADERS).forEach(([key, value]) => {
				corsResponse.headers.set(key, value);
			});

			// Add security headers
			corsResponse.headers.set('X-Content-Type-Options', 'nosniff');
			corsResponse.headers.set('X-Frame-Options', 'DENY');
			corsResponse.headers.set('X-XSS-Protection', '1; mode=block');
			corsResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

			log('info', 'Request completed', {
				requestId,
				status: corsResponse.status,
				durationMs: Date.now() - startTime,
			});

			return corsResponse;
		} catch (error) {
			log('error', 'Unhandled error in fetch handler', {
				requestId,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				durationMs: Date.now() - startTime,
			});

			return new Response(
				JSON.stringify({
					error: 'Internal server error',
					requestId,
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						...CORS_HEADERS,
					},
				}
			);
		}
	},
};
