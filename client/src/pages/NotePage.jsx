import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useNote } from '../hooks/useNote'
import { useAuth } from '../hooks/useAuth'
import Editor from '../components/Editor'
import Toolbar from '../components/Toolbar'
import NoteMenu from '../components/NoteMenu'
import ThemeToggle from '../components/ThemeToggle'
import PasswordPrompt from '../components/PasswordPrompt'
import CollaborationBar from '../components/CollaborationBar'

export default function NotePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    note, loading, error, saving, needsPassword,
    canEdit, isOwner, accessMode,
    collaborators, connected,
    save, sendContent, onRemoteUpdate,
    verifyPassword, toggleAccessMode,
    handleRename, handleDelete,
    refetch,
  } = useNote(slug)
  const [editor, setEditor] = useState(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-terminal text-sm animate-pulse">
          &gt; loading /{slug}...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <p className="text-blood text-sm mb-3">[ERROR] {error}</p>
          <button onClick={() => navigate('/')} className="text-terminal text-sm hover:underline">
            &gt; cd /
          </button>
        </div>
      </div>
    )
  }

  if (needsPassword) {
    return <PasswordPrompt slug={slug} onVerify={verifyPassword} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-void">
      <header className="flex items-center justify-between px-3 py-2 border-b border-glyph bg-abyss sticky top-0 z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <a href="/" className="text-sm font-bold text-terminal hover:text-terminal-dim transition shrink-0">
            a.it
          </a>
          <span className="text-glyph text-xs">/</span>
          <span className="text-shade text-xs truncate">{slug}</span>
        </div>

        <Toolbar editor={editor} canEdit={canEdit} />

        <div className="flex items-center gap-2 shrink-0">
          {accessMode === 'open' && (
            <CollaborationBar 
              connected={connected} 
              collaborators={collaborators} 
            />
          )}
          {saving && canEdit && (
            <span className="flex items-center gap-1.5 text-xs text-shade">
              <span className="w-1.5 h-1.5 rounded-full bg-terminal animate-glow-pulse" />
              sync
            </span>
          )}
          <ThemeToggle />
          <NoteMenu
            slug={slug}
            isOwner={isOwner}
            canEdit={canEdit}
            accessMode={accessMode}
            noteContent={note?.content}
            onDelete={async () => { await handleDelete(); navigate('/') }}
            onRename={async (newSlug) => { await handleRename(newSlug); navigate(`/${newSlug}`) }}
            onToggleAccessMode={toggleAccessMode}
            refetch={refetch}
          />
        </div>
      </header>

      <Editor
        content={note?.content}
        onUpdate={save}
        onEditorReady={setEditor}
        editable={canEdit}
        sendContent={accessMode === 'open' ? sendContent : undefined}
        onRemoteUpdate={accessMode === 'open' ? onRemoteUpdate : undefined}
      />
    </div>
  )
}
