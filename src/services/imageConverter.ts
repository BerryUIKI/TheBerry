import { safeInvoke } from "./tauri";
import { ConvertResult, ConvertTask } from "../types/imageConverter";

export async function convertImages(tasks: ConvertTask[]): Promise<ConvertResult[]> {
  return safeInvoke<ConvertResult[]>("convert_images", { tasks });
}

export async function convertSingleImage(task: ConvertTask): Promise<ConvertResult> {
  return safeInvoke<ConvertResult>("convert_single_image", { task });
}

export async function scanImagePaths(paths: string[], recursive: boolean = true): Promise<string[]> {
  return safeInvoke<string[]>("scan_image_paths", { paths, recursive });
}

