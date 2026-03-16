import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { common, createLowlight } from 'lowlight'
import { useEffect, useRef } from 'react'

const lowlight = createLowlight(common)

export default function Editor({
  content,
  onUpdate,
  onEditorReady,
  editable = true,
  ydoc = null,
  provider = null,
  user = null,
}) {
  const readyRef = useRef(false)

  const extensions = [
    StarterKit.configure({
      codeBlock: false,
      history: ydoc ? false : undefined,
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
  ]

  if (ydoc && provider) {
    extensions.push(
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: user || {
          name: 'Anônimo',
          color: '#958DF1',
        },
      }),
    )
  }

  const editor = useEditor(
    {
      extensions,
      content: ydoc ? undefined : (content || ''),
      editable,
      onCreate: () => {
        if (!ydoc) {
          setTimeout(() => {
            readyRef.current = true
          }, 100)
        }
      },
      onUpdate: ({ editor }) => {
        const json = editor.getJSON()

        if (ydoc) {
          onUpdate(json)
          return
        }

        if (readyRef.current) {
          onUpdate(json)
        }
      },
      editorProps: {
        attributes: {
          class: 'tiptap',
        },
      },
    },
    [editable, ydoc, provider],
  )

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

  useEffect(() => {
    if (provider && user) {
      provider.awareness.setLocalStateField('user', user)
    }
  }, [provider, user])

  useEffect(() => {
    if (editor && content && !editor.isDestroyed && content.type && !ydoc) {
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
  }, [editor, content, ydoc])

  return <EditorContent editor={editor} className="flex-1" />
}
