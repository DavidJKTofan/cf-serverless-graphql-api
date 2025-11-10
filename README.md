# GraphQL To Do API - Cloudflare Workers + D1

A simple serverless GraphQL API for managing todos, built with Cloudflare Workers, D1 database, and GraphQL Yoga.

## Features

- ✅ Full CRUD operations for todos
- 🗄️ Persistent storage with Cloudflare D1 (SQLite)
- 🚀 Serverless deployment on Cloudflare's edge network
- 📝 Strong TypeScript typing with comprehensive validation
- 🎯 GraphQL with interactive playground
- 🔒 Security hardened with input validation ([D1 prepared statement methods](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)) and CORS
- 📊 Structured logging for observability
- 🛡️ Error handling

## Quick Start

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/DavidJKTofan/cf-serverless-graphql-api)

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

```bash
# Create the database
npx wrangler d1 create todo-db
```

Copy the `database_id` from the output and update it in `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "todo-db",
    "database_id": "your-database-id-here", // Replace this
    "remote": true
  }
]
```

### 3. Initialize Database Schema

```bash
# For local development
npx wrangler d1 execute todo-db --local --file=./schema.sql

# For production
npx wrangler d1 execute todo-db --remote --file=./schema.sql
```

The schema creates a `todos` table with automatic timestamps and indexes. See [schema.sql](schema.sql) for details.

### 4. Local Development

```bash
npm run dev
```

Visit `http://localhost:8787/graphql` to access the GraphQL Playground where you can test queries and mutations interactively.

### 5. Deploy to Production

```bash
npm run deploy
```

Your API will be available at `https://your-worker-name.your-subdomain.workers.dev/graphql`

## GraphQL API Reference

### Type Definitions

```graphql
type Todo {
	id: Int!
	title: String!
	completed: Boolean!
	createdAt: String!
}
```

### Queries

#### Get All Todos

```graphql
query GetAllTodos {
	todos {
		id
		title
		completed
		createdAt
	}
}
```

**Response Example:**

```json
{
	"data": {
		"todos": [
			{
				"id": 1,
				"title": "Deploy to production",
				"completed": false,
				"createdAt": "2025-11-10T10:30:00.000Z"
			},
			{
				"id": 2,
				"title": "Set up monitoring",
				"completed": true,
				"createdAt": "2025-11-09T15:20:00.000Z"
			}
		]
	}
}
```

#### Get Single Todo

```graphql
query GetTodo {
	todo(id: 1) {
		id
		title
		completed
		createdAt
	}
}
```

Returns `null` if todo doesn't exist.

### Mutations

#### Create a New Todo

```graphql
mutation CreateTodo {
	createTodo(title: "Buy groceries") {
		id
		title
		completed
		createdAt
	}
}
```

**Validation:**

- Title is required (1-500 characters)
- Whitespace is automatically trimmed
- New todos start with `completed: false`

#### Update a Todo

```graphql
# Update title only
mutation UpdateTitle {
	updateTodo(id: 1, title: "Buy groceries and cook dinner") {
		id
		title
		completed
		createdAt
	}
}

# Update completion status only
mutation MarkComplete {
	updateTodo(id: 1, completed: true) {
		id
		title
		completed
		createdAt
	}
}

# Update both fields
mutation UpdateBoth {
	updateTodo(id: 1, title: "Updated task", completed: true) {
		id
		title
		completed
		createdAt
	}
}
```

**Validation:**

- At least one field (title or completed) must be provided
- Returns `null` if todo doesn't exist

#### Delete a Todo

```graphql
mutation DeleteTodo {
	deleteTodo(id: 1)
}
```

Returns `true` if deleted successfully, `false` if todo doesn't exist.

## Error Handling

The API provides clear error messages for common issues:

**Invalid Input:**

```graphql
mutation {
	createTodo(title: "")
}
# Error: "Title must be at least 1 character(s)"
```

**Invalid ID:**

```graphql
query {
	todo(id: -1)
}
# Error: "ID must be a positive integer"
```

**Title Too Long:**

```graphql
mutation {
	createTodo(title: "Very long title exceeding 500 characters...")
}
# Error: "Title must not exceed 500 characters"
```

## Project Structure

```
.
├── src/
│   └── index.ts          # Main Worker with GraphQL resolvers
├── public/               # Static assets (optional)
├── schema.sql            # D1 database schema
├── wrangler.jsonc        # Cloudflare Workers configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## Security Features

### Built-in Protections

- **Input Validation**: Title length limits (1-500 chars), type checking
- **SQL Injection Prevention**: [Prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/) with parameter binding
- **Input Sanitization**: Automatic whitespace trimming
- **Security Headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`
- **CORS Configuration**: Configurable cross-origin access
- **Request Tracking**: Unique request IDs for audit trails

### API Shield GraphQL Protection

