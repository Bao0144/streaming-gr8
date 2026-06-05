import path from "path";
import sqlite3 from "sqlite3";

const DB_PATH = path.join(process.cwd(), "data", "streams.db");
const DEMO_USERS = [
  { username: "admin", password: "admin123", displayName: "Admin" },
  { username: "creator1", password: "creator123", displayName: "Creator One" },
  { username: "creator2", password: "creator456", displayName: "Creator Two" }
];

let dbInstance;
let initPromise;

function getDb() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(DB_PATH);
  }

  return dbInstance;
}

function runStatement(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function getRow(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

function getAllRows(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    password: row.password,
    displayName: row.display_name
  };
}

function mapStream(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    streamKey: row.stream_key,
    watchSlug: row.watch_slug,
    status: row.status,
    recordEnabled: Boolean(row.record_enabled),
    restreamYoutube: row.restream_youtube,
    restreamFacebook: row.restream_facebook,
    createdAt: row.created_at,
    ownerUsername: row.owner_username || "",
    ownerDisplayName: row.owner_display_name || ""
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function buildUniqueWatchSlug(db, title, excludeStreamId = null) {
  const baseSlug = slugify(title) || "stream";
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await getRow(
      db,
      `
        SELECT id
        FROM streams
        WHERE watch_slug = ?
          AND (? IS NULL OR id != ?)
      `,
      [candidate, excludeStreamId, excludeStreamId]
    );

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export function initDb() {
  if (initPromise) {
    return initPromise;
  }

  const db = getDb();

  initPromise = (async () => {
    await runStatement(
      db,
      `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          display_name TEXT NOT NULL
        )
      `
    );

    await runStatement(
      db,
      `
        CREATE TABLE IF NOT EXISTS streams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          title TEXT NOT NULL,
          stream_key TEXT NOT NULL UNIQUE,
          watch_slug TEXT,
          status TEXT NOT NULL DEFAULT 'idle',
          record_enabled INTEGER NOT NULL DEFAULT 1,
          restream_youtube TEXT NOT NULL DEFAULT '',
          restream_facebook TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `
    );

    await runStatement(
      db,
      `
        CREATE TABLE IF NOT EXISTS social_likes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content_type TEXT NOT NULL,
          content_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(content_type, content_id, user_id)
        )
      `
    );

    await runStatement(
      db,
      `
        CREATE TABLE IF NOT EXISTS social_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content_type TEXT NOT NULL,
          content_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `
    );

    await runStatement(
      db,
      `
        CREATE TABLE IF NOT EXISTS vod_assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_name TEXT NOT NULL UNIQUE,
          output_name TEXT NOT NULL,
          title TEXT NOT NULL,
          owner_user_id INTEGER,
          source_type TEXT NOT NULL DEFAULT 'upload',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `
    );

    for (const statement of [
      "ALTER TABLE streams ADD COLUMN user_id INTEGER",
      "ALTER TABLE streams ADD COLUMN watch_slug TEXT",
      "ALTER TABLE streams ADD COLUMN record_enabled INTEGER NOT NULL DEFAULT 1",
      "ALTER TABLE streams ADD COLUMN restream_youtube TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE streams ADD COLUMN restream_facebook TEXT NOT NULL DEFAULT ''"
    ]) {
      try {
        await runStatement(db, statement);
      } catch (error) {
        if (!String(error.message || "").includes("duplicate column name")) {
          throw error;
        }
      }
    }

    for (const user of DEMO_USERS) {
      await runStatement(
        db,
        `
          INSERT OR IGNORE INTO users (username, password, display_name)
          VALUES (?, ?, ?)
        `,
        [user.username, user.password, user.displayName]
      );
    }

    const adminUser = await getRow(
      db,
      "SELECT id FROM users WHERE username = ?",
      ["admin"]
    );

    if (adminUser) {
      await runStatement(
        db,
        "UPDATE streams SET user_id = ? WHERE user_id IS NULL",
        [adminUser.id]
      );
    }

    const streamsWithoutSlug = await getAllRows(
      db,
      `
        SELECT id, title
        FROM streams
        WHERE watch_slug IS NULL OR TRIM(watch_slug) = ''
        ORDER BY id ASC
      `
    );

    for (const stream of streamsWithoutSlug) {
      const watchSlug = await buildUniqueWatchSlug(db, stream.title, stream.id);
      await runStatement(
        db,
        "UPDATE streams SET watch_slug = ? WHERE id = ?",
        [watchSlug, stream.id]
      );
    }

    await runStatement(
      db,
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_streams_watch_slug ON streams(watch_slug)"
    );
  })();

  return initPromise;
}

export async function listDemoUsers() {
  await initDb();
  const db = getDb();
  const rows = await getAllRows(
    db,
    `
      SELECT id, username, display_name
      FROM users
      ORDER BY id ASC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name
  }));
}

export async function getUserByUsername(username) {
  await initDb();
  const db = getDb();
  const row = await getRow(
    db,
    `
      SELECT id, username, password, display_name
      FROM users
      WHERE username = ?
    `,
    [username]
  );

  return mapUser(row);
}

export async function createStream({
  userId,
  title,
  streamKey,
  recordEnabled = true,
  restreamYoutube = "",
  restreamFacebook = ""
}) {
  await initDb();
  const db = getDb();
  const watchSlug = await buildUniqueWatchSlug(db, title);

  const result = await runStatement(
    db,
    `
      INSERT INTO streams (user_id, title, stream_key, watch_slug, status, record_enabled, restream_youtube, restream_facebook)
      VALUES (?, ?, ?, ?, 'idle', ?, ?, ?)
    `,
    [userId, title, streamKey, watchSlug, recordEnabled ? 1 : 0, restreamYoutube, restreamFacebook]
  );

  return {
    id: result.lastID,
    userId,
    title,
    streamKey,
    watchSlug,
    status: "idle",
    recordEnabled,
    restreamYoutube,
    restreamFacebook
  };
}

export async function getStreamByKey(streamKey) {
  await initDb();
  const db = getDb();
  const row = await getRow(
    db,
    `
      SELECT id, user_id, title, stream_key, status, record_enabled, restream_youtube, restream_facebook, created_at
             , watch_slug
      FROM streams
      WHERE stream_key = ?
    `,
    [streamKey]
  );

  return mapStream(row);
}

export async function getOwnedStreamByKey(userId, streamKey) {
  await initDb();
  const db = getDb();
  const row = await getRow(
    db,
    `
      SELECT id, user_id, title, stream_key, status, record_enabled, restream_youtube, restream_facebook, created_at
             , watch_slug
      FROM streams
      WHERE stream_key = ? AND user_id = ?
    `,
    [streamKey, userId]
  );

  return mapStream(row);
}

export async function getStreamByWatchSlug(watchSlug) {
  await initDb();
  const db = getDb();
  const row = await getRow(
    db,
    `
      SELECT
        s.id,
        s.user_id,
        s.title,
        s.stream_key,
        s.watch_slug,
        s.status,
        s.record_enabled,
        s.restream_youtube,
        s.restream_facebook,
        s.created_at,
        u.username AS owner_username,
        u.display_name AS owner_display_name
      FROM streams s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.watch_slug = ?
    `,
    [watchSlug]
  );

  return mapStream(row);
}

export async function updateStreamStatus(streamKey, status) {
  await initDb();
  const db = getDb();
  const result = await runStatement(
    db,
    "UPDATE streams SET status = ? WHERE stream_key = ?",
    [status, streamKey]
  );

  return {
    updated: result.changes > 0
  };
}

export async function updateOwnedStreamRestreamConfig(
  userId,
  streamKey,
  restreamYoutube = "",
  restreamFacebook = ""
) {
  await initDb();
  const db = getDb();

  await runStatement(
    db,
    `
      UPDATE streams
      SET restream_youtube = ?, restream_facebook = ?
      WHERE stream_key = ? AND user_id = ?
    `,
    [restreamYoutube, restreamFacebook, streamKey, userId]
  );

  return getOwnedStreamByKey(userId, streamKey);
}

export async function listStreams() {
  await initDb();
  const db = getDb();
  const rows = await getAllRows(
    db,
    `
      SELECT id, user_id, title, stream_key, status, record_enabled, restream_youtube, restream_facebook, created_at
             , watch_slug
      FROM streams
      ORDER BY datetime(created_at) DESC, id DESC
    `
  );

  return rows.map(mapStream);
}

export async function listStreamsByUser(userId) {
  await initDb();
  const db = getDb();
  const rows = await getAllRows(
    db,
    `
      SELECT id, user_id, title, stream_key, status, record_enabled, restream_youtube, restream_facebook, created_at
             , watch_slug
      FROM streams
      WHERE user_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
    `,
    [userId]
  );

  return rows.map(mapStream);
}

export async function listLiveStreams() {
  await initDb();
  const db = getDb();
  const rows = await getAllRows(
    db,
    `
      SELECT
        s.id,
        s.user_id,
        s.title,
        s.stream_key,
        s.watch_slug,
        s.status,
        s.record_enabled,
        s.restream_youtube,
        s.restream_facebook,
        s.created_at,
        u.username AS owner_username,
        u.display_name AS owner_display_name
      FROM streams s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.status = 'live'
      ORDER BY datetime(s.created_at) DESC, s.id DESC
    `
  );

  return rows.map(mapStream);
}

export async function deleteOwnedStreamByKey(userId, streamKey) {
  await initDb();
  const db = getDb();

  const result = await runStatement(
    db,
    "DELETE FROM streams WHERE stream_key = ? AND user_id = ?",
    [streamKey, userId]
  );

  return {
    deleted: result.changes > 0
  };
}

export async function getSocialState({ contentType, contentId, userId }) {
  await initDb();
  const db = getDb();

  const likeRow = await getRow(
    db,
    `
      SELECT COUNT(*) as like_count,
             SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as liked_by_me
      FROM social_likes
      WHERE content_type = ? AND content_id = ?
    `,
    [userId || 0, contentType, contentId]
  );

  const commentRows = await getAllRows(
    db,
    `
      SELECT c.id, c.body, c.created_at, u.username, u.display_name
      FROM social_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.content_type = ? AND c.content_id = ?
      ORDER BY datetime(c.created_at) DESC, c.id DESC
    `,
    [contentType, contentId]
  );

  return {
    likeCount: Number(likeRow?.like_count || 0),
    likedByMe: Number(likeRow?.liked_by_me || 0) > 0,
    comments: commentRows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      username: row.username,
      displayName: row.display_name
    }))
  };
}

export async function toggleSocialLike({ contentType, contentId, userId }) {
  await initDb();
  const db = getDb();
  const existing = await getRow(
    db,
    `
      SELECT id
      FROM social_likes
      WHERE content_type = ? AND content_id = ? AND user_id = ?
    `,
    [contentType, contentId, userId]
  );

  if (existing) {
    await runStatement(
      db,
      "DELETE FROM social_likes WHERE id = ?",
      [existing.id]
    );
  } else {
    await runStatement(
      db,
      `
        INSERT INTO social_likes (content_type, content_id, user_id)
        VALUES (?, ?, ?)
      `,
      [contentType, contentId, userId]
    );
  }

  return getSocialState({ contentType, contentId, userId });
}

export async function addSocialComment({ contentType, contentId, userId, body }) {
  await initDb();
  const db = getDb();
  await runStatement(
    db,
    `
      INSERT INTO social_comments (content_type, content_id, user_id, body)
      VALUES (?, ?, ?, ?)
    `,
    [contentType, contentId, userId, body]
  );

  return getSocialState({ contentType, contentId, userId });
}

export async function upsertVodAsset({
  fileName,
  outputName,
  title,
  ownerUserId = null,
  sourceType = "upload"
}) {
  await initDb();
  const db = getDb();
  await runStatement(
    db,
    `
      INSERT INTO vod_assets (file_name, output_name, title, owner_user_id, source_type)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(file_name) DO UPDATE SET
        output_name = excluded.output_name,
        title = excluded.title,
        owner_user_id = excluded.owner_user_id,
        source_type = excluded.source_type
    `,
    [fileName, outputName, title, ownerUserId, sourceType]
  );
}

export async function listVodAssetsMetadata() {
  await initDb();
  const db = getDb();
  const rows = await getAllRows(
    db,
    `
      SELECT
        v.file_name,
        v.output_name,
        v.title,
        v.owner_user_id,
        v.source_type,
        u.username,
        u.display_name
      FROM vod_assets v
      LEFT JOIN users u ON u.id = v.owner_user_id
    `
  );

  return rows.map((row) => ({
    fileName: row.file_name,
    outputName: row.output_name,
    title: row.title,
    ownerUserId: row.owner_user_id,
    sourceType: row.source_type,
    ownerUsername: row.username || "",
    ownerDisplayName: row.display_name || ""
  }));
}

export async function getVodAssetMetadataByFileName(fileName) {
  await initDb();
  const db = getDb();
  const row = await getRow(
    db,
    `
      SELECT
        v.file_name,
        v.output_name,
        v.title,
        v.owner_user_id,
        v.source_type,
        u.username,
        u.display_name
      FROM vod_assets v
      LEFT JOIN users u ON u.id = v.owner_user_id
      WHERE v.file_name = ?
    `,
    [fileName]
  );

  if (!row) {
    return null;
  }

  return {
    fileName: row.file_name,
    outputName: row.output_name,
    title: row.title,
    ownerUserId: row.owner_user_id,
    sourceType: row.source_type,
    ownerUsername: row.username || "",
    ownerDisplayName: row.display_name || ""
  };
}

export async function deleteVodAssetMetadata(fileName, contentId = "") {
  await initDb();
  const db = getDb();
  await runStatement(db, "DELETE FROM vod_assets WHERE file_name = ?", [fileName]);
  if (contentId) {
    await runStatement(db, "DELETE FROM social_likes WHERE content_type = 'vod' AND content_id = ?", [contentId]);
    await runStatement(db, "DELETE FROM social_comments WHERE content_type = 'vod' AND content_id = ?", [contentId]);
  }
}
