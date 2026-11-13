export function joinPath(base: string, ...parts: string[]): string {
  const head = base.replace(/[\\/]+$/, '')
  return [head, ...parts].join('\\')
}

export function fileNameOf(target: string): string {
  const parts = target.split(/[\\/]/)
  return parts[parts.length - 1] || target
}
