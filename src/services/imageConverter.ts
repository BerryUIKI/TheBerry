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

export async function getImageThumbnail(path: string): Promise<string | null> {
  return safeInvoke<string | null>("get_image_thumbnail", { path });
}
