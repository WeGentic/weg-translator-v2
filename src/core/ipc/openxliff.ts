import { Command } from '@tauri-apps/plugin-shell'

type ExecResult = {
  code: number | null
  signal: number | null
  stdout: string
  stderr: string
}

type StreamHandlers = {
  onStdout?: (line: string) => void
  onStderr?: (line: string) => void
}

type KnownError = {
  type: string
  message: string
  detail?: string
}

type NormalizedResult = ExecResult & {
  ok: boolean
  knownError?: KnownError
  message?: string
}

function firstNonEmptyLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
}

function detectKnownError(stdout: string, stderr: string): KnownError | undefined {
  const combined = [stderr, stdout].filter(Boolean).join('\n')
  const patterns: Array<{
    type: string
    pattern: RegExp
    message: string | ((match: RegExpMatchArray) => string)
    detail?: (match: RegExpMatchArray) => string
  }> = [
    {
      type: 'missing_resources',
      pattern:
        /\[(convert|merge|xliffchecker) wrapper\].*Could not locate OpenXLIFF resources/i,
      message:
        'OpenXLIFF components are missing; reinstall or run scripts/fetch-openxliff.sh',
      detail: (m) => m[0] ?? 'Missing OpenXLIFF resources',
    },
    {
      type: 'spawn',
      pattern: /ENOENT|No such file or directory|exec format error/i,
      message: 'Failed to start sidecar (missing or incompatible binary).',
    },
    {
      type: 'missing_source',
      pattern: /ERROR:\s*Source file does not exist/i,
      message: 'Source file does not exist or cannot be read.',
    },
    {
      type: 'missing_argument',
      pattern: /Missing -(srcLang|tgtLang|xliff) parameter/i,
      message: (match) => `Missing required -${match[1]} parameter.`,
      detail: (match) => `Missing -${match[1]} parameter`,
    },
    {
      type: 'conversion_error',
      pattern: /ERROR:\s*Conversion error:\s*(.+)/i,
      message: (match) => match[1]?.trim() ?? 'Conversion failed.',
      detail: (match) => match[1]?.trim(),
    },
    {
      type: 'xliff_validation',
      pattern: /Content is not allowed in prolog/i,
      message: 'XLIFF contains content before the XML prolog.',
    },
    {
      type: 'xliff_validation',
      pattern: /Content found outside of outermost element/i,
      message: 'XLIFF has content outside of the root element.',
    },
    {
      type: 'xliff_validation',
      pattern: /invalid child .*?element/i,
      message: 'XLIFF structure has unexpected elements.',
    },
    {
      type: 'xliff_version',
      pattern: /XLIFF version mismatch|Unsupported XLIFF/i,
      message: 'Unsupported or mismatched XLIFF version.',
    },
    {
      type: 'encoding',
      pattern: /An error occurred while parsing EntityName|Invalid byte \d+/i,
      message: 'The file contains invalid XML characters or encoding issues.',
    },
    {
      type: 'catalog_missing',
      pattern: /Catalog file .* does not exist/i,
      message: 'Configured catalog file could not be found.',
    },
    {
      type: 'permission',
      pattern: /Permission denied/i,
      message: 'Access denied while reading or writing a file.',
    },
  ]

  for (const entry of patterns) {
    const match = combined.match(entry.pattern)
    if (match) {
      const message =
        typeof entry.message === 'function' ? entry.message(match) : entry.message
      const detail = entry.detail ? entry.detail(match) ?? message : message
      return { type: entry.type, message, detail }
    }
  }

  const missingFile = combined.match(/java\.nio\.file\.NoSuchFileException:\s*(.+)/i)
  if (missingFile?.[1]) {
    const detail = missingFile[1].trim()
    return {
      type: 'missing_file',
      message: `Referenced file was not found: ${detail}`,
      detail,
    }
  }

  const saxLine = combined.match(/SAXParseException;[^:]*: (.+)/i)
  if (saxLine?.[1]) {
    const detail = saxLine[1].trim()
    return {
      type: 'xml_parse',
      message: `Invalid XML: ${detail}`,
      detail,
    }
  }

  return undefined
}

function sidecarPath(name: string) {
  const isWindows = navigator.userAgent.includes('Windows')
  const script = isWindows ? `${name}.cmd` : `${name}.sh`
  return `sidecars/openxliff/bin/${script}`
}

