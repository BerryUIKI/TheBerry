export interface ClipboardItem {
  id: string;
  content_type: string; // "text" | "image" | "file"
  content: string;
  preview: string;
  media_path?: string;
  media_data_url?: string;
  image_width?: number;
  image_height?: number;
  is_pinned: boolean;
  char_count: number;
  created_at: string;
}
