-- Chat history tables for your own database (SQLite / D1).
-- Copy to functions/migrations/ with the next free number (e.g. 0003_chat.sql), then:
--   locally:  npx wrangler d1 migrations apply DB --local
--   on KUMODeck:  kumodeck functions db migrate DB            (development; add --env production when you ship)
-- Keep the column names and types as they are: chat.ts relies on them.
-- Times are Unix milliseconds (UTC).

-- One row per saved message. `channel` is the realtime channel name the message was sent in (e.g. 'lobby').
-- `client_id` is made by the game for each message: the same message sent twice (a retry) is saved once, and the
-- game uses it to show a message only once when it arrives both live and in the history.
-- `type` is the realtime message type ('chat' by default), so other kinds of messages can share the table later.
CREATE TABLE IF NOT EXISTS chat_messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  channel      TEXT    NOT NULL,
  type         TEXT    NOT NULL DEFAULT 'chat',
  player_id    TEXT    NOT NULL,
  display_name TEXT,
  body         TEXT    NOT NULL,
  client_id    TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE (player_id, client_id)
);
-- History of a channel, newest first, page by page ("before this id").
CREATE INDEX IF NOT EXISTS chat_messages_channel ON chat_messages (channel, id);
-- Per-player rate limits, and deleting one player's messages on request.
CREATE INDEX IF NOT EXISTS chat_messages_player ON chat_messages (player_id, created_at);
-- Scheduled clean-up of old rows (KEEP_DAYS in chat.ts).
CREATE INDEX IF NOT EXISTS chat_messages_created ON chat_messages (created_at);
