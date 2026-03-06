import { useState, useRef, useEffect } from 'react'

function ToolbarButton({ onClick, active, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-sm text-sm transition ${
        active
          ? 'bg-terminal/10 text-terminal shadow-terminal-sm'
          : 'text-shade hover:text-skull hover:bg-crypt'
      }`}
    >
      {children}
    </button>
  )
}

function Dropdown({ label, children, open, setOpen }) {
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [setOpen])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-sm text-sm text-shade hover:text-skull hover:bg-crypt transition flex items-center gap-0.5"
      >
        {label}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-abyss border border-glyph rounded-sm shadow-xl py-1 z-20 min-w-[160px]">
          {children}
        </div>
      )}
    </div>
  )
}

function DropdownItem({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-sm text-bone hover:bg-crypt hover:text-skull transition flex items-center gap-2"
    >
      {children}
    </button>
  )
}

export default function Toolbar({ editor, canEdit = true }) {
  const [headingOpen, setHeadingOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)

  if (!editor) return <div className="flex-1" />

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 flex-1 justify-center">
        <span className="text-xs text-blood/60 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          [locked] apenas leitura
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5 flex-1 justify-center">
      {/* Undo / Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" /></svg>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" /></svg>
      </ToolbarButton>

      <div className="w-px h-5 bg-glyph mx-1" />

      {/* Headings */}
      <Dropdown label={<span className="font-semibold">H</span>} open={headingOpen} setOpen={setHeadingOpen}>
        <DropdownItem onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setHeadingOpen(false) }}>
          <span className="font-bold text-base">H1</span> Heading 1
        </DropdownItem>
        <DropdownItem onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setHeadingOpen(false) }}>
          <span className="font-bold text-sm">H2</span> Heading 2
        </DropdownItem>
        <DropdownItem onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setHeadingOpen(false) }}>
          <span className="font-bold text-xs">H3</span> Heading 3
        </DropdownItem>
      </Dropdown>

      {/* Lists */}
      <Dropdown label={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>} open={listOpen} setOpen={setListOpen}>
        <DropdownItem onClick={() => { editor.chain().focus().toggleBulletList().run(); setListOpen(false) }}>
          Bullet List
        </DropdownItem>
        <DropdownItem onClick={() => { editor.chain().focus().toggleOrderedList().run(); setListOpen(false) }}>
          Ordered List
        </DropdownItem>
        <DropdownItem onClick={() => { editor.chain().focus().toggleTaskList().run(); setListOpen(false) }}>
          Task List
        </DropdownItem>
      </Dropdown>

      {/* Blockquote */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
      </ToolbarButton>

      {/* Code Block */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
      </ToolbarButton>

      <div className="w-px h-5 bg-glyph mx-1" />

      {/* Bold */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <span className="font-bold text-sm">B</span>
      </ToolbarButton>

      {/* Italic */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <span className="italic text-sm">I</span>
      </ToolbarButton>

      {/* Strikethrough */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <span className="line-through text-sm">S</span>
      </ToolbarButton>

      {/* Code */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline Code"
      >
        <span className="text-xs font-mono">&lt;/&gt;</span>
      </ToolbarButton>

      {/* Underline */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      >
        <span className="underline text-sm">U</span>
      </ToolbarButton>

      {/* Highlight */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive('highlight')}
        title="Highlight"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </ToolbarButton>

      {/* Clear formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Limpar formatacao"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </ToolbarButton>
    </div>
  )
}
