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
  user = null 
}) {
  const readyRef = useRef(false)

  // Build extensions list based on collaboration mode
  const extensions = [
    StarterKit.configure({
      codeBlock: false,
      // Disable history when using collaboration (Y.js has its own)
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

  // Add collaboration extensions if ydoc is provided
  if (ydoc && provider) {
    extensions.push(
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: user || {
          name: 'Anônimo',
          color: getRandomColor(),
        },
      })
    )
  }

  const editor = useEditor({
    extensions,
    content: ydoc ? undefined : (content || ''), // Don't set initial content in collab mode
    editable,
    onCreate: () => {
      // Only start saving after editor is fully initialized with content
      if (!ydoc) {
        setTimeout(() => {
          readyRef.current = true
        }, 100)
      }
    },
    onUpdate: ({ editor }) => {
      // Only use onUpdate callback in non-collaborative mode
      if (!ydoc && readyRef.current) {
        onUpdate(editor.getJSON())
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

  // Sync editable state when it changes
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Set initial content when note loads (if content arrives after editor init)
  // Only in non-collaborative mode
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

// Generate random color for collaboration cursors
function getRandomColor() {
  const colors = [
    '#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8',
    '#94FADB', '#B9F18D', '#C3E2C2', '#EAECCC', '#AFC8AD',
    '#EEC759', '#9BB8CD', '#FF90BC', '#FFC0D9', '#F6B17A'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
