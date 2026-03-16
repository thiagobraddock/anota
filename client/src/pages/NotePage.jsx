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
import { getDeviceId } from '../lib/api'

export default function NotePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    note, loading, error, saving, needsPassword,
    canEdit, isOwner, accessMode,
    collaborators, connected,
    save, ydoc, provider,
    verifyPassword, toggleAccessMode,
    handleRename, handleDelete,
    refetch,
  } = useNote(slug)
  const [editor, setEditor] = useState(null)

  const collaborationUser = user ? {
    name: user.name,
    color: getUserColor(user.id),
  } : {
    name: 'Anônimo',
    color: getUserColor(getDeviceId()),
  }

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
      <header className="border-b border-glyph bg-abyss sticky top-0 z-10">
        {/* Row 1: Navigation + Actions */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <a href="/" className="text-base sm:text-sm font-bold text-terminal hover:text-terminal-dim transition shrink-0">
              a.it
            </a>
            <span className="text-glyph">&rarr;</span>
            <span className="text-shade text-sm sm:text-xs truncate max-w-[120px] sm:max-w-none">{slug}</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-2 shrink-0">
            {accessMode === 'open' && (
              <CollaborationBar 
                connected={connected} 
                collaborators={collaborators} 
              />
            )}
            {saving && canEdit && (
              <span className="flex items-center gap-1.5 text-xs text-shade">
                <span className="w-2 h-2 sm:w-1.5 sm:h-1.5 rounded-full bg-terminal animate-glow-pulse" />
                <span className="hidden sm:inline">sync</span>
              </span>
            )}
            <ThemeToggle />
            <NoteMenu
              slug={slug}
              isOwner={isOwner}
              canEdit={canEdit}
              accessMode={accessMode}
              noteContent={editor?.getJSON?.() || note?.content}
              onDelete={async () => { await handleDelete(); navigate('/') }}
              onRename={async (newSlug) => { await handleRename(newSlug); navigate(`/${newSlug}`) }}
              onToggleAccessMode={toggleAccessMode}
              refetch={refetch}
            />
          </div>
        </div>

        {/* Row 2: Toolbar */}
        <div className="px-2 pb-2 sm:px-3">
          <Toolbar editor={editor} canEdit={canEdit} />
        </div>
      </header>

      <Editor
        content={note?.content}
        onUpdate={save}
        onEditorReady={setEditor}
        editable={canEdit}
        ydoc={accessMode === 'open' ? ydoc : null}
        provider={accessMode === 'open' ? provider : null}
        user={collaborationUser}
      />
    </div>
  )
}

function getUserColor(seed) {
  const colors = [
    '#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8',
    '#94FADB', '#B9F18D', '#C3E2C2', '#EAECCC', '#AFC8AD',
  ]

  const value = String(seed)
  const hash = value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
