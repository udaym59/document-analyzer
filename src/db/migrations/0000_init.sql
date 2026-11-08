-- Enable pgvector before anything else.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE doc_status AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE msg_role AS ENUM ('user', 'assistant');

CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  mime_type varchar(120) NOT NULL,
  size_bytes bigint NOT NULL,
  storage_key text NOT NULL,
  status doc_status NOT NULL DEFAULT 'processing',
  error text,
  chunk_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX documents_user_idx ON documents (user_id, created_at DESC);

CREATE TABLE chunks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  idx integer NOT NULL,
  content text NOT NULL,
  tokens integer NOT NULL,
  embedding vector(768) NOT NULL
);
CREATE INDEX chunks_doc_idx ON chunks (document_id, idx);
-- Cosine distance HNSW index. Build after some data exists for best quality,
-- but creating it empty is fine; it will populate on INSERT.
CREATE INDEX chunks_embedding_idx ON chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  role msg_role NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX messages_doc_idx ON messages (document_id, created_at);
