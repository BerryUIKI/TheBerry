export interface ClipboardItem {
  id: string;
  content_type: string; // "text" | "image" | "file"
  content: string;
  preview: string;
  media_path: string | null;
  media_data_url: string | null;
  image_width: number | null;
  image_height: number | null;
  is_pinned: boolean;
  char_count: number;
  created_at: string;
}
