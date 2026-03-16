import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "y-prosemirror";
import pool from "./db.js";
import {
  collaborationSchema,
  normalizeNoteContent,
} from "./collaborationSchema.js";

const rooms = new Map();
const roomPromises = new Map();

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const WS_READY_STATE_CONNECTING = 0;
const WS_READY_STATE_OPEN = 1;
const SAVE_DEBOUNCE_MS = 1500;
const CLEANUP_DELAY_MS = 5000;
const PING_TIMEOUT_MS = 30000;

export function getCollaboratorCount(slug) {
  return rooms.get(slug)?.conns.size || 0;
}

export function getLiveNoteContent(slug) {
  const room = rooms.get(slug);

  if (!room) {
    return null;
  }

  return getSnapshot(room.doc);
}

export async function persistLiveNoteContent(slug) {
  const room = rooms.get(slug);

  if (!room) {
    return false;
  }

  await persistRoom(room);
  return true;
}

export function closeCollaborationRoom(slug, code = 1008, reason = "Note unavailable") {
  const room = rooms.get(slug);

  if (!room) {
    return false;
  }

  const connections = Array.from(room.conns.keys());
  connections.forEach((conn) => {
    try {
      conn.close(code, reason);
    } catch {
      closeConnection(room, conn);
    }
  });

  return true;
}

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (!url.pathname.startsWith("/collaboration/")) {
        socket.destroy();
        return;
      }

      const pathParts = url.pathname.split("/").filter(Boolean);
      const slug = pathParts[1];

      if (!slug) {
        socket.destroy();
        return;
      }

      const result = await pool.query(
        "SELECT access_mode FROM notes WHERE slug = $1",
        [slug],
      );

      if (result.rows.length > 0 && result.rows[0].access_mode === "private") {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (conn) => {
        wss.emit("connection", conn, req, slug);
      });
    } catch (error) {
      console.error("WebSocket upgrade error:", error);
      socket.destroy();
    }
  });

  wss.on("connection", async (conn, req, slug) => {
    try {
      const room = await getOrCreateRoom(slug);
      setupConnection(conn, req, room);
    } catch (error) {
      console.error(`WebSocket connection error for ${slug}:`, error);
      conn.close();
    }
  });

  console.log("✅ WebSocket collaboration server ready");
  return wss;
}

async function getOrCreateRoom(slug) {
  const existingRoom = rooms.get(slug);

  if (existingRoom) {
    if (existingRoom.cleanupTimeout) {
      clearTimeout(existingRoom.cleanupTimeout);
      existingRoom.cleanupTimeout = null;
    }

    return existingRoom;
  }

  const pendingRoom = roomPromises.get(slug);

  if (pendingRoom) {
    return pendingRoom;
  }

  const roomPromise = createRoom(slug)
    .then((room) => {
      rooms.set(slug, room);
      roomPromises.delete(slug);
      return room;
    })
    .catch((error) => {
      roomPromises.delete(slug);
      throw error;
    });

  roomPromises.set(slug, roomPromise);
  return roomPromise;
}

async function createRoom(slug) {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null);

  const room = {
    slug,
    doc,
    awareness,
    conns: new Map(),
    saveTimeout: null,
    cleanupTimeout: null,
  };

  awareness.on("update", ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated, removed);

    if (origin !== null) {
      const controlledIds = room.conns.get(origin);

      if (controlledIds) {
        added.forEach((clientId) => controlledIds.add(clientId));
        removed.forEach((clientId) => controlledIds.delete(clientId));
      }
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients),
    );

    const payload = encoding.toUint8Array(encoder);
    room.conns.forEach((_, conn) => send(room, conn, payload));
  });

  doc.on("update", (update) => {
    schedulePersist(room);

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);

    const payload = encoding.toUint8Array(encoder);
    room.conns.forEach((_, conn) => send(room, conn, payload));
  });

  await loadRoomContent(room);
  return room;
}

async function loadRoomContent(room) {
  const result = await pool.query(
    "SELECT content FROM notes WHERE slug = $1",
    [room.slug],
  );

  const content = normalizeNoteContent(result.rows[0]?.content);
  const seededDoc = prosemirrorJSONToYDoc(collaborationSchema, content);

  Y.applyUpdate(room.doc, Y.encodeStateAsUpdate(seededDoc));
  seededDoc.destroy();
}

