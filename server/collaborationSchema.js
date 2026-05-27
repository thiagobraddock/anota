import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

const extensions = [
  StarterKit.configure({
    codeBlock: false,
  }),
  Underline,
  Highlight,
  TaskList,
  TaskItem.configure({ nested: true }),
  CodeBlockLowlight.configure({ lowlight }),
];

export const EMPTY_NOTE_CONTENT = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
};

export const collaborationSchema = getSchema(extensions);

export function normalizeNoteContent(content) {
  if (content && content.type === "doc" && Array.isArray(content.content)) {
    return content;
  }

  return EMPTY_NOTE_CONTENT;
}