async function run(name: string, args: string[]): Promise<ExecResult> {
  const sc = sidecarPath(name)
  const cmd = Command.sidecar(sc, args)
  const out = await cmd.execute()
  return { code: out.code, signal: out.signal, stdout: out.stdout, stderr: out.stderr }
}

async function runStream(
  name: string,
  args: string[],
  handlers?: StreamHandlers
): Promise<ExecResult> {
  const sc = sidecarPath(name)
  const cmd = Command.sidecar(sc, args)

  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []

  if (handlers?.onStdout) {
    cmd.stdout.on('data', (line) => {
      stdoutChunks.push(line)
      handlers.onStdout?.(line)
    })
  } else {
    cmd.stdout.on('data', (line) => {
      stdoutChunks.push(line)
    })
  }

  if (handlers?.onStderr) {
    cmd.stderr.on('data', (line) => {
      stderrChunks.push(line)
      handlers.onStderr?.(line)
    })
  } else {
    cmd.stderr.on('data', (line) => {
      stderrChunks.push(line)
    })
  }

  try {
    await cmd.spawn()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Return a synthetic ExecResult so callers can normalize and extract a helpful error
    return { code: null, signal: null, stdout: '', stderr: msg }
  }

  return await new Promise<ExecResult>((resolve) => {
    cmd.on('close', ({ code, signal }) => {
      resolve({ code, signal, stdout: stdoutChunks.join('\n'), stderr: stderrChunks.join('\n') })
    })
  })
}

function normalizeResult(res: ExecResult): NormalizedResult {
  const stdout = res.stdout || ''
  const stderr = res.stderr || ''
  const knownError = detectKnownError(stdout, stderr)
  const errorKeyword = /(ERROR|Exception|Caused by|SEVERE|FATAL|Traceback)/i
  const hasErrorKeyword = errorKeyword.test(stderr)

  const ok = res.code === 0 && !hasErrorKeyword && !knownError
  if (ok) {
    return { ...res, ok: true }
  }

  if (/Usage:|^convert\.(cmd|sh)|^merge\.(cmd|sh)|^xliffchecker\.(cmd|sh)/mi.test(stderr)) {
    return {
      ...res,
      ok: false,
      knownError: {
        type: 'usage',
        message: 'Invalid or missing arguments. Check the provided options.',
        detail: 'Invalid or missing arguments',
      },
      message: 'Invalid or missing arguments. Check the provided options.',
    }
  }

  const firstLine = firstNonEmptyLine(stderr || stdout)
  if (knownError) {
    return { ...res, ok: false, knownError, message: knownError.message }
  }

  return {
    ...res,
    ok: false,
    knownError: firstLine
      ? { type: 'unknown', message: firstLine, detail: firstLine }
      : undefined,
    message: firstLine ?? 'Command failed.',
  }
}

// Quick preflight check to verify the sidecar + resources are available.
export async function checkOpenXliffRuntime(): Promise<{
  ok: boolean
  message?: string
  detail?: string
}> {
  try {
    // Use a lightweight help check that satisfies capability allowlists
    const res = await runStream('xliffchecker', ['-help'])
    const normalized = normalizeResult(res)
    if (normalized.ok || normalized.knownError?.type === 'usage') return { ok: true }
    const msg = normalized.knownError?.message || normalized.message || 'OpenXLIFF not available.'
    const detail = normalized.knownError?.detail || firstNonEmptyLine(normalized.stderr || normalized.stdout)
    return { ok: false, message: msg, detail }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to run OpenXLIFF sidecar.'
    return { ok: false, message: msg, detail: msg }
  }
}

