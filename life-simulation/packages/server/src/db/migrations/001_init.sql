-- Logical model from DATABASE_SCHEMA.md, refined (see docs/IMPLEMENTATION_PLAN.md §8):
-- * Characters + BotProfiles + SessionParticipants → session_participants (one row per character).
-- * Events (versioned definitions) → content_versions (the whole validated bundle, keyed by its hash).
-- * SessionEvents, EventParticipants, Consequences, Relationships and CharacterHistory are all
--   derivable from the append-only domain log → session_logs (jsonb). Storing them again would
--   duplicate data; the log + content version + decisions are enough for deterministic replay.

CREATE TABLE users (
  id            uuid PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE player_profiles (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar           text NOT NULL DEFAULT 'default',
  games_played     integer NOT NULL DEFAULT 0,
  deaths           integer NOT NULL DEFAULT 0,
  total_life_score integer NOT NULL DEFAULT 0,
  reputation       integer NOT NULL DEFAULT 50,
  statistics       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_tokens (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens(user_id);

CREATE TABLE content_versions (
  hash       text PRIMARY KEY,
  bundle     jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id           uuid PRIMARY KEY,
  engine_id    text NOT NULL,
  seed         text NOT NULL,
  status       text NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  config       jsonb NOT NULL,
  content_hash text NOT NULL REFERENCES content_versions(hash),
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  end_reason   text
);
CREATE INDEX sessions_status_idx ON sessions(status);

CREATE TABLE session_participants (
  session_id    uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  character_key text NOT NULL,
  user_id       uuid REFERENCES users(id),
  name          text NOT NULL,
  career        text NOT NULL,
  is_bot        boolean NOT NULL,
  bot_profile   jsonb,
  final_status  text,
  PRIMARY KEY (session_id, character_key)
);
CREATE INDEX session_participants_user_idx ON session_participants(user_id);

-- Every decision exactly once per (event instance, character): enforced by the primary key.
CREATE TABLE decisions (
  session_id      uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  instance_id     text NOT NULL,
  character_key   text NOT NULL,
  choice_id       text NOT NULL,
  source          text NOT NULL CHECK (source IN ('player', 'default')),
  session_time_ms integer NOT NULL,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, instance_id, character_key)
);

CREATE TABLE session_results (
  session_id       uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  character_key    text NOT NULL,
  user_id          uuid REFERENCES users(id),
  final_status     text NOT NULL,
  outcomes         text[] NOT NULL,
  life_score       integer NOT NULL,
  life_duration_ms integer NOT NULL,
  recap            jsonb NOT NULL,
  PRIMARY KEY (session_id, character_key)
);
CREATE INDEX session_results_user_idx ON session_results(user_id);

CREATE TABLE session_logs (
  session_id uuid PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  log        jsonb NOT NULL
);
