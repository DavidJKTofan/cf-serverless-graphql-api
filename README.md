# GraphQL To Do API - Cloudflare Workers + D1

A serverless GraphQL API for managing todos, built with Cloudflare Workers, D1 database, and GraphQL Yoga.

## Features

- ✅ Full CRUD operations for todos
- 🗄️ Persistent storage with Cloudflare D1 (SQLite)
- 🚀 Serverless deployment on Cloudflare's edge network
- 📝 Strong TypeScript typing
- 🎯 GraphQL with interactive playground

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

# Copy the database_id from output and update wrangler.jsonc
```

Update the `database_id` in `wrangler.jsonc` with the ID from the command output.

### 3. Initialize Database Schema

```bash
# For local development
npx wrangler d1 execute todo-db --local --file=./schema.sql

# For production
npx wrangler d1 execute todo-db --remote --file=./schema.sql
```

### 4. Development

```bash
# Start local development server with D1
npm run dev
```

Visit `http://localhost:8787/graphql` to access the GraphQL Playground.

### 5. Deploy

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

Your API will be available at `https://todo-api.<your-subdomain>.workers.dev/graphql`

## GraphQL Schema

### Queries

```graphql
# Get all todos
query {
	todos {
		id
		title
		completed
		createdAt
	}
}

# Get a specific todo
query {
	todo(id: 1) {
		id
		title
		completed
		createdAt
	}
}
```

### Mutations

```graphql
# Create a new todo
mutation {
	createTodo(title: "Buy groceries") {
		id
		title
		completed
		createdAt
	}
}

# Update a todo
mutation {
	updateTodo(id: 1, title: "Buy groceries and cook", completed: true) {
		id
		title
		completed
		createdAt
	}
}

# Delete a todo
mutation {
	deleteTodo(id: 1)
}
```

## Project Structure

```
.
├── src/
│   └── index.ts          # Main Worker entry point
├── schema.sql            # D1 database schema
├── wrangler.jsonc        # Cloudflare Workers configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## Environment Bindings

The D1 database is bound to the Worker as `DB` and is strongly typed in TypeScript.

## Local Development Tips

- Local D1 uses SQLite stored in `.wrangler/state/v3/d1/`
- Changes to local database persist between restarts
- Use `--remote` flag with wrangler d1 commands for production database

## Troubleshooting

**Database not found error:**

- Ensure you've created the D1 database and updated `wrangler.jsonc`
- Run the schema initialization commands

**Type errors:**

- Run `npm install` to ensure all dependencies are installed
- Check that `tsconfig.json` is properly configured

**CORS issues:**

- CORS is enabled by default in this implementation
- Modify headers in `src/index.ts` if needed

## Learn More

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [GraphQL Yoga Docs](https://the-guild.dev/graphql/yoga-server)

### Inspiration (third-party code)

- https://graphql.wtf/episodes/72-graphql-yoga-3-with-cloudflare-workers
- https://dev.to/fauna/building-an-edge-serverless-graphql-backend-with-cloudflare-workers-and-fauna-1bp0
- https://www.contentful.com/blog/graphql-and-serverless-where-cloud-computing-is-heading/
- https://github.com/cloudflare/workers-graphql-server
- https://blog.cloudflare.com/building-a-graphql-server-on-the-edge-with-cloudflare-workers/
- https://medium.com/@estebanrules/building-a-graphql-yoga-server-with-typescript-on-cloudflare-workers-with-cloudflare-kv-afa383b5f875

## License

MIT
