import { validateProject, type Project } from "./model";

const DB = "signalpath-planner";
export function openStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("projects");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("Browser storage is unavailable."));
    req.onblocked = () =>
      reject(new Error("Storage upgrade blocked by another tab."));
  });
}
export async function saveProject(project: Project): Promise<void> {
  const db = await openStorage();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(project, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Save aborted."));
    });
  } finally {
    db.close();
  }
}
export async function loadProject(): Promise<Project | null> {
  const db = await openStorage();
  try {
    return await new Promise<Project | null>((resolve, reject) => {
      const tx = db.transaction("projects", "readonly");
      const req = tx.objectStore("projects").get("current");
      req.onsuccess = () => {
        try {
          resolve(req.result ? validateProject(req.result) : null);
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 2);
}
export function parseProject(text: string): Project {
  if (text.length > 10_000_000)
    throw new Error("Project is too large (10 MB maximum).");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  return validateProject(value);
}
