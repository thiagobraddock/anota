import MonacoEditor from '@monaco-editor/react'
import { useEffect, useMemo, useRef, useState } from 'react'

const STORAGE_KEY = 'anota:editor-settings'

const LANGUAGE_OPTIONS = [
  { id: 'markdown', label: 'Markdown', shortLabel: 'md', language: 'markdown', extension: 'md' },
  { id: 'javascript', label: 'JavaScript', shortLabel: 'js', language: 'javascript', extension: 'js' },
  { id: 'html', label: 'HTML', shortLabel: 'html', language: 'html', extension: 'html' },
  { id: 'css', label: 'CSS', shortLabel: 'css', language: 'css', extension: 'css' },
]

const DEFAULT_LANGUAGE = 'markdown'
const TOUCH_EDITOR_QUERY = '(pointer: coarse), (hover: none)'

// lowlight (highlight.js) grammar names for each language option
const TOUCH_HIGHLIGHT_LANGUAGES = {
  markdown: 'markdown',
  javascript: 'javascript',
  html: 'xml',
  css: 'css',
}
const TOUCH_HIGHLIGHT_MAX_LENGTH = 50000

const DEFAULT_SETTINGS = {
  theme: 'omni',
  lineNumbers: true,
  wordWrap: true,
  minimap: false,
  fontSize: 16,
}

function createHighlightPalette({ comment, keyword, string, number, type, func, tagName, attribute, foreground }) {
  return {
    comment: { color: comment, fontStyle: 'italic' },
    quote: { color: comment, fontStyle: 'italic' },
    meta: { color: comment },
    doctag: { color: keyword },
    keyword: { color: keyword },
    operator: { color: keyword },
    'selector-tag': { color: keyword },
    'selector-pseudo': { color: keyword },
    'variable.language': { color: keyword },
    bullet: { color: keyword },
    deletion: { color: keyword },
    string: { color: string },
    regexp: { color: string },
    'meta.string': { color: string },
    code: { color: string },
    link: { color: string, textDecoration: 'underline' },
    number: { color: number },
    literal: { color: number },
    symbol: { color: number },
    type: { color: type },
    built_in: { color: type },
    property: { color: type },
    'title.class': { color: type },
    'title.class.inherited': { color: type },
    title: { color: func },
    'title.function': { color: func },
    'title.function.invoke': { color: func },
    addition: { color: func },
    section: { color: func, fontWeight: 'bold' },
    name: { color: tagName },
    'selector-id': { color: tagName },
    'selector-class': { color: tagName },
    attr: { color: attribute },
    attribute: { color: attribute },
    'selector-attr': { color: attribute },
    tag: { color: foreground },
    params: { color: foreground },
    variable: { color: foreground },
    'template-variable': { color: foreground },
    subst: { color: foreground },
    strong: { fontWeight: 'bold' },
    emphasis: { fontStyle: 'italic' },
  }
}

