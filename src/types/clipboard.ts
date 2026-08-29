export interface ClipboardItem {
  id: string;
  content_type: "text" | "image" | "file" | "html";
  content: string;
  preview: string;
  is_pinned: boolean;
  char_count: number;
  created_at: string;
}
