import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { api, getDeviceId } from "../lib/api";

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

function getCollaborators(provider) {
  return Array.from(provider.awareness.getStates().entries())
    .map(([id, state]) => ({
      id,
      ...state?.user,
    }))
    .filter((user) => user.name && user.color);
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
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);
  const timerRef = useRef(null);
  const providerRef = useRef(null);
  const ydocRef = useRef(null);

  const cleanupCollaboration = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }

    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }

    setProvider(null);
    setYdoc(null);
    setConnected(false);
    setCollaborators([]);
  }, []);

  const fetchNote = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await api.getNote(slug);

      if (data.needs_password) {
        setNeedsPassword(true);
        setNote(data);
        setCanEdit(false);
        setIsOwner(data.is_owner ?? false);
        setAccessMode(data.access_mode ?? "private");
      } else {
        setNeedsPassword(false);
        setNote(data);
        setCanEdit(data.can_edit ?? false);
        setIsOwner(data.is_owner ?? false);
        setAccessMode(data.access_mode ?? "private");
      }
    } catch (err) {
      if (err.status === 404) {
        const local = loadFromLocal(slug);
        setNeedsPassword(false);
        setNote({ slug, content: local });
        setCanEdit(true);
        setIsOwner(true);
        setAccessMode("private");
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
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      cleanupCollaboration();
    };
  }, [fetchNote, cleanupCollaboration]);

  useEffect(() => {
    if (loading || needsPassword || accessMode !== "open") {
      cleanupCollaboration();
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const doc = new Y.Doc();
    const wsProvider = new WebsocketProvider(
      `${protocol}//${window.location.host}/collaboration`,
      slug,
      doc,
      {
        connect: true,
        params: {
          deviceId: getDeviceId(),
        },
      },
    );

    const handleStatus = ({ status }) => {
      setConnected(status === "connected");
    };

    const handleAwarenessChange = () => {
      setCollaborators(getCollaborators(wsProvider));
    };

    providerRef.current = wsProvider;
    ydocRef.current = doc;
    setProvider(wsProvider);
    setYdoc(doc);
    setCollaborators(getCollaborators(wsProvider));

    wsProvider.on("status", handleStatus);
    wsProvider.awareness.on("change", handleAwarenessChange);

    return () => {
      wsProvider.off("status", handleStatus);
      wsProvider.awareness.off("change", handleAwarenessChange);

      if (providerRef.current === wsProvider) {
        providerRef.current = null;
      }

      if (ydocRef.current === doc) {
        ydocRef.current = null;
      }

      wsProvider.destroy();
      doc.destroy();
      setProvider(null);
      setYdoc(null);
      setConnected(false);
      setCollaborators([]);
    };
  }, [accessMode, cleanupCollaboration, loading, needsPassword, slug]);

  const save = useCallback(
    (content) => {
      if (!canEdit) {
        return;
      }

      saveToLocal(slug, content);
      setNote((current) =>
        current ? { ...current, content } : current,
      );

      if (providerRef.current) {
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          await api.saveNote(slug, content);
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
        await api.verifyPassword(slug, password);
        await fetchNote();
        return true;
      } catch (err) {
        console.error("Password verification failed:", err);
        return false;
      }
    },
    [fetchNote, slug],
  );

  const toggleAccessMode = useCallback(async () => {
    const newMode = accessMode === "private" ? "open" : "private";

    try {
      await api.setAccessMode(slug, newMode);
      setAccessMode(newMode);
      await fetchNote();
      return true;
    } catch (err) {
      console.error("Toggle access mode failed:", err);
      return false;
    }
  }, [accessMode, fetchNote, slug]);

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
    verifyPassword,
    toggleAccessMode,
    handleRename,
    handleDelete,
    refetch: fetchNote,
    ydoc,
    provider,
  };
}
