import { invoke } from '@tauri-apps/api/core'

export type PathInfo = {
  exists: boolean
  isFile: boolean
  isDir: boolean
}

export async function pathExists(path: string): Promise<PathInfo> {
  const tuple = (await invoke('path_exists', { path })) as [boolean, boolean, boolean]
  const [exists, isFile, isDir] = tuple
  return { exists, isFile, isDir }
}

