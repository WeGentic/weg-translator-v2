export interface FileDescriptor {
  path: string;
  name: string;
  directory: string;
}

export function toFileDescriptor(path: string): FileDescriptor {
  const segments = path.split(/[\\/]/);
  const name = segments.length > 0 ? segments[segments.length - 1] : path;
  const directory = segments.slice(0, -1).join("/") || "/";
  return { path, name, directory };
}
