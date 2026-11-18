CREATE TABLE IF NOT EXISTS search_sessions (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50),
  query_type VARCHAR(20),
  query_value VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sna_nodes (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES search_sessions(id) ON DELETE CASCADE,
  external_id VARCHAR(100),
  node_type VARCHAR(20),
  label VARCHAR(150),
  metadata JSONB DEFAULT '{}'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sna_edges (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES search_sessions(id) ON DELETE CASCADE,
  source_node_id INT REFERENCES sna_nodes(id) ON DELETE CASCADE,
  target_node_id INT REFERENCES sna_nodes(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50),
  weight FLOAT DEFAULT 1.0
);