function setupConnection(conn, _req, room) {
  conn.binaryType = "arraybuffer";
  room.conns.set(conn, new Set());

  conn.on("message", (message) => {
    handleMessage(conn, room, new Uint8Array(message));
  });

  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      closeConnection(room, conn);
      clearInterval(pingInterval);
      return;
    }

    if (!room.conns.has(conn)) {
      clearInterval(pingInterval);
      return;
    }

    pongReceived = false;

    try {
      conn.ping();
    } catch {
      closeConnection(room, conn);
      clearInterval(pingInterval);
    }
  }, PING_TIMEOUT_MS);

  conn.on("pong", () => {
    pongReceived = true;
  });

  conn.on("close", () => {
    closeConnection(room, conn);
    clearInterval(pingInterval);
  });

  conn.on("error", (error) => {
    console.error(`WebSocket error for ${room.slug}:`, error);
  });

  const syncEncoder = encoding.createEncoder();
  encoding.writeVarUint(syncEncoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(syncEncoder, room.doc);
  send(room, conn, encoding.toUint8Array(syncEncoder));

  const awarenessStates = room.awareness.getStates();

  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        Array.from(awarenessStates.keys()),
      ),
    );
    send(room, conn, encoding.toUint8Array(awarenessEncoder));
  }
}

function handleMessage(conn, room, message) {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC:
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, room.doc, conn);

        if (encoding.length(encoder) > 1) {
          send(room, conn, encoding.toUint8Array(encoder));
        }
        break;
      case MESSAGE_AWARENESS:
        awarenessProtocol.applyAwarenessUpdate(
          room.awareness,
          decoding.readVarUint8Array(decoder),
          conn,
        );
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`WebSocket message error for ${room.slug}:`, error);
  }
}

function schedulePersist(room) {
  if (room.saveTimeout) {
    clearTimeout(room.saveTimeout);
  }

  room.saveTimeout = setTimeout(() => {
    room.saveTimeout = null;
    persistRoom(room).catch((error) => {
      console.error(`Error saving room ${room.slug}:`, error);
    });
  }, SAVE_DEBOUNCE_MS);
}

async function persistRoom(room) {
  if (room.saveTimeout) {
    clearTimeout(room.saveTimeout);
    room.saveTimeout = null;
  }

  const content = getSnapshot(room.doc);

  await pool.query(
    `UPDATE notes
     SET content = $1, updated_at = NOW(), last_accessed_at = NOW()
     WHERE slug = $2`,
    [JSON.stringify(content), room.slug],
  );
}

function getSnapshot(doc) {
  const content = yDocToProsemirrorJSON(doc);
  return normalizeNoteContent(content);
}

function closeConnection(room, conn) {
  if (!room.conns.has(conn)) {
    return;
  }

  const controlledIds = room.conns.get(conn) || new Set();
  room.conns.delete(conn);

  awarenessProtocol.removeAwarenessStates(
    room.awareness,
    Array.from(controlledIds),
    null,
  );

  if (room.conns.size > 0) {
    return;
  }

  if (room.cleanupTimeout) {
    clearTimeout(room.cleanupTimeout);
  }

  room.cleanupTimeout = setTimeout(async () => {
    if (room.conns.size > 0) {
      return;
    }

    try {
      await persistRoom(room);
    } catch (error) {
      console.error(`Error during room cleanup for ${room.slug}:`, error);
    } finally {
      rooms.delete(room.slug);
      room.awareness.destroy();
      room.doc.destroy();
      console.log(`🧹 Room cleaned up: ${room.slug}`);
    }
  }, CLEANUP_DELAY_MS);
}

function send(room, conn, payload) {
  if (
    conn.readyState !== WS_READY_STATE_CONNECTING &&
    conn.readyState !== WS_READY_STATE_OPEN
  ) {
    closeConnection(room, conn);
    return;
  }

  try {
    conn.send(payload, {}, (error) => {
      if (error) {
        closeConnection(room, conn);
      }
    });
  } catch {
    closeConnection(room, conn);
  }
}
