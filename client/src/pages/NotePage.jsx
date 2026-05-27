import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useNote } from '../hooks/useNote'
import Editor from '../components/Editor'
import NoteMenu from '../components/NoteMenu'
import PasswordPrompt from '../components/PasswordPrompt'
import CollaborationBar from '../components/CollaborationBar'

export default function NotePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const {
    note, loading, error, saving, needsPassword,
    canEdit, isOwner, accessMode,
    collaborators, connected,
    save,
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
    <div className="h-screen w-screen overflow-hidden bg-[#191622]">
      <Editor
        content={note?.content}
        onUpdate={save}
        onEditorReady={setEditor}
        editable={canEdit}
        title={slug}
        status={(
          <>
            {accessMode === 'open' && (
              <CollaborationBar
                connected={connected}
                collaborators={collaborators}
              />
            )}
            {saving && canEdit && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-[#67e480] animate-glow-pulse" />
                sync
              </span>
            )}
          </>
        )}
        actions={(
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
        )}
      />
    </div>
  )
}
