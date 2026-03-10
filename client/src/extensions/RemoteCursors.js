import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const RemoteCursorsKey = new PluginKey('remoteCursors')

function getContrastColor(hexColor) {
  // Convert hex to RGB and calculate relative luminance
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

function createCursorWidget(user) {
  const wrapper = document.createElement('span')
  wrapper.className = 'remote-cursor-caret'
  wrapper.setAttribute('data-user-id', user.userId)
  wrapper.style.cssText = `
    display: inline-block;
    width: 2px;
    height: 1.2em;
    background-color: ${user.color};
    position: relative;
    vertical-align: text-bottom;
    pointer-events: none;
    margin-left: -1px;
    margin-right: -1px;
    z-index: 20;
  `

  const label = document.createElement('span')
  label.className = 'remote-cursor-label'
  label.textContent = user.name
  label.style.cssText = `
    position: absolute;
    top: -1.6em;
    left: 0;
    background: ${user.color};
    color: ${getContrastColor(user.color)};
    font-size: 10px;
    line-height: 1.3;
    padding: 1px 5px;
    border-radius: 3px 3px 3px 0;
    white-space: nowrap;
    font-weight: bold;
    pointer-events: none;
    user-select: none;
    z-index: 21;
  `

  wrapper.appendChild(label)
  return wrapper
}

function buildDecorations(cursors, doc) {
  const decos = []
  const docSize = doc.content.size

  for (const [userId, user] of Object.entries(cursors)) {
    if (!user || typeof user.head !== 'number') continue

    const head = Math.min(Math.max(0, user.head), docSize)
    const anchor = Math.min(Math.max(0, user.anchor ?? user.head), docSize)

    // Cursor caret widget
    decos.push(
      Decoration.widget(head, () => createCursorWidget(user), {
        id: `cursor-${userId}`,
        side: 1,
        key: `cursor-${userId}`,
      })
    )

    // Selection highlight (if there is a selection range)
    if (anchor !== head) {
      const from = Math.min(anchor, head)
      const to = Math.max(anchor, head)
      decos.push(
        Decoration.inline(from, to, {
          style: `background-color: ${user.color}33;`,
          class: 'remote-selection',
        })
      )
    }
  }

  return DecorationSet.create(doc, decos)
}

export const RemoteCursorsExtension = Extension.create({
  name: 'remoteCursors',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: RemoteCursorsKey,

        state: {
          init() {
            return { cursors: {}, decos: DecorationSet.empty }
          },

          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(RemoteCursorsKey)
            if (meta) {
              const cursors = { ...prev.cursors }

              if (meta.type === 'update') {
                cursors[meta.userId] = {
                  userId: meta.userId,
                  head: meta.cursor.head,
                  anchor: meta.cursor.anchor,
                  color: meta.color,
                  name: meta.name,
                }
              } else if (meta.type === 'remove') {
                delete cursors[meta.userId]
              }

              return { cursors, decos: buildDecorations(cursors, newState.doc) }
            }

            // Map decorations through document changes
            return {
              cursors: prev.cursors,
              decos: prev.decos.map(tr.mapping, tr.doc),
            }
          },
        },

        props: {
          decorations(state) {
            return RemoteCursorsKey.getState(state)?.decos
          },
        },
      }),
    ]
  },
})
