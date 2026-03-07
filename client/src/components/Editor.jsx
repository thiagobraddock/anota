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

const lowlight = createLowlight(common)

export default function Editor({ 
  content, 
  onUpdate, 
  onEditorReady, 
  editable = true,
  onRemoteUpdate,
  sendContent,
}) {
  const readyRef = useRef(false)
  const isRemoteUpdateRef = useRef(false)

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
            isRemoteUpdateRef.current = true
            editor.commands.setContent(remoteContent, false)
            setTimeout(() => {
              isRemoteUpdateRef.current = false
            }, 50)
          }
        }
      })
    }
  }, [onRemoteUpdate, editor])

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
