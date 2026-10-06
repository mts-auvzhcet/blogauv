const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL in your .env file to your Neon PostgreSQL connection string.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS posts (
      id BIGSERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title VARCHAR(180) NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Computer Science', 'Electronics', 'Mechanical')),
      author VARCHAR(100) NOT NULL DEFAULT 'AUV Blog',
      excerpt VARCHAR(240) NOT NULL,
      markdown TEXT NOT NULL,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS post_images (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
      image_data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS post_images_post_id_idx ON post_images (post_id);
    CREATE INDEX IF NOT EXISTS posts_public_feed_idx ON posts (created_at DESC) WHERE published = TRUE;
  `);
}

module.exports = { pool, initializeDatabase };
