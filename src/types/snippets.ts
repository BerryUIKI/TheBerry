export interface SnippetItem {
  id: string;
  title: string;
  description: string;
  content: string;
  language: string;
  category: string;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface SnippetPayload {
  id?: string;
  title: string;
  description?: string;
  content: string;
  language?: string;
  category?: string;
  tags?: string[];
  is_favorite?: boolean;
}
