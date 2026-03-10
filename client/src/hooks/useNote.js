import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../lib/api";

const STORAGE_PREFIX = "anota_";

function saveToLocal(slug, content) {
  try {
    localStorage.setItem(STORAGE_PREFIX + slug, JSON.stringify(content));
  } catch {
    /* quota exceeded */
  }
}

function loadFromLocal(slug) {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + slug);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function useNote(slug) {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [accessMode, setAccessMode] = useState("private");
  const [collaborators, setCollaborators] = useState([]);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef(null);
  const wsRef = useRef(null);
  const onRemoteUpdateRef = useRef(null);
  const onRemoteCursorRef = useRef(null);

  const fetchNote = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.getNote(slug);

      if (data.needs_password) {
        setNeedsPassword(true);
        setNote(data);
        setCanEdit(false);
      } else {
        setNeedsPassword(false);
        setNote(data);
        setCanEdit(data.can_edit ?? false);
        setIsOwner(data.is_owner ?? false);
        setAccessMode(data.access_mode ?? "private");
      }

      console.log("📋 Note loaded:", {
        slug,
        canEdit: data.can_edit,
        isOwner: data.is_owner,
        accessMode: data.access_mode,
      });
    } catch (err) {
      if (err.status === 404) {
        const local = loadFromLocal(slug);
        setNote({ slug, content: local });
        setCanEdit(true);
        setIsOwner(true);
        setAccessMode("private");
        console.log("📋 New note (not yet saved):", slug);
      } else {
        setError(err.error || "Erro ao carregar nota");
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchNote();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Close WebSocket on unmount
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchNote]);

  // WebSocket connection for open notes
  useEffect(() => {
    if (accessMode !== "open" || loading) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/collaboration/${slug}`;
    
    console.log("🔌 Connecting WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === "content" && msg.from !== "self") {
          console.log("📥 Received remote content update");
          // Call the callback if registered
          if (onRemoteUpdateRef.current) {
            onRemoteUpdateRef.current(msg.content);
          }
        } else if (msg.type === "cursor") {
          if (onRemoteCursorRef.current) {
            onRemoteCursorRef.current(msg);
          }
        } else if (msg.type === "users") {
          console.log("👥 Users update:", msg.count);
          setCollaborators(msg.users || []);
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    };

    ws.onclose = () => {
      console.log("🔌 WebSocket disconnected");
      setConnected(false);
      setCollaborators([]);
      // Clear all remote cursors
      if (onRemoteCursorRef.current) {
        onRemoteCursorRef.current({ type: "clear" });
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setConnected(false);
      setCollaborators([]);
      if (onRemoteCursorRef.current) {
        onRemoteCursorRef.current({ type: "clear" });
      }
    };
  }, [slug, accessMode, loading]);

  // Function to register callback for remote updates
  const onRemoteUpdate = useCallback((callback) => {
    onRemoteUpdateRef.current = callback;
  }, []);

  // Function to register callback for remote cursor updates
  const onRemoteCursor = useCallback((callback) => {
    onRemoteCursorRef.current = callback;
  }, []);

  // Function to send content via WebSocket
  const sendContent = useCallback((content) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "content", content }));
    }
  }, []);

  // Function to send cursor position via WebSocket
  const sendCursor = useCallback((cursor) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cursor", cursor }));
    }
  }, []);

  const save = useCallback(
    (content) => {
      if (!canEdit) {
        console.warn("⚠️ Save blocked: no edit permission");
        return;
      }

      saveToLocal(slug, content);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          await api.saveNote(slug, content);
          console.log("💾 Saved to server");
        } catch (err) {
          if (err.status === 403) {
            setCanEdit(false);
          }
          console.error("Save error:", err);
        } finally {
          setSaving(false);
        }
      }, 1000);
    },
    [slug, canEdit],
  );

  const verifyPassword = useCallback(
    async (password) => {
      try {
        const data = await api.verifyPassword(slug, password);
        setNeedsPassword(false);
        setNote(data);
        setCanEdit(data.can_edit ?? false);
        setIsOwner(data.is_owner ?? false);
        setAccessMode(data.access_mode ?? "private");
        return true;
      } catch (err) {
        console.error("Password verification failed:", err);
        return false;
      }
    },
    [slug],
  );

  const toggleAccessMode = useCallback(async () => {
    const newMode = accessMode === "private" ? "open" : "private";
    console.log(`🔄 Toggling access mode: ${accessMode} → ${newMode}`);

    try {
      // Ensure the note exists in the database before changing access mode.
      // New notes only live in localStorage until the first explicit save, so
      // the access-mode endpoint would return 404 and the toggle would fail
      // silently. Persist the note first when it hasn't been saved yet.
      if (!note?.created_at) {
        const content = loadFromLocal(slug) ?? note?.content ?? {};
        await api.saveNote(slug, content);
      }

      await api.setAccessMode(slug, newMode);
      setAccessMode(newMode);
      console.log(`✅ Access mode: ${newMode}`);
      return true;
    } catch (err) {
      console.error("❌ Toggle access mode failed:", err);
      return false;
    }
  }, [slug, accessMode, note]);

  const handleRename = useCallback(
    async (newSlug) => {
      return await api.renameNote(slug, newSlug);
    },
    [slug],
  );

  const handleDelete = useCallback(async () => {
    await api.deleteNote(slug);
  }, [slug]);

  return {
    note,
    loading,
    error,
    saving,
    needsPassword,
    canEdit,
    isOwner,
    accessMode,
    collaborators,
    connected,
    save,
    sendContent,
    sendCursor,
    onRemoteUpdate,
    onRemoteCursor,
    verifyPassword,
    toggleAccessMode,
    handleRename,
    handleDelete,
    refetch: fetchNote,
  };
}
