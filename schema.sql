-- D1 Database Schema for To Do API

DROP TABLE IF EXISTS todos;

CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_todos_completed ON todos(completed);

-- Insert sample data (optional)
INSERT INTO todos (title, completed) VALUES 
  ('Set up Cloudflare Workers', 1),
  ('Create GraphQL schema', 1),
  ('Deploy to production', 0);