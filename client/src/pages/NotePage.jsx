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
    save, verifyPassword, toggleAccessMode,
    handleRename, handleDelete,
    refetch,
    ydoc, provider,
  } = useNote(slug)
  const [editor, setEditor] = useState(null)

  // Prepare user data for collaboration
  const collaborationUser = user ? {
    name: user.name,
    color: getUserColor(user.id),
  } : {
    name: 'Anônimo',
    color: getRandomColor(),
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
          {saving && canEdit && !provider && (
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

      {/* Collaboration bar - only show when collaborative */}
      {provider && <CollaborationBar provider={provider} user={collaborationUser} />}

      <Editor
        content={note?.content}
        onUpdate={save}
        onEditorReady={setEditor}
        editable={canEdit}
        ydoc={ydoc}
        provider={provider}
        user={collaborationUser}
      />
    </div>
  )
}

// Generate consistent color for user based on their ID
function getUserColor(userId) {
  const colors = [
    '#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8',
    '#94FADB', '#B9F18D', '#C3E2C2', '#EAECCC', '#AFC8AD',
  ]
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

// Generate random color for anonymous users
function getRandomColor() {
  const colors = [
    '#FF90BC', '#FFC0D9', '#F6B17A', '#9BB8CD', '#EEC759'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
