export interface LauncherItem {
  id: string;
  name: string;
  description: string;
  exec_path: string;
  arguments: string[];
  working_dir?: string;
  category: string;
  icon_path?: string;
  is_favorite: boolean;
  launch_count: number;
  is_batch: boolean;
  batch_commands: string[];
  created_at: string;
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

export interface DiscoveredApp {
  name: string;
  exec_path: string;
  category: string;
  icon_hint?: string;
}
