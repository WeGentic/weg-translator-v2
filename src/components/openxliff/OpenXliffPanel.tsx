import { useCallback, useMemo, useState } from "react"
import { open, save } from "@tauri-apps/plugin-dialog"
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { convertStream, validateStream, mergeStream } from "@/lib/openxliff"
import { pathExists } from "@/lib/fs"
import { isWellFormedBcp47 } from "@/lib/validators"

type Version = "2.0" | "2.1" | "2.2"

export function OpenXliffPanel() {
  const [inputFile, setInputFile] = useState("")
  const [xliffOut, setXliffOut] = useState("")
  const [srcLang, setSrcLang] = useState("en-US")
  const [tgtLang, setTgtLang] = useState("it-IT")
  const [version, setVersion] = useState<Version>("2.1")
  const [docType, setDocType] = useState("")
  const [srx, setSrx] = useState("")
  const [catalog, setCatalog] = useState("")
  const [config, setConfig] = useState("")
  const [xmlfilter, setXmlfilter] = useState("")
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState("")
  const [status, setStatus] = useState("")

  const formValid = useMemo(() => {
    if (!inputFile) return false
    if (!isWellFormedBcp47(srcLang)) return false
    if (tgtLang && !isWellFormedBcp47(tgtLang)) return false
    return true
  }, [inputFile, srcLang, tgtLang])

  const pickInput = useCallback(async () => {
    const sel = await open({ multiple: false, directory: false })
    if (typeof sel === "string") {
      setInputFile(sel)
      if (!xliffOut) {
        try {
          const base = sel.split("/").pop() ?? "output"
          const stem = base.replace(/\.[^/.]+$/, "")
          setXliffOut(`${stem}.xlf`)
        } catch {
          // noop
        }
      }
    }
  }, [xliffOut])

  const pickXliff = useCallback(async () => {
    const sel = await save({
      defaultPath: xliffOut || "out.xlf",
      filters: [{ name: "XLIFF", extensions: ["xlf", "xliff"] }],
    })
    if (typeof sel === "string") setXliffOut(sel)
  }, [xliffOut])

  const revealXliff = useCallback(async () => {
    if (!xliffOut) return
    try {
      await revealItemInDir(xliffOut)
    } catch {
      await openPath(xliffOut)
    }
  }, [xliffOut])

  const pickFileInto = useCallback(async (setter: (p: string) => void) => {
    const sel = await open({ multiple: false, directory: false })
    if (typeof sel === "string") setter(sel)
  }, [])

  const pickFolderInto = useCallback(async (setter: (p: string) => void) => {
    const sel = await open({ multiple: false, directory: true })
    if (typeof sel === "string") setter(sel)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!formValid || running) return
    setRunning(true)
    setLog("")
    setStatus("")
    try {
      const info = await pathExists(inputFile)
      if (!info.exists || !info.isFile) {
        setStatus("Error: source file does not exist")
        return
      }
      const res = await convertStream(
        {
          file: inputFile,
          srcLang,
          tgtLang: tgtLang || undefined,
          xliff: xliffOut || undefined,
          version,
          type: docType || undefined,
          srx: srx || undefined,
          catalog: catalog || undefined,
          config: config || undefined,
          xmlfilter: xmlfilter || undefined,
        },
        {
          onStdout: (line) => setLog((prev) => (prev ? prev + "\n" + line : line)),
          onStderr: (line) => setLog((prev) => (prev ? prev + "\n[err] " + line : "[err] " + line)),
        }
      )
      if (res.ok) {
        setStatus(`Done (code ${res.code})`)
      } else if (res.message) {
        setStatus(`Error: ${res.message}`)
      } else {
        const codeLabel = res.code ?? 'unknown'
        setStatus(`Failed (code ${codeLabel})`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(`Error: ${msg}`)
    } finally {
      setRunning(false)
    }
  }, [docType, formValid, inputFile, running, srcLang, tgtLang, version, xliffOut])

  const handleValidate = useCallback(async () => {
    if (!xliffOut || running) return
    setRunning(true)
    setLog("")
    setStatus("")
    try {
      const info = await pathExists(xliffOut)
      if (!info.exists || !info.isFile) {
        setStatus("Error: XLIFF file not found")
        return
      }
      const res = await validateStream(
        { xliff: xliffOut },
        {
          onStdout: (line) => setLog((prev) => (prev ? prev + "\n" + line : line)),
          onStderr: (line) => setLog((prev) => (prev ? prev + "\n[err] " + line : "[err] " + line)),
        }
      )
      if (res.ok) {
        setStatus(`Valid (code ${res.code})`)
      } else if (res.message) {
        setStatus(`Invalid: ${res.message}`)
      } else {
        const codeLabel = res.code ?? 'unknown'
        setStatus(`Invalid (code ${codeLabel})`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(`Error: ${msg}`)
    } finally {
      setRunning(false)
    }
  }, [running, xliffOut])

  const [mergeIn, setMergeIn] = useState("")
  const [mergeOut, setMergeOut] = useState("")
  const handlePickMergeIn = useCallback(async () => {
    const sel = await open({ multiple: false, directory: false, filters: [{ name: "XLIFF", extensions: ["xlf","xliff"] }] })
    if (typeof sel === "string") setMergeIn(sel)
  }, [])
  const handlePickMergeOut = useCallback(async () => {
    const sel = await save({ defaultPath: mergeOut || "output.docx" })
    if (typeof sel === "string") setMergeOut(sel)
  }, [mergeOut])
  const handleMerge = useCallback(async () => {
    if (!mergeIn || !mergeOut || running) return
    setRunning(true)
    setLog("")
    setStatus("")
    try {
      const infoIn = await pathExists(mergeIn)
      if (!infoIn.exists || !infoIn.isFile) {
        setStatus("Error: merge XLIFF file not found")
        return
      }
      const res = await mergeStream(
        { xliff: mergeIn, target: mergeOut, catalog: catalog || undefined },
        { onStdout: (l) => setLog((p) => (p ? p + "\n" + l : l)), onStderr: (l) => setLog((p) => (p ? p + "\n[err] " + l : "[err] " + l)) }
      )
      if (res.ok) {
        setStatus(`Merged (code ${res.code})`)
      } else if (res.message) {
        setStatus(`Merge failed: ${res.message}`)
      } else {
        const codeLabel = res.code ?? 'unknown'
        setStatus(`Merge failed (code ${codeLabel})`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(`Error: ${msg}`)
    } finally { setRunning(false) }
  }, [catalog, mergeIn, mergeOut, mergeStream, running])

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle>OpenXLIFF Actions</CardTitle>
        <CardDescription>Convert documents to XLIFF and validate output.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Source file</Label>
            <div className="flex gap-2">
              <Input value={inputFile} onChange={(e) => setInputFile(e.target.value)} placeholder="Select a file…" />
              <Button type="button" variant="outline" onClick={pickInput}>Browse</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Output XLIFF</Label>
            <div className="flex gap-2">
              <Input value={xliffOut} onChange={(e) => setXliffOut(e.target.value)} placeholder="out.xlf" />
              <Button type="button" variant="outline" onClick={pickXliff}>Save As</Button>
              <Button type="button" variant="outline" onClick={revealXliff} disabled={!xliffOut}>Reveal</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Source language</Label>
            <Input value={srcLang} onChange={(e) => setSrcLang(e.target.value)} placeholder="e.g. en-US" aria-invalid={!isWellFormedBcp47(srcLang)} />
          </div>
          <div className="grid gap-2">
            <Label>Target language (optional)</Label>
            <Input value={tgtLang} onChange={(e) => setTgtLang(e.target.value)} placeholder="e.g. it-IT" aria-invalid={!!tgtLang && !isWellFormedBcp47(tgtLang)} />
          </div>
          <div className="grid gap-2">
            <Label>Version</Label>
            <select
              className="border-input dark:bg-input/30 h-9 rounded-md border bg-background px-3 text-sm"
              value={version}
              onChange={(e) => setVersion(e.target.value as Version)}
            >
              <option value="2.0">2.0</option>
              <option value="2.1">2.1</option>
              <option value="2.2">2.2</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Type (optional)</Label>
            <Input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="e.g. docx, pptx, dita" />
          </div>
          <div className="grid gap-2">
            <Label>SRX (optional)</Label>
            <div className="flex gap-2">
              <Input value={srx} onChange={(e) => setSrx(e.target.value)} placeholder="path/to/segmentation.srx" />
              <Button type="button" variant="outline" onClick={() => void pickFileInto(setSrx)}>Browse</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Catalog (optional)</Label>
            <div className="flex gap-2">
              <Input value={catalog} onChange={(e) => setCatalog(e.target.value)} placeholder="path/to/catalog.xml" />
              <Button type="button" variant="outline" onClick={() => void pickFileInto(setCatalog)}>Browse</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Config (optional)</Label>
            <div className="flex gap-2">
              <Input value={config} onChange={(e) => setConfig(e.target.value)} placeholder="path/to/config.json" />
              <Button type="button" variant="outline" onClick={() => void pickFileInto(setConfig)}>Browse</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>XML Filter folder (optional)</Label>
            <div className="flex gap-2">
              <Input value={xmlfilter} onChange={(e) => setXmlfilter(e.target.value)} placeholder="folder with filter configs" />
              <Button type="button" variant="outline" onClick={() => void pickFolderInto(setXmlfilter)}>Browse</Button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleConvert} disabled={!formValid || running} aria-busy={running}>
            {running ? "Converting…" : "Convert"}
          </Button>
          <Button variant="outline" onClick={handleValidate} disabled={!xliffOut || running} aria-busy={running}>
            {running ? "Checking…" : "Validate XLIFF"}
          </Button>
          {status && <span className="text-sm text-muted-foreground">{status}</span>}
        </div>

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Merge XLIFF</Label>
            <div className="flex gap-2">
              <Input value={mergeIn} onChange={(e) => setMergeIn(e.target.value)} placeholder="Select XLIFF…" />
              <Button type="button" variant="outline" onClick={handlePickMergeIn}>Browse</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Target Output</Label>
            <div className="flex gap-2">
              <Input value={mergeOut} onChange={(e) => setMergeOut(e.target.value)} placeholder="path/to/output" />
              <Button type="button" variant="outline" onClick={handlePickMergeOut}>Save As</Button>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <Button onClick={handleMerge} disabled={!mergeIn || !mergeOut || running} aria-busy={running}>
              {running ? "Merging…" : "Merge back"}
            </Button>
            <p className="text-xs text-muted-foreground">Rebuild target document from XLIFF.</p>
          </div>
        </div>

        {log && (
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs text-foreground/90">
            {log}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}
