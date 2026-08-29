export interface ConvertTask {
  source_path: string;
  target_format: "webp" | "jpeg" | "png";
  quality: number; // 1-100
  output_dir?: string;
  resize_width?: number;
  resize_height?: number;
  preserve_aspect_ratio?: boolean;
}

export interface ConvertResult {
  source_path: string;
  target_path: string;
  original_size_bytes: number;
  converted_size_bytes: number;
  success: boolean;
  error_message?: string;
  width: number;
  height: number;
}
