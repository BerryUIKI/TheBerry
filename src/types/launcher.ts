export interface LauncherItem {
  id: string;
  name: string;
  description: string;
  exec_path: string;
  arguments: string[];
  working_dir?: string | null;
  category: string;
  is_favorite: boolean;
  is_batch: boolean;
  batch_commands: string[];
  launch_count: number;
  created_at: string;
  updated_at: string;
}

export interface LauncherPayload {
  id?: string;
  name: string;
  description?: string;
  exec_path: string;
  arguments?: string[];
  working_dir?: string;
  category?: string;
  is_favorite?: boolean;
  is_batch?: boolean;
  batch_commands?: string[];
}
