import { createLowlight } from 'lowlight'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import markdown from 'highlight.js/lib/languages/markdown'
import xml from 'highlight.js/lib/languages/xml'

// Only the grammars offered in LANGUAGE_OPTIONS — importing the lowlight
// root would pull every highlight.js grammar into the bundle.
export const lowlight = createLowlight({ css, javascript, markdown, xml })