This API is protected by [Cloudflare API Shield](https://developers.cloudflare.com/api-shield/security/graphql-protection/) with the following limits:

- **Maximum Query Size**: 10 fields
- **Maximum Query Depth**: 2 levels

> _Based on GraphQL schema: Query Size Limit: 10-15 fields, Query Depth Limit: 2-3 levels._

Example Cloudflare WAF Custom Rules expression:

```
(http.request.uri.path eq "/graphql" and cf.api_gateway.graphql.query_size > 10 and cf.api_gateway.graphql.parsed_successfully) or (http.request.uri.path eq "/graphql" and cf.api_gateway.graphql.query_depth > 2 and cf.api_gateway.graphql.parsed_successfully)
```

These limits prevent malicious queries that could overload the database while allowing all legitimate operations.

#### Legitimate Query Examples

All standard operations work normally:

- ✅ **Safe** - Get all todos (size: 4, depth: 1)
- ✅ **Safe** - Get single todo (size: 4, depth: 1)
- ✅ **Safe** - Multiple queries (size: 8, depth: 1)
- ❌ **Blocked** - Queries exceeding 10 fields or depth > 2 (see [example queries here](API_SHIELD_DEMO.txt))

### Production Hardening

Before deploying to production, update `src/index.ts`:

1. **Restrict CORS origin** (line ~280):

   ```typescript
   const CORS_HEADERS = {
   	'Access-Control-Allow-Origin': 'https://yourdomain.com', // Change from '*'
   	// ...
   };
   ```

2. **Enable masked errors**:

   ```typescript
   const yoga = createYoga({
   	// ...
   	maskedErrors: true, // Uncomment this line
   });
   ```

3. **Add rate limiting and configure additional security rules**.

4. **Configure graphql-yoga properly**:
   ```typescript
   const yoga = createYoga({
   	schema,
   	graphqlEndpoint: '/graphql',
   	landingPage: false, // Disable in production
   	graphiql: false, // Disable GraphiQL
   	// Disable introspection in production
   	disableIntrospection: true,
   });
   ```

## Observability

### Structured Logging

All operations are logged in JSON format with:

- Timestamps
- Request IDs for tracing
- Operation durations
- Success/failure status
- Error details

View logs in real-time:

```bash
npx wrangler tail
```

### Log Examples

```json
{
	"timestamp": "2025-11-10T10:30:00.000Z",
	"level": "info",
	"message": "Created todo successfully",
	"id": 5,
	"durationMs": 45
}
```

### Monitoring with Cloudflare

- **Analytics**: View request volume and errors in Cloudflare Dashboard
- **Logpush**: Export logs to external services (S3, R2, etc.)
- **Workers Analytics Engine**: Custom metrics and analytics

### Testing Queries

Use the GraphQL Playground at `http://localhost:8787/graphql` or use curl:

```bash
# Query example
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ todos { id title } }"}'

# Mutation example
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createTodo(title: \"Test\") { id } }"}'
```

### Accessing Remote Database Locally

```bash
# Execute queries against production database
npx wrangler d1 execute todo-db --remote --command "SELECT * FROM todos"

# Run SQL file against production
npx wrangler d1 execute todo-db --remote --file=./migration.sql
```

## Learn More

### Documentation

- [Cloudflare Workers](https://developers.cloudflare.com/workers/) - Serverless platform
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - SQL database
- [GraphQL Yoga](https://www.npmjs.com/package/graphql-yoga) - GraphQL server
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) - Development tool
- [API Shield GraphQL malicious query protection](https://developers.cloudflare.com/api-shield/security/graphql-protection/) – Recommended API security feature

### Helpful Resources

- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/) - Free tier available
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)

### Community (third-party) Examples

- [GraphQL Yoga on Cloudflare Workers](https://graphql.wtf/episodes/72-graphql-yoga-3-with-cloudflare-workers)
- [Edge Serverless GraphQL](https://dev.to/fauna/building-an-edge-serverless-graphql-backend-with-cloudflare-workers-and-fauna-1bp0)
- [Building a GraphQL server on the edge with Cloudflare Workers](https://blog.cloudflare.com/building-a-graphql-server-on-the-edge-with-cloudflare-workers/)
- [Cloudflare GraphQL Server Examples](https://github.com/cloudflare/workers-graphql-server)
- [GraphQL and Serverless Architecture](https://www.contentful.com/blog/graphql-and-serverless-where-cloud-computing-is-heading/)
- [Building a GraphQL Yoga Server with TypeScript on Cloudflare Workers with Cloudflare KV](https://medium.com/@estebanrules/building-a-graphql-yoga-server-with-typescript-on-cloudflare-workers-with-cloudflare-kv-afa383b5f875)

---

# Disclaimer

This is a demonstration project showcasing Cloudflare Workers and D1 database capabilities with a minimal demonstration of security features and best practices. While it implements comprehensive security measures, additional considerations (authentication, authorization, advanced monitoring) should be evaluated based on your specific production requirements.

Educational and demonstration purposes only.
