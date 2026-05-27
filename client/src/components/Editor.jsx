import MonacoEditor from '@monaco-editor/react'
import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'anota:editor-settings'

const LANGUAGE_OPTIONS = [
  { id: 'markdown', label: 'Markdown', shortLabel: 'md', language: 'markdown', extension: 'md' },
  { id: 'javascript', label: 'JavaScript', shortLabel: 'js', language: 'javascript', extension: 'js' },
  { id: 'html', label: 'HTML', shortLabel: 'html', language: 'html', extension: 'html' },
  { id: 'css', label: 'CSS', shortLabel: 'css', language: 'css', extension: 'css' },
]

const DEFAULT_FILES = {
  markdown: '',
  javascript: '',
  html: '',
  css: '',
}

const DEFAULT_SETTINGS = {
  lineNumbers: true,
  wordWrap: true,
  minimap: false,
  fontSize: 16,
}

const MONACO_OMNI_THEME = {
  base: 'vs-dark',
  inherit: true,
  colors: {
    'editor.background': '#191622',
    'editor.foreground': '#E1E1E6',
    'editorLineNumber.foreground': '#6C6783',
    'editorLineNumber.activeForeground': '#E1E1E6',
    'editor.selectionBackground': '#41414D',
    'editor.lineHighlightBackground': '#201B2D',
    'editor.lineHighlightBorder': '#191622',
    'editorCursor.foreground': '#67E480',
    'editorWhitespace.foreground': '#FFFFFF1A',
    'editorIndentGuide.background': '#FFFFFF1A',
    'editorIndentGuide.activeBackground': '#E1E1E645',
    'scrollbarSlider.background': '#6C678355',
    'scrollbarSlider.hoverBackground': '#6C678388',
    'scrollbarSlider.activeBackground': '#6C6783AA',
  },
  rules: [
    { token: 'comment', foreground: '6C6783', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'FF79C6' },
    { token: 'string', foreground: 'E7DE79' },
    { token: 'number', foreground: 'E89E64' },
    { token: 'type', foreground: '78D1E1' },
    { token: 'tag', foreground: '67E480' },
    { token: 'attribute.name', foreground: '78D1E1' },
  ],
}

