import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import pool from './db.js'

const docs = new Map() // slug -> Y.Doc
const persistence = new Map() // slug -> timer

const messageSync = 0
const messageAwareness = 1

/**
 * Setup WebSocket server for Y.js collaboration
 */
export function setupWebSocket(server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/collaboration'
  })

  wss.on('connection', async (conn, req) => {
    // Extract slug from URL query params
    const url = new URL(req.url, `http://${req.headers.host}`)
    const slug = url.searchParams.get('slug')
    
    if (!slug) {
      conn.close()
      return
    }

    // Check note permissions before allowing connection
    try {
      const result = await pool.query(
        'SELECT access_mode, owner_id, creator_token FROM notes WHERE slug = $1',
        [slug]
      )

      // If note doesn't exist yet, allow connection (will be created)
      if (result.rows.length > 0) {
        const note = result.rows[0]
        
        // If note is private, verify ownership
        if (note.access_mode === 'private') {
          console.log(`🔒 Private note - collaboration disabled for: ${slug}`)
          conn.close()
          return
        }
      }
    } catch (error) {
      console.error('Error checking note permissions:', error)
      conn.close()
      return
    }

    console.log(`🔗 WebSocket connection for note: ${slug}`)

    // Get or create Y.Doc for this note
    let doc = docs.get(slug)
    if (!doc) {
      doc = new Y.Doc()
      docs.set(slug, doc)
      
      // Load existing content from database
      await loadNoteContent(slug, doc)
      
      // Setup periodic save
      setupPersistence(slug, doc)
    }

    // Setup connection
    setupConnection(conn, doc, slug)
  })

  console.log('✅ WebSocket server ready on /collaboration')
  return wss
}

/**
 * Setup Y.js connection for a WebSocket
 */
function setupConnection(conn, doc, slug) {
  const awareness = new awarenessProtocol.Awareness(doc)
  
  // Send sync step 1
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, doc)
  conn.send(encoding.toUint8Array(encoder))

  // Send current awareness state
  if (awareness.getStates().size > 0) {
    const awarenessEncoder = encoding.createEncoder()
    encoding.writeVarUint(awarenessEncoder, messageAwareness)
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awareness.getStates().keys()))
    )
    conn.send(encoding.toUint8Array(awarenessEncoder))
  }

  // Handle incoming messages
  conn.on('message', (message) => {
    const uint8Array = new Uint8Array(message)
    const decoder = decoding.createDecoder(uint8Array)
    const messageType = decoding.readVarUint(decoder)

    if (messageType === messageSync) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageSync)
      const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, conn)
      if (encoding.length(encoder) > 1) {
        conn.send(encoding.toUint8Array(encoder))
      }
    } else if (messageType === messageAwareness) {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        conn
      )
    }
  })

  // Broadcast awareness and updates
  const updateHandler = (update, origin) => {
    if (origin !== conn) {
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.writeUpdate(encoder, update)
      conn.send(encoding.toUint8Array(encoder))
    }
  }

  const awarenessHandler = ({ added, updated, removed }, origin) => {
    const changedClients = added.concat(updated).concat(removed)
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
    )
    conn.send(encoding.toUint8Array(encoder))
  }

  doc.on('update', updateHandler)
  awareness.on('change', awarenessHandler)

  conn.on('close', () => {
    doc.off('update', updateHandler)
    awareness.off('change', awarenessHandler)
    awarenessProtocol.removeAwarenessStates(awareness, [conn], null)
    console.log(`🔌 Client disconnected from: ${slug}`)
  })
}

/**
 * Load note content from PostgreSQL into Y.Doc
 */
async function loadNoteContent(slug, ydoc) {
  try {
    const result = await pool.query(
      'SELECT content FROM notes WHERE slug = $1',
      [slug]
    )
    
    if (result.rows.length > 0 && result.rows[0].content) {
      const content = result.rows[0].content
      
      // Convert TipTap JSON to Y.js fragment
      const fragment = ydoc.getXmlFragment('prosemirror')
      
      // Initialize with existing content
      // Note: This is a simple conversion. Y.js will manage the actual collaborative state.
      if (content.type === 'doc' && content.content) {
        // Store as metadata for initial editor load
        ydoc.getText('_initial_content').insert(0, JSON.stringify(content))
      }
      
      console.log(`📄 Loaded content for note: ${slug}`)
    }
  } catch (error) {
    console.error(`Error loading note ${slug}:`, error)
  }
}

/**
 * Setup periodic persistence to database
 */
function setupPersistence(slug, ydoc) {
  // Save to database every 10 seconds when there are changes
  let hasChanges = false
  
  ydoc.on('update', () => {
    hasChanges = true
  })
  
  const timer = setInterval(async () => {
    if (hasChanges) {
      await saveNoteContent(slug, ydoc)
      hasChanges = false
    }
  }, 10000) // 10 seconds
  
  persistence.set(slug, timer)
  
  // Cleanup when all clients disconnect (delayed by 30s)
  setTimeout(() => {
    if (!hasActiveConnections(slug)) {
      clearInterval(timer)
      persistence.delete(slug)
      
      // Final save before cleanup
      saveNoteContent(slug, ydoc).then(() => {
        docs.delete(slug)
        console.log(`🧹 Cleaned up Y.Doc for: ${slug}`)
      })
    }
  }, 30000)
}

/**
 * Save Y.Doc content back to PostgreSQL
 */
async function saveNoteContent(slug, ydoc) {
  try {
    // Get the TipTap content from Y.js
    const fragment = ydoc.getXmlFragment('prosemirror')
    
    // Convert Y.js fragment back to TipTap JSON
    // For now, we'll use a simplified approach
    const initialContent = ydoc.getText('_initial_content').toString()
    let content = initialContent ? JSON.parse(initialContent) : { type: 'doc', content: [] }
    
    await pool.query(
      'UPDATE notes SET content = $1, updated_at = NOW() WHERE slug = $2',
      [JSON.stringify(content), slug]
    )
    
    console.log(`💾 Saved content for note: ${slug}`)
  } catch (error) {
    console.error(`Error saving note ${slug}:`, error)
  }
}

/**
 * Check if there are active WebSocket connections for a slug
 */
function hasActiveConnections(slug) {
  const doc = docs.get(slug)
  if (!doc) return false
  
  // Check if there are any awareness states (indicates active connections)
  return doc.store.clients.size > 0
}

/**
 * Get awareness data for a note (for debugging/monitoring)
 */
export function getAwarenessData(slug) {
  const doc = docs.get(slug)
  if (!doc) return null
  
  return {
    clients: doc.store.clients.size,
    slug
  }
}