const EDITOR_THEMES = {
  dracula: {
    label: 'Dracula',
    ui: {
      page: '#282a36',
      chrome: '#21222c',
      border: '#44475a',
      text: '#f8f8f2',
      muted: '#6272a4',
      brandText: '#f8f8f2',
      brandAccent: '#50fa7b',
      pill: '#44475a',
      panel: '#21222c',
    },
    highlight: createHighlightPalette({
      comment: '#6272a4',
      keyword: '#ff79c6',
      string: '#f1fa8c',
      number: '#bd93f9',
      type: '#8be9fd',
      func: '#50fa7b',
      tagName: '#ff79c6',
      attribute: '#50fa7b',
      foreground: '#f8f8f2',
    }),
    monaco: {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#282a36',
        'editor.foreground': '#f8f8f2',
        'editorLineNumber.foreground': '#6272a4',
        'editorLineNumber.activeForeground': '#f8f8f2',
        'editor.selectionBackground': '#44475a',
        'editor.selectionHighlightBackground': '#424450',
        'editor.lineHighlightBackground': '#44475a75',
        'editor.lineHighlightBorder': '#282a36',
        'editorCursor.foreground': '#f8f8f0',
        'editor.findMatchBackground': '#ffb86c80',
        'editor.findMatchHighlightBackground': '#f8f8f240',
        'editor.wordHighlightBackground': '#bd93f950',
        'editor.wordHighlightStrongBackground': '#50fa7b50',
        'editorWhitespace.foreground': '#FFFFFF1A',
        'editorIndentGuide.background': '#FFFFFF1A',
        'editorIndentGuide.activeBackground': '#f8f8f245',
        'scrollbarSlider.background': '#6272a455',
        'scrollbarSlider.hoverBackground': '#6272a488',
        'scrollbarSlider.activeBackground': '#6272a4AA',
      },
      rules: [
        { token: 'comment', foreground: '6272A4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'FF79C6' },
        { token: 'string', foreground: 'F1FA8C' },
        { token: 'regexp', foreground: 'F1FA8C' },
        { token: 'number', foreground: 'BD93F9' },
        { token: 'type', foreground: '8BE9FD' },
        { token: 'delimiter', foreground: 'F8F8F2' },
        { token: 'operator', foreground: 'FF79C6' },
        { token: 'function', foreground: '50FA7B' },
        { token: 'variable', foreground: 'F8F8F2' },
        { token: 'tag', foreground: 'FF79C6' },
        { token: 'attribute.name', foreground: '50FA7B' },
        { token: 'attribute.value', foreground: 'F1FA8C' },
      ],
    },
  },
  omni: {
    label: 'Omni',
    ui: {
      page: '#191622',
      chrome: '#11111b',
      border: '#252131',
      text: '#e1e1e6',
      muted: '#8d84b0',
      brandText: '#e1e1e6',
      brandAccent: '#67e480',
      pill: '#2a2637',
      panel: '#11111b',
    },
    highlight: createHighlightPalette({
      comment: '#6c6783',
      keyword: '#ff79c6',
      string: '#e7de79',
      number: '#e89e64',
      type: '#78d1e1',
      func: '#67e480',
      tagName: '#67e480',
      attribute: '#78d1e1',
      foreground: '#e1e1e6',
    }),
    monaco: {
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
        { token: 'string', foreground: 'e7de79' },
        { token: 'number', foreground: 'E89E64' },
        { token: 'type', foreground: '78D1E1' },
        { token: 'tag', foreground: '67E480' },
        { token: 'attribute.name', foreground: '78D1E1' },
      ],
    },
  },
  light: {
    label: 'Light',
    ui: {
      page: '#f8fafc',
      chrome: '#ffffff',
      border: '#d8dee9',
      text: '#1f2937',
      muted: '#64748b',
      brandText: '#0f172a',
      brandAccent: '#16a34a',
      pill: '#e8eef7',
      panel: '#ffffff',
    },
    highlight: createHighlightPalette({
      comment: '#64748b',
      keyword: '#7c3aed',
      string: '#047857',
      number: '#c2410c',
      type: '#0369a1',
      func: '#2563eb',
      tagName: '#be123c',
      attribute: '#2563eb',
      foreground: '#1f2937',
    }),
    monaco: {
      base: 'vs',
      inherit: true,
      colors: {
        'editor.background': '#f8fafc',
        'editor.foreground': '#1f2937',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#334155',
        'editor.selectionBackground': '#bfdbfe',
        'editor.lineHighlightBackground': '#e2e8f0',
        'editor.lineHighlightBorder': '#f8fafc',
        'editorCursor.foreground': '#2563eb',
        'editorWhitespace.foreground': '#33415522',
        'editorIndentGuide.background': '#33415522',
        'editorIndentGuide.activeBackground': '#33415555',
        'scrollbarSlider.background': '#94a3b855',
        'scrollbarSlider.hoverBackground': '#94a3b888',
        'scrollbarSlider.activeBackground': '#94a3b8AA',
      },
      rules: [
        { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7C3AED' },
        { token: 'string', foreground: '047857' },
        { token: 'number', foreground: 'C2410C' },
        { token: 'type', foreground: '0369A1' },
        { token: 'tag', foreground: 'BE123C' },
        { token: 'attribute.name', foreground: '2563EB' },
      ],
    },
  },
}