function loadSettings() {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function tiptapToMarkdown(content) {
  if (!content || content.type !== 'doc' || !Array.isArray(content.content)) {
    return ''
  }

  return content.content
    .map((node) => {
      const text = Array.isArray(node.content)
        ? node.content.map(child => child.text || '').join('')
        : ''

      if (node.type === 'heading') return `${'#'.repeat(node.attrs?.level || 1)} ${text}`
      if (node.type === 'codeBlock') return `\`\`\`\n${text}\n\`\`\``
      if (node.type === 'blockquote') return `> ${text}`
      return text
    })
    .filter(Boolean)
    .join('\n\n')
}

function normalizeContent(content) {
  if (content?.type === 'fronteditor' && content.files) {
    return {
      activeTab: content.activeTab || 'markdown',
      files: { ...DEFAULT_FILES, ...content.files },
    }
  }

  if (typeof content === 'string') {
    return {
      activeTab: 'markdown',
      files: { ...DEFAULT_FILES, markdown: content },
    }
  }

  return {
    activeTab: 'markdown',
    files: {
      ...DEFAULT_FILES,
      markdown: tiptapToMarkdown(content),
    },
  }
}

function SettingsPanel({ settings, onChange, onClose, language, onLanguageChange }) {
  const toggle = key => onChange({ ...settings, [key]: !settings[key] })
  const setFontSize = value => onChange({ ...settings, fontSize: Number(value) })

  return (
    <div className="absolute right-4 top-16 z-30 w-72 rounded-md border border-white/10 bg-[#11111b] p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-100">Editor</h2>
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-100">x</button>
      </div>

      <div className="space-y-3 text-sm text-zinc-200">
        <label className="block">
          <span className="mb-1 block">Syntax</span>
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            className="w-full rounded border border-white/10 bg-[#191622] px-2 py-2 text-zinc-100 outline-none focus:border-[#67e480]"
          >
            {LANGUAGE_OPTIONS.map(option => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Line numbers</span>
          <input type="checkbox" checked={settings.lineNumbers} onChange={() => toggle('lineNumbers')} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Word wrap</span>
          <input type="checkbox" checked={settings.wordWrap} onChange={() => toggle('wordWrap')} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Minimap</span>
          <input type="checkbox" checked={settings.minimap} onChange={() => toggle('minimap')} />
        </label>
        <label className="block">
          <span className="mb-1 block">Font size</span>
          <input
            type="range"
            min="13"
            max="22"
            value={settings.fontSize}
            onChange={(event) => setFontSize(event.target.value)}
            className="w-full accent-[#67e480]"
          />
        </label>
      </div>
    </div>
  )
}

export default function Editor({
  content,
  onUpdate,
  onEditorReady,
  editable = true,
  title = 'untitled',
  actions = null,
  status = null,
}) {
  const initialContent = useMemo(() => normalizeContent(content), [content])
  const [activeLanguage, setActiveLanguage] = useState(initialContent.activeTab)
  const [files, setFiles] = useState(initialContent.files)
  const [settings, setSettings] = useState(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const editorRef = useRef(null)
  const contentRef = useRef({ type: 'fronteditor', activeTab: activeLanguage, files })
  const activeLanguageRef = useRef(activeLanguage)

  useEffect(() => {
    const normalized = normalizeContent(content)
    setActiveLanguage(normalized.activeTab)
    setFiles(normalized.files)
  }, [content])

  useEffect(() => {
    contentRef.current = { type: 'fronteditor', activeTab: activeLanguage, files }
    activeLanguageRef.current = activeLanguage
  }, [activeLanguage, files])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    onEditorReady?.({
      getJSON: () => contentRef.current,
      getValue: () => contentRef.current.files[activeLanguageRef.current] || '',
    })
  }, [onEditorReady])

  function handleMount(editor, monaco) {
    editorRef.current = editor
    monaco.editor.defineTheme('anota-omni', MONACO_OMNI_THEME)
    monaco.editor.setTheme('anota-omni')

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onUpdate(contentRef.current)
    })
  }

  function handleChange(value) {
    const nextFiles = {
      ...files,
      [activeLanguage]: value || '',
    }
    const nextContent = {
      type: 'fronteditor',
      activeTab: activeLanguage,
      files: nextFiles,
    }

    setFiles(nextFiles)
    contentRef.current = nextContent
    onUpdate(nextContent)
  }

  function handleLanguageChange(nextLanguage) {
    const nextContent = {
      type: 'fronteditor',
      activeTab: nextLanguage,
      files,
    }

    setActiveLanguage(nextLanguage)
    contentRef.current = nextContent
    onUpdate(nextContent)
  }

  const currentLanguage = LANGUAGE_OPTIONS.find(option => option.id === activeLanguage) || LANGUAGE_OPTIONS[0]

  return (
    <section className="relative flex h-screen min-h-0 w-screen flex-col overflow-hidden bg-[#191622] text-zinc-100">
      <nav className="flex h-[72px] shrink-0 items-center border-b border-[#252131] bg-[#11111b] px-4 sm:px-8">
        <a href="/" className="mr-4 flex h-9 w-9 items-center justify-center text-lg font-black text-[#67e480]">
          a.
        </a>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>anota</span>
            <span>/</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
              .{currentLanguage.extension}
            </span>
          </div>
          <div className="truncate text-lg font-medium text-zinc-100 sm:text-xl">
            {title}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {status}
          {actions}
          <button
            type="button"
            onClick={() => setSettingsOpen(value => !value)}
            className="rounded-md p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Editor settings"
          >
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </nav>

      {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            language={activeLanguage}
            onLanguageChange={handleLanguageChange}
            onClose={() => setSettingsOpen(false)}
          />
      )}

      <main className="relative min-h-0 flex-1">
        <MonacoEditor
          key={currentLanguage.id}
          className="h-full w-full"
          language={currentLanguage.language}
          path={`note.${currentLanguage.extension}`}
          value={files[currentLanguage.id] || ''}
          loading={<div className="p-6 text-zinc-400">Carregando editor...</div>}
          onMount={handleMount}
          onChange={handleChange}
          options={{
            readOnly: !editable,
            minimap: { enabled: settings.minimap },
            lineNumbers: settings.lineNumbers ? 'on' : 'off',
            renderLineHighlight: 'gutter',
            fontSize: settings.fontSize,
            lineHeight: Math.round(settings.fontSize * 1.65),
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
            fontLigatures: true,
            wordWrap: settings.wordWrap ? 'on' : 'off',
            tabSize: 2,
            mouseWheelZoom: true,
            automaticLayout: true,
            scrollBeyondLastLine: true,
            padding: { top: 22, bottom: 22 },
            bracketPairColorization: { enabled: true },
            guides: { indentation: true },
          }}
          theme="anota-omni"
        />
      </main>
    </section>
  )
}
