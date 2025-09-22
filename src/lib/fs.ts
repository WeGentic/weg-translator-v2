import { invoke } from '@tauri-apps/api/core'

export type PathInfo = {
  exists: boolean
  isFile: boolean
  isDir: boolean
}

export async function pathExists(path: string): Promise<PathInfo> {
  const tuple = await invoke<[boolean, boolean, boolean]>('path_exists', { path })
  const [exists, isFile, isDir] = tuple
  return { exists, isFile, isDir }
}
