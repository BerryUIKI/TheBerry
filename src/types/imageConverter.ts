export interface ConvertTask {
  source_path: string;
  target_format: "png" | "jpeg" | "webp";
  quality?: number;
  output_dir?: string;
}

export interface ConvertResult {
  source_path: string;
  output_path: string | null;
  original_size_bytes: number;
  converted_size_bytes: number | null;
  success: boolean;
  error_message: string | null;
}
