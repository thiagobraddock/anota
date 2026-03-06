import { useEffect, useRef, useState, useCallback } from "react";
import { api, renameCreatorToken, removeCreatorToken } from "../lib/api";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

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
  const [canEdit, setCanEdit] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [accessMode, setAccessMode] = useState("private");
  const timerRef = useRef(null);
  const apiAvailableRef = useRef(false);

  // Y.js collaboration states
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState(null);
  const providerRef = useRef(null);

  const fetchNote = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNote(slug);
      apiAvailableRef.current = true;
      if (data.needs_password) {
        setNeedsPassword(true);
        setNote(data);
      } else {
        setNeedsPassword(false);
        setNote(data);
      }
      setCanEdit(data.can_edit !== undefined ? data.can_edit : true);
      setIsOwner(data.is_owner || false);
      setAccessMode(data.access_mode || "open");
    } catch (err) {
      if (err.status === 404 || !err.status) {
        apiAvailableRef.current = !!err.status;
        // Try loading from localStorage
        const local = loadFromLocal(slug);
        setNote({ slug, content: local });
        setCanEdit(true); // New note - user is creator
        setIsOwner(true);
        setAccessMode("open");
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
    };
  }, [fetchNote]);

  // Setup WebSocket provider for collaboration
  useEffect(() => {
    // Only setup collaboration if:
    // 1. Note is loaded
    // 2. Doesn't need password
    // 3. Access mode is 'open' (collaborative notes only)
    if (!note || needsPassword || accessMode === "private" || !slug) {
      return;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = import.meta.env.PROD
      ? window.location.host
      : "localhost:3000";

    const wsProvider = new WebsocketProvider(
      `${wsProtocol}//${wsHost}/collaboration`,
      slug,
      ydoc,
      {
        connect: true,
        params: { slug },
      },
    );

    providerRef.current = wsProvider;
    setProvider(wsProvider);

    console.log("🔗 Collaboration enabled for:", slug);

    return () => {
      console.log("🔌 Disconnecting collaboration for:", slug);
      wsProvider.destroy();
      setProvider(null);
      providerRef.current = null;
    };
  }, [note, needsPassword, accessMode, slug, ydoc]);

  const save = useCallback(
    (content) => {
      // Don't save if user can't edit
      if (!canEdit) return;

      // In collaborative mode, Y.js handles sync automatically
      if (providerRef.current) {
        saveToLocal(slug, content); // Still save to localStorage for offline fallback
        return;
      }

      // Non-collaborative mode: use debounced HTTP save
      saveToLocal(slug, content);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          await api.saveNote(slug, content);
          apiAvailableRef.current = true;
        } catch (err) {
          if (err.status === 403) {
            // Lost edit permission (note was made private)
            setCanEdit(false);
          }
          // localStorage already has the data, so content is safe
          console.error("Save error (saved locally):", err);
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
        await api.verifyPassword(slug, password);
        setNeedsPassword(false);
        await fetchNote();
        return true;
      } catch {
        return false;
      }
    },
    [slug, fetchNote],
  );

  const toggleAccessMode = useCallback(async () => {
    const newMode = accessMode === "open" ? "private" : "open";
    try {
      await api.setAccessMode(slug, newMode);
      setAccessMode(newMode);
      return true;
    } catch {
      return false;
    }
  }, [slug, accessMode]);

  const handleRename = useCallback(
    async (newSlug) => {
      const result = await api.renameNote(slug, newSlug);
      renameCreatorToken(slug, newSlug);
      return result;
    },
    [slug],
  );

  const handleDelete = useCallback(async () => {
    await api.deleteNote(slug);
    removeCreatorToken(slug);
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
    save,
    verifyPassword,
    toggleAccessMode,
    handleRename,
    handleDelete,
    refetch: fetchNote,
    // Collaboration
    ydoc,
    provider,
  };
}
