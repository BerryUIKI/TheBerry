import { safeInvoke } from "./tauri";
import { ConvertResult, ConvertTask } from "../types/imageConverter";

export async function convertImages(tasks: ConvertTask[]): Promise<ConvertResult[]> {
  return safeInvoke<ConvertResult[]>("convert_images", { tasks });
}