function loadSettings() {
  try {
    const settings = {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'),
    }

    if (!EDITOR_THEMES[settings.theme]) {
      settings.theme = DEFAULT_SETTINGS.theme
    }

    return settings
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

function getValidLanguage(language) {
  return LANGUAGE_OPTIONS.some(option => option.id === language) ? language : DEFAULT_LANGUAGE
}

function getLegacyFronteditorValue(content, activeLanguage) {
  if (!content?.files || typeof content.files !== 'object') {
    return ''
  }

  if (typeof content.files[activeLanguage] === 'string' && content.files[activeLanguage]) {
    return content.files[activeLanguage]
  }

  const firstFileWithText = LANGUAGE_OPTIONS
    .map(option => content.files[option.id])
    .find(value => typeof value === 'string' && value.length > 0)

  return firstFileWithText || ''
}

function normalizeContent(content) {
  if (content?.type === 'fronteditor') {
    const activeLanguage = getValidLanguage(content.activeTab)

    return {
      activeLanguage,
      value: typeof content.value === 'string'
        ? content.value
        : getLegacyFronteditorValue(content, activeLanguage),
    }
  }

  if (typeof content === 'string') {
    return {
      activeLanguage: DEFAULT_LANGUAGE,
      value: content,
    }
  }

  return {
    activeLanguage: DEFAULT_LANGUAGE,
    value: tiptapToMarkdown(content),
  }
}

function createEditorContent(activeLanguage, value) {
  return {
    type: 'fronteditor',
    activeTab: activeLanguage,
    value,
  }
}

function getInitialTouchEditorPreference() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(TOUCH_EDITOR_QUERY).matches
}

function usePrefersTouchEditor() {
  const [prefersTouchEditor, setPrefersTouchEditor] = useState(getInitialTouchEditorPreference)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const media = window.matchMedia(TOUCH_EDITOR_QUERY)
    const handleChange = event => setPrefersTouchEditor(event.matches)

    setPrefersTouchEditor(media.matches)

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [])

  return prefersTouchEditor
}

let lowlightLoader = null

function loadLowlight() {
  if (!lowlightLoader) {
    lowlightLoader = import('../lib/touchHighlight.js')
      .then(module => module.lowlight)
      .catch(() => null)
  }
  return lowlightLoader
}

function useLowlight() {
  const [lowlight, setLowlight] = useState(null)

  useEffect(() => {
    let active = true
    loadLowlight().then((instance) => {
      if (active && instance) setLowlight(() => instance)
    })
    return () => { active = false }
  }, [])

  return lowlight
}

function getTokenStyle(classNames, palette) {
  const scopes = classNames
    .filter(name => name !== 'hljs')
    .map(name => String(name).replace(/^hljs-/, '').replace(/_+$/, ''))
    .filter(Boolean)

  if (!scopes.length) return undefined

  const candidates = scopes.length > 1 ? [scopes.join('.'), ...scopes] : scopes

  for (const candidate of candidates) {
    if (palette[candidate]) return palette[candidate]
  }

  return undefined
}

function hastNodesToReact(nodes, palette, keyPrefix = 'hl') {
  return nodes.map((node, index) => {
    if (node.type === 'text') return node.value
    if (node.type !== 'element') return null

    const key = `${keyPrefix}-${index}`
    const classNames = Array.isArray(node.properties?.className) ? node.properties.className : []

    return (
      <span key={key} style={getTokenStyle(classNames, palette)}>
        {hastNodesToReact(node.children || [], palette, key)}
      </span>
    )
  })
}

function withAlpha(hexColor, alphaHex) {
  return /^#[0-9a-fA-F]{6}$/.test(hexColor || '') ? `${hexColor}${alphaHex}` : hexColor
}