export async function convert(opts: {
  file: string
  srcLang: string
  tgtLang?: string
  xliff?: string
  version?: '2.0' | '2.1' | '2.2'
  type?: string
  srx?: string
  catalog?: string
  config?: string
  paragraph?: boolean
  embed?: boolean
  // Extended options supported by OpenXLIFF
  skl?: string
  enc?: string
  ditaval?: string
  xmlfilter?: string
  ignoretc?: boolean
  ignoresvg?: boolean
}): Promise<ExecResult> {
  // Order strictly matches src-tauri/capabilities/default.json allowlist
  const args: string[] = ['-file', opts.file, '-srcLang', opts.srcLang]
  if (opts.tgtLang) args.push('-tgtLang', opts.tgtLang)
  if (opts.skl) args.push('-skl', opts.skl)
  if (opts.xliff) args.push('-xliff', opts.xliff)
  if (opts.type) args.push('-type', opts.type)
  if (opts.enc) args.push('-enc', opts.enc)
  if (opts.srx) args.push('-srx', opts.srx)
  if (opts.catalog) args.push('-catalog', opts.catalog)
  if (opts.ditaval) args.push('-ditaval', opts.ditaval)
  if (opts.config) args.push('-config', opts.config)
  if (opts.embed) args.push('-embed')
  if (opts.paragraph) args.push('-paragraph')
  if (opts.xmlfilter) args.push('-xmlfilter', opts.xmlfilter)
  if (opts.ignoretc) args.push('-ignoretc')
  if (opts.ignoresvg) args.push('-ignoresvg')
  if (opts.version === '2.0') args.push('-2.0')
  if (opts.version === '2.1') args.push('-2.1')
  if (opts.version === '2.2') args.push('-2.2')
  if (import.meta.env.DEV) {
    console.debug('[openxliff] convertStream args', args)
  }
  return run('convert', args)
}

export async function merge(opts: {
  xliff: string
  target: string
  catalog?: string
  unapproved?: boolean
  exportTmx?: boolean
}): Promise<ExecResult> {
  const args: string[] = ['-xliff', opts.xliff, '-target', opts.target]
  if (opts.catalog) args.push('-catalog', opts.catalog)
  if (opts.unapproved) args.push('-unapproved')
  if (opts.exportTmx) args.push('-export')
  return run('merge', args)
}

export async function validate(opts: { xliff: string; catalog?: string }): Promise<ExecResult> {
  const args: string[] = ['-xliff', opts.xliff]
  if (opts.catalog) args.push('-catalog', opts.catalog)
  return run('xliffchecker', args)
}

// Streaming variants with stdout/stderr line handlers and normalized result
export async function convertStream(
  opts: Parameters<typeof convert>[0],
  handlers?: StreamHandlers
): Promise<NormalizedResult> {
  // Order strictly matches src-tauri/capabilities/default.json allowlist
  const args: string[] = ['-file', opts.file, '-srcLang', opts.srcLang]
  if (opts.tgtLang) args.push('-tgtLang', opts.tgtLang)
  if (opts.skl) args.push('-skl', opts.skl)
  if (opts.xliff) args.push('-xliff', opts.xliff)
  if (opts.type) args.push('-type', opts.type)
  if (opts.enc) args.push('-enc', opts.enc)
  if (opts.srx) args.push('-srx', opts.srx)
  if (opts.catalog) args.push('-catalog', opts.catalog)
  if (opts.ditaval) args.push('-ditaval', opts.ditaval)
  if (opts.config) args.push('-config', opts.config)
  if (opts.embed) args.push('-embed')
  if (opts.paragraph) args.push('-paragraph')
  if (opts.xmlfilter) args.push('-xmlfilter', opts.xmlfilter)
  if (opts.ignoretc) args.push('-ignoretc')
  if (opts.ignoresvg) args.push('-ignoresvg')
  if (opts.version === '2.0') args.push('-2.0')
  if (opts.version === '2.1') args.push('-2.1')
  if (opts.version === '2.2') args.push('-2.2')
  const res = await runStream('convert', args, handlers)
  return normalizeResult(res)
}

export async function mergeStream(
  opts: Parameters<typeof merge>[0],
  handlers?: StreamHandlers
): Promise<NormalizedResult> {
  const args: string[] = ['-xliff', opts.xliff, '-target', opts.target]
  if (opts.catalog) args.push('-catalog', opts.catalog)
  if (opts.unapproved) args.push('-unapproved')
  if (opts.exportTmx) args.push('-export')
  const res = await runStream('merge', args, handlers)
  return normalizeResult(res)
}

export async function validateStream(
  opts: Parameters<typeof validate>[0],
  handlers?: StreamHandlers
): Promise<NormalizedResult> {
  const args: string[] = ['-xliff', opts.xliff]
  if (opts.catalog) args.push('-catalog', opts.catalog)
  const res = await runStream('xliffchecker', args, handlers)
  return normalizeResult(res)
}
