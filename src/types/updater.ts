export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_notes: string;
  release_url: string;
  download_url?: string;
  asset_name?: string;
  published_at?: string;
}

export interface DownloadProgress {
  bytes_downloaded: number;
  total_bytes?: number;
  percent: number;
  done: boolean;
  status: string;
}
