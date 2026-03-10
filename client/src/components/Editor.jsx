import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { useEffect, useRef } from 'react'
import { RemoteCursorsExtension, RemoteCursorsKey } from '../extensions/RemoteCursors'

const lowlight = createLowlight(common)

export default function Editor({ 
  content, 
  onUpdate, 
  onEditorReady, 
  editable = true,
  onRemoteUpdate,
  onRemoteCursor,
  sendContent,
  sendCursor,
  collaborators = [],
}) {
  const readyRef = useRef(false)
  const isRemoteUpdateRef = useRef(false)
  const prevCollaboratorIdsRef = useRef(new Set())

  const extensions = [
    StarterKit.configure({
      codeBlock: false,
    }),
    Underline,
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    CodeBlockLowlight.configure({ lowlight }),
    Placeholder.configure({
      placeholder: editable
        ? 'Comece a digitar...'
        : 'Esta nota é privada. Apenas o criador pode editar.',
    }),
    RemoteCursorsExtension,
  ]

  const editor = useEditor({
    extensions,
    content: content || '',
    editable,
    onCreate: () => {
      setTimeout(() => {
        readyRef.current = true
      }, 100)
    },
    onUpdate: ({ editor }) => {
      if (readyRef.current && !isRemoteUpdateRef.current) {
        const json = editor.getJSON()
        onUpdate(json)
        // Send to WebSocket if available
        if (sendContent) {
          sendContent(json)
        }
      }
    },
    onSelectionUpdate: ({ editor }) => {
      if (readyRef.current && !isRemoteUpdateRef.current && sendCursor) {
        const { anchor, head } = editor.state.selection
        sendCursor({ anchor, head })
      }
    },
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
  })

  useEffect(() => {
    if (editor) {
      onEditorReady(editor)
    }
  }, [editor, onEditorReady])

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Register for remote updates
  useEffect(() => {
    if (onRemoteUpdate && editor) {
      onRemoteUpdate((remoteContent) => {
        if (editor && !editor.isDestroyed && remoteContent) {
          const currentContent = JSON.stringify(editor.getJSON())
          const newContent = JSON.stringify(remoteContent)
          if (currentContent !== newContent) {
            // Save current cursor position before applying remote content
            const { from, to } = editor.state.selection

            isRemoteUpdateRef.current = true
            editor.commands.setContent(remoteContent, false)

            // Restore cursor position clamped to new document size
            const newDocSize = editor.state.doc.content.size
            const clampedFrom = Math.min(Math.max(0, from), newDocSize)
            const clampedTo = Math.min(Math.max(0, to), newDocSize)
            try {
              editor.commands.setTextSelection({ from: clampedFrom, to: clampedTo })
            } catch {
              // Ignore if position is invalid in the new document
            }

            setTimeout(() => {
              isRemoteUpdateRef.current = false
            }, 50)
          }
        }
      })
    }
  }, [onRemoteUpdate, editor])

  // Register for remote cursor updates
  useEffect(() => {
    if (onRemoteCursor && editor) {
      onRemoteCursor((msg) => {
        if (!editor || editor.isDestroyed) return

        if (msg.type === 'clear') {
          // Remove all remote cursors
          const currentState = RemoteCursorsKey.getState(editor.state)
          if (currentState && Object.keys(currentState.cursors).length > 0) {
            for (const userId of Object.keys(currentState.cursors)) {
              editor.view.dispatch(
                editor.state.tr.setMeta(RemoteCursorsKey, { type: 'remove', userId })
              )
            }
          }
          return
        }

        if (msg.userId && msg.cursor) {
          editor.view.dispatch(
            editor.state.tr.setMeta(RemoteCursorsKey, {
              type: 'update',
              userId: msg.userId,
              cursor: msg.cursor,
              color: msg.color,
              name: msg.name,
            })
          )
        }
      })
    }
  }, [onRemoteCursor, editor])

  // Remove cursor for a user when they disconnect (users list updated)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const currentIds = new Set(collaborators.map((u) => u.id))
    const prevIds = prevCollaboratorIdsRef.current

    // Find users that left
    for (const userId of prevIds) {
      if (!currentIds.has(userId)) {
        editor.view.dispatch(
          editor.state.tr.setMeta(RemoteCursorsKey, { type: 'remove', userId })
        )
      }
    }

    prevCollaboratorIdsRef.current = currentIds
  }, [editor, collaborators])

  useEffect(() => {
    if (editor && content && !editor.isDestroyed && content.type) {
      const currentContent = JSON.stringify(editor.getJSON())
      const newContent = JSON.stringify(content)
      if (currentContent !== newContent) {
        readyRef.current = false
        editor.commands.setContent(content, false)
        setTimeout(() => {
          readyRef.current = true
        }, 100)
      }
    }
  }, [editor, content])

  return <EditorContent editor={editor} className="flex-1" />
}
