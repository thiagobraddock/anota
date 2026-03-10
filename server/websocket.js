import { WebSocketServer } from "ws";
import pool from "./db.js";

// Store active rooms: slug -> { conns: Map<ws, userInfo>, saveTimeout }
const rooms = new Map();

const MSG_CONTENT = "content";
const MSG_PRESENCE = "presence";
const MSG_USERS = "users";
const MSG_CURSOR = "cursor";

/**
 * Get current collaborator count for a note
 */
export function getCollaboratorCount(slug) {
  const room = rooms.get(slug);
  return room ? room.conns.size : 0;
}

/**
 * Setup WebSocket server for real-time collaboration
 */
export function setupWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (!url.pathname.startsWith("/collaboration")) {
      socket.destroy();
      return;
    }

    // Extract slug: /collaboration/my-note -> my-note
    const pathParts = url.pathname.split("/").filter(Boolean);
    const slug = pathParts[1];

    if (!slug) {
      console.log("❌ WebSocket rejected: no slug");
      socket.destroy();
      return;
    }

    // Check if note exists and is open for collaboration
    try {
      const result = await pool.query(
        "SELECT access_mode FROM notes WHERE slug = $1",
        [slug],
      );

      if (result.rows.length > 0) {
        const note = result.rows[0];
        if (note.access_mode === "private") {
          console.log(`🔒 WebSocket rejected: note ${slug} is private`);
          socket.destroy();
          return;
        }
      }
    } catch (error) {
      console.error("Error checking note access:", error);
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, slug);
    });
  });

  wss.on("connection", async (conn, req, slug) => {
    console.log(`🔗 WebSocket connected: ${slug}`);

    // Get or create room
    let room = rooms.get(slug);
    if (!room) {
      room = {
        conns: new Map(), // ws -> { name, color, id }
        saveTimeout: null,
        content: null,
      };
      rooms.set(slug, room);

      // Load current content from database
      const result = await pool.query(
        "SELECT content FROM notes WHERE slug = $1",
        [slug],
      );
      if (result.rows.length > 0) {
        room.content = result.rows[0].content;
      }
    }

    // Generate user info
    const userId = Math.random().toString(36).substring(2, 8);
    const userInfo = {
      id: userId,
      name: `User ${userId}`,
      color: getRandomColor(),
    };
    room.conns.set(conn, userInfo);

    // Send current content to new connection
    if (room.content) {
      send(conn, { type: MSG_CONTENT, content: room.content, from: "server" });
    }

    // Broadcast updated users list
    broadcastUsers(room, slug);

    // Handle messages
    conn.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === MSG_CONTENT) {
          // Update room content
          room.content = msg.content;

          // Broadcast to all OTHER clients
          for (const [client, info] of room.conns) {
            if (client !== conn && client.readyState === 1) {
              send(client, { 
                type: MSG_CONTENT, 
                content: msg.content,
                from: userInfo.id 
              });
            }
          }

          // Schedule save to database
          scheduleSave(slug, room);
        } else if (msg.type === MSG_CURSOR) {
          // Update user's cursor position
          userInfo.cursor = msg.cursor;
          room.conns.set(conn, userInfo);

          // Broadcast cursor to all OTHER clients
          for (const [client] of room.conns) {
            if (client !== conn && client.readyState === 1) {
              send(client, {
                type: MSG_CURSOR,
                userId: userInfo.id,
                cursor: msg.cursor,
                color: userInfo.color,
                name: userInfo.name,
              });
            }
          }
        } else if (msg.type === MSG_PRESENCE) {
          // Update user info
          if (msg.name) userInfo.name = msg.name;
          if (msg.color) userInfo.color = msg.color;
          room.conns.set(conn, userInfo);
          broadcastUsers(room, slug);
        }
      } catch (err) {
        console.error(`Message error for ${slug}:`, err);
      }
    });

    // Handle disconnect
    conn.on("close", async () => {
      room.conns.delete(conn);
      console.log(`🔌 Disconnected from ${slug} (${room.conns.size} remaining)`);

      broadcastUsers(room, slug);

      // Save on disconnect
      if (room.content) {
        await saveContent(slug, room.content);
      }

      // Cleanup empty room
      if (room.conns.size === 0) {
        setTimeout(() => {
          if (room.conns.size === 0) {
            if (room.saveTimeout) clearTimeout(room.saveTimeout);
            rooms.delete(slug);
            console.log(`🧹 Room cleaned up: ${slug}`);
          }
        }, 5000);
      }
    });

    conn.on("error", (err) => {
      console.error(`WebSocket error for ${slug}:`, err);
    });
  });

  console.log("✅ WebSocket collaboration server ready");
  return wss;
}

function send(conn, data) {
  if (conn.readyState === 1) {
    conn.send(JSON.stringify(data));
  }
}

function broadcastUsers(room, slug) {
  const users = Array.from(room.conns.values());
  const msg = { type: MSG_USERS, users, count: users.length };
  
  console.log(`👥 Users in ${slug}: ${users.length}`);
  
  for (const [client] of room.conns) {
    send(client, msg);
  }
}

function scheduleSave(slug, room) {
  if (room.saveTimeout) clearTimeout(room.saveTimeout);
  
  room.saveTimeout = setTimeout(async () => {
    if (room.content) {
      await saveContent(slug, room.content);
    }
  }, 2000);
}

async function saveContent(slug, content) {
  try {
    await pool.query(
      `UPDATE notes SET content = $1, updated_at = NOW() WHERE slug = $2`,
      [JSON.stringify(content), slug],
    );
    console.log(`💾 Saved content for ${slug}`);
  } catch (error) {
    console.error(`Error saving content for ${slug}:`, error);
  }
}

function getRandomColor() {
  const colors = [
    '#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8',
    '#94FADB', '#B9F18D', '#C3E2C2', '#EAECCC', '#AFC8AD',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