function SettingsPanel({ settings, onChange, onClose, language, onLanguageChange, theme }) {
  const toggle = key => onChange({ ...settings, [key]: !settings[key] })
  const setFontSize = value => onChange({ ...settings, fontSize: Number(value) })
  const setTheme = value => onChange({ ...settings, theme: value })

  return (
    <div
      className="absolute right-0 top-12 z-30 w-72 rounded-md border p-4 shadow-2xl"
      style={{ background: theme.ui.panel, borderColor: theme.ui.border, color: theme.ui.text }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Editor</h2>
        <button
          type="button"
          onClick={onClose}
          className="opacity-60 hover:opacity-100"
        >
          x
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="mb-1 block">Theme</span>
          <select
            value={settings.theme}
            onChange={(event) => setTheme(event.target.value)}
            className="w-full rounded border px-2 py-2 outline-none"
            style={{ background: theme.ui.page, borderColor: theme.ui.border, color: theme.ui.text }}
          >
            {Object.entries(EDITOR_THEMES).map(([id, option]) => (
              <option key={id} value={id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block">Syntax</span>
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            className="w-full rounded border px-2 py-2 outline-none"
            style={{ background: theme.ui.page, borderColor: theme.ui.border, color: theme.ui.text }}
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

function TouchEditor({ value, onChange, onSave, editable, settings, theme, language }) {
  const nativeFontSize = Math.max(settings.fontSize, 16)
  const editorColors = theme.monaco.colors
  const textareaRef = useRef(null)
  const backdropRef = useRef(null)
  const lowlight = useLowlight()

  const highlightedContent = useMemo(() => {
    if (!lowlight || typeof value !== 'string' || value.length > TOUCH_HIGHLIGHT_MAX_LENGTH) {
      return null
    }

    const grammar = TOUCH_HIGHLIGHT_LANGUAGES[language]
    if (!grammar || !lowlight.registered(grammar)) {
      return null
    }

    try {
      return hastNodesToReact(lowlight.highlight(grammar, value).children, theme.highlight)
    } catch {
      return null
    }
  }, [lowlight, value, language, theme])

  // The textarea keeps every native interaction (selection, caret, IME); the
  // backdrop only mirrors its text with colors, so both layers must share the
  // exact same text metrics to stay aligned glyph by glyph.
  const sharedTextStyle = {
    fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
    fontSize: nativeFontSize,
    lineHeight: `${Math.round(nativeFontSize * 1.65)}px`,
    overflowWrap: settings.wordWrap ? 'break-word' : 'normal',
    padding: '22px 18px',
    tabSize: 2,
    WebkitTextSizeAdjust: '100%',
    whiteSpace: settings.wordWrap ? 'pre-wrap' : 'pre',
  }

  useEffect(() => {
    const textarea = textareaRef.current
    const backdrop = backdropRef.current
    if (!textarea || !backdrop) return
    backdrop.scrollTop = textarea.scrollTop
    backdrop.scrollLeft = textarea.scrollLeft
  })

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      onSave()
    }
  }

  function handleScroll(event) {
    const backdrop = backdropRef.current
    if (!backdrop) return
    backdrop.scrollTop = event.target.scrollTop
    backdrop.scrollLeft = event.target.scrollLeft
  }

  return (
    <div className="relative h-full w-full">
      {highlightedContent && (
        <div
          ref={backdropRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <pre
            style={{
              ...sharedTextStyle,
              color: editorColors['editor.foreground'],
              margin: 0,
              minWidth: '100%',
              width: settings.wordWrap ? 'auto' : 'max-content',
            }}
          >
            {highlightedContent}
            {'\n'}
          </pre>
        </div>
      )}
      <textarea
        ref={textareaRef}
        aria-label="Note editor"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={`touch-editor-input absolute inset-0 h-full w-full resize-none border-0 bg-transparent outline-none${highlightedContent ? ' touch-editor-input--highlighted' : ''}`}
        readOnly={!editable}
        spellCheck={false}
        value={value}
        wrap={settings.wordWrap ? 'soft' : 'off'}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        style={{
          ...sharedTextStyle,
          color: highlightedContent ? 'transparent' : editorColors['editor.foreground'],
          caretColor: editorColors['editorCursor.foreground'],
          '--touch-editor-selection': withAlpha(editorColors['editor.selectionBackground'], '99'),
          touchAction: 'auto',
          userSelect: 'text',
          WebkitOverflowScrolling: 'touch',
          WebkitUserSelect: 'text',
        }}
      />
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
  const [activeLanguage, setActiveLanguage] = useState(initialContent.activeLanguage)
  const [value, setValue] = useState(initialContent.value)
  const [settings, setSettings] = useState(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const prefersTouchEditor = usePrefersTouchEditor()
  const editorRef = useRef(null)
  const contentRef = useRef(createEditorContent(activeLanguage, value))
  const valueRef = useRef(value)

  useEffect(() => {
    const normalized = normalizeContent(content)
    setActiveLanguage(normalized.activeLanguage)
    setValue(normalized.value)
  }, [content])

  useEffect(() => {
    contentRef.current = createEditorContent(activeLanguage, value)
    valueRef.current = value
  }, [activeLanguage, value])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    onEditorReady?.({
      getJSON: () => contentRef.current,
      getValue: () => valueRef.current,
    })
  }, [onEditorReady])

  function handleMount(editor, monaco) {
    editorRef.current = editor
    Object.entries(EDITOR_THEMES).forEach(([id, theme]) => {
      monaco.editor.defineTheme(`anota-${id}`, theme.monaco)
    })
    monaco.editor.setTheme(`anota-${EDITOR_THEMES[settings.theme] ? settings.theme : DEFAULT_SETTINGS.theme}`)

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onUpdate(contentRef.current)
    })
  }

  function handleChange(value) {
    const nextValue = value || ''
    const nextContent = createEditorContent(activeLanguage, nextValue)

    setValue(nextValue)
    contentRef.current = nextContent
    onUpdate(nextContent)
  }

  function handleLanguageChange(nextLanguage) {
    const nextContent = createEditorContent(nextLanguage, value)

    setActiveLanguage(nextLanguage)
    contentRef.current = nextContent
    onUpdate(nextContent)
  }

  const currentLanguage = LANGUAGE_OPTIONS.find(option => option.id === activeLanguage) || LANGUAGE_OPTIONS[0]
  const currentThemeId = EDITOR_THEMES[settings.theme] ? settings.theme : DEFAULT_SETTINGS.theme
  const currentTheme = EDITOR_THEMES[currentThemeId]

  return (
    <section
      className="relative flex h-screen min-h-0 w-screen flex-col overflow-hidden"
      style={{ background: currentTheme.ui.page, color: currentTheme.ui.text }}
    >
      <nav
        className="flex h-[72px] shrink-0 items-center border-b px-4 sm:px-8"
        style={{ background: currentTheme.ui.chrome, borderColor: currentTheme.ui.border }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <a
            href="/"
            className="shrink-0 font-mono text-2xl font-bold tracking-normal"
          >
            <span style={{ color: currentTheme.ui.brandText }}>a</span>
            <span style={{ color: currentTheme.ui.brandAccent }}>.it</span>
          </a>
          <span className="text-xl" style={{ color: currentTheme.ui.border }}>
            →
          </span>
          <div className="truncate text-lg font-medium sm:text-xl" style={{ color: currentTheme.ui.muted }}>
            {title}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {status}
          {actions}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen(value => !value)}
              className="rounded-md p-2 transition hover:bg-white/10"
              style={{ color: currentTheme.ui.muted }}
              title="Editor settings"
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {settingsOpen && (
              <SettingsPanel
                settings={settings}
                onChange={setSettings}
                onClose={() => setSettingsOpen(false)}
                language={activeLanguage}
                onLanguageChange={handleLanguageChange}
                theme={currentTheme}
              />
            )}
          </div>
        </div>
      </nav>

      <main className="relative min-h-0 flex-1">
        {prefersTouchEditor ? (
          <TouchEditor
            value={value}
            onChange={handleChange}
            onSave={() => onUpdate(contentRef.current)}
            editable={editable}
            settings={settings}
            theme={currentTheme}
            language={activeLanguage}
          />
        ) : (
          <MonacoEditor
            className="h-full w-full"
            language={currentLanguage.language}
            path="note"
            value={value}
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
            theme={`anota-${currentThemeId}`}
          />
        )}
      </main>
    </section>
  )
}
