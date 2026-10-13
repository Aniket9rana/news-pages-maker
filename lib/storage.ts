import { get, set } from "idb-keyval";
import type { Project } from "./types";

const KEY = "news-pages-maker:project";

export async function saveProject(p: Project): Promise<void> {
  try {
    await set(KEY, p);
  } catch {
    /* storage unavailable (private window, quota) — editing still works */
  }
}

export async function loadProject(): Promise<Project | null> {
  try {
    return ((await get(KEY)) as Project | undefined) ?? null;
  } catch {
    return null;
  }
}
