-- Example table for the functions-d1 Skill: one vote per user per poll.
-- Copy to functions/migrations/000N_polls.sql (the next free number). Apply locally:
--   npx wrangler d1 migrations apply DB --local
-- and on KUMODeck:  kumodeck functions db migrate DB   (add --env production for the live copy)
-- Never edit a migration that was already applied: add a new numbered file instead (ALTER TABLE … ADD COLUMN …).
CREATE TABLE IF NOT EXISTS poll_votes (
  poll       TEXT    NOT NULL,
  player_id  TEXT    NOT NULL,   -- the verified user id (KUMODeck calls users "players")
  choice     TEXT    NOT NULL,
  created_at INTEGER NOT NULL,   -- ms since 1970, set by the server
  PRIMARY KEY (poll, player_id)  -- the database itself refuses a second vote
);
CREATE INDEX IF NOT EXISTS poll_votes_count ON poll_votes (poll, choice);
