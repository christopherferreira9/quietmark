"use client";

import { ChangeEvent, DragEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { canvasToBlob, createZip, drawWatermark, imageMime, loadImage, outputName, Settings } from "./image-utils";

type InputImage = { id: string; file: File; url: string };
type ResultImage = { id: string; name: string; blob: Blob; url: string };

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/bmp"]);
const initialSettings: Settings = {
  text: "Shared for mortgage transfer · Oct 2026",
  direction: "diagonal",
  size: 13,
  opacity: 18,
  spacing: 1,
};

function drawSample(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "#e9e6df";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#f7f6f1";
  ctx.fillRect(140, 34, 720, 594);
  ctx.shadowColor = "rgba(40,40,35,.12)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 12;
  ctx.fillRect(140, 34, 720, 594);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#344a43";
  ctx.fillRect(190, 86, 44, 44);
  ctx.fillStyle = "#f7f6f1";
  ctx.font = "bold 22px Arial";
  ctx.fillText("M", 203, 116);
  ctx.fillStyle = "#293b36";
  ctx.font = "bold 22px Georgia, serif";
  ctx.fillText("DOCUMENT SUMMARY", 190, 186);
  ctx.fillStyle = "#7c837e";
  ctx.font = "13px Arial";
  ctx.fillText("PERSONAL RECORD  /  OCTOBER 2026", 190, 215);
  ctx.fillStyle = "#dbddd7";
  ctx.fillRect(190, 242, 620, 1);
  ctx.fillStyle = "#67736c";
  ctx.font = "12px Arial";
  ctx.fillText("REFERENCE", 190, 283);
  ctx.fillText("DATE ISSUED", 525, 283);
  ctx.fillStyle = "#303f39";
  ctx.font = "16px Arial";
  ctx.fillText("MT-2026-1048", 190, 313);
  ctx.fillText("09 October 2026", 525, 313);
  ctx.fillStyle = "#dbddd7";
  ctx.fillRect(190, 345, 620, 1);
  ctx.fillStyle = "#67736c";
  ctx.font = "12px Arial";
  ctx.fillText("DETAILS", 190, 386);
  [0, 1, 2, 3].forEach((row) => {
    ctx.fillStyle = row === 0 ? "#aab4ad" : "#d4d8d2";
    ctx.fillRect(190, 408 + row * 32, row === 3 ? 330 : 575 - row * 35, 9);
  });
  ctx.fillStyle = "#eff1eb";
  ctx.fillRect(190, 555, 620, 34);
  ctx.fillStyle = "#84918a";
  ctx.font = "11px Arial";
  ctx.fillText("CONFIDENTIAL  ·  SHARED COPY", 206, 577);
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function download(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
}

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [files, setFiles] = useState<InputImage[]>([]);
  const [selected, setSelected] = useState(0);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [results, setResults] = useState<ResultImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Add images to get started.");
  const [dragging, setDragging] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Set<string>>(new Set());
  const resultUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => {
      try {
        const saved = localStorage.getItem("quietmark-theme");
        if (saved === "light" || saved === "dark") {
          document.documentElement.dataset.theme = saved;
          setTheme(saved);
        } else {
          const systemTheme = media.matches ? "dark" : "light";
          document.documentElement.dataset.theme = systemTheme;
          setTheme(systemTheme);
        }
      } catch {
        setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
      }
    };
    applySystemTheme();
    media.addEventListener("change", applySystemTheme);
    return () => media.removeEventListener("change", applySystemTheme);
  }, []);

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem("quietmark-theme", next); } catch { /* Storage may be unavailable. */ }
  }

  useEffect(() => () => {
    urlsRef.current.forEach(URL.revokeObjectURL);
    resultUrlsRef.current.forEach(URL.revokeObjectURL);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canvas = previewRef.current;
    if (!canvas) return;
    const current = files[selected];
    async function render() {
      if (!canvas) return;
      try {
        if (current) {
          const image = await loadImage(current.url);
          if (cancelled) return;
          const scale = Math.min(1000 / image.naturalWidth, 660 / image.naturalHeight, 1);
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.scale(scale, scale);
          ctx.drawImage(image, 0, 0);
          drawWatermark(ctx, image.naturalWidth, image.naturalHeight, settings);
        } else {
          canvas.width = 1000;
          canvas.height = 660;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          drawSample(ctx, canvas.width, canvas.height);
          drawWatermark(ctx, canvas.width, canvas.height, settings);
        }
      } catch {
        if (!cancelled) setStatus("This browser could not preview the selected image.");
      }
    }
    void render();
    return () => { cancelled = true; };
  }, [files, selected, settings]);

  function clearResults() {
    resultUrlsRef.current.forEach(URL.revokeObjectURL);
    resultUrlsRef.current.clear();
    setResults([]);
  }

  function updateSettings(change: Partial<Settings>) {
    if (busy) return;
    clearResults();
    setSettings(previous => ({ ...previous, ...change }));
    setStatus(files.length ? "Ready to generate your images." : "Add images to get started.");
  }

  function addFiles(items: FileList | File[]) {
    if (busy) return;
    const chosen = Array.from(items);
    const valid = chosen.filter(file => acceptedTypes.has(file.type));
    if (!valid.length) {
      setStatus("Choose JPG, PNG, WebP, AVIF, GIF, or BMP images.");
      return;
    }
    clearResults();
    const next = valid.map(file => {
      const url = URL.createObjectURL(file);
      urlsRef.current.add(url);
      return { id: `${Date.now()}-${Math.random()}`, file, url };
    });
    setFiles(previous => [...previous, ...next]);
    setStatus(chosen.length === valid.length ? `${valid.length} image${valid.length === 1 ? "" : "s"} added. Ready to generate.` : `${valid.length} image${valid.length === 1 ? "" : "s"} added; unsupported files were skipped.`);
  }

  function removeFile(id: string) {
    if (busy) return;
    const target = files.find(file => file.id === id);
    if (target) {
      URL.revokeObjectURL(target.url);
      urlsRef.current.delete(target.url);
    }
    clearResults();
    setFiles(previous => previous.filter(file => file.id !== id));
    setSelected(0);
    setStatus(files.length > 1 ? "Ready to generate your images." : "Add images to get started.");
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function onDropKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  }

  async function generate() {
    if (!files.length || !settings.text.trim() || busy) return;
    clearResults();
    setBusy(true);
    const generated: ResultImage[] = [];
    let failed = 0;
    const names = new Set<string>();
    try {
      for (let index = 0; index < files.length; index++) {
        const item = files[index];
        setStatus(`Processing ${index + 1} of ${files.length}: ${item.file.name}`);
        try {
          const image = await loadImage(item.url);
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas is unavailable.");
          ctx.drawImage(image, 0, 0);
          drawWatermark(ctx, canvas.width, canvas.height, settings);
          const mime = imageMime(item.file);
          const blob = await canvasToBlob(canvas, mime);
          let name = outputName(item.file.name, blob.type || mime);
          let suffix = 2;
          while (names.has(name)) {
            name = outputName(item.file.name, blob.type || mime).replace(/(\.[^.]+)$/, `-${suffix++}$1`);
          }
          names.add(name);
          const url = URL.createObjectURL(blob);
          resultUrlsRef.current.add(url);
          generated.push({ id: item.id, name, blob, url });
          canvas.width = 0;
          canvas.height = 0;
        } catch {
          failed++;
        }
      }
      setResults(generated);
      setStatus(generated.length ? `${generated.length} image${generated.length === 1 ? "" : "s"} ready${failed ? `; ${failed} could not be processed` : ""}.` : "No images could be processed. Try another file format or a smaller image.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadAll() {
    if (!results.length) return;
    setStatus("Preparing your ZIP download…");
    try {
      const zip = await createZip(results.map(({ name, blob }) => ({ name, blob })));
      const url = URL.createObjectURL(zip);
      download(url, "quietmark-images.zip");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus(`${results.length} images downloaded as a ZIP.`);
    } catch {
      setStatus("Could not prepare the ZIP. Download the images individually instead.");
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Quietmark home"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span><span>quietmark<span className="brand-dot">.</span></span></Link>
      <div className="topbar-actions"><div className="topbar-note"><span className="privacy-symbol" aria-hidden="true">✳</span> Private by design <span className="topbar-divider"/> Images stay on your device</div><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={theme === "dark"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> : <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.1 15.7A8.5 8.5 0 0 1 8.3 3.9 8.5 8.5 0 1 0 20.1 15.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>}<span>{theme === "dark" ? "Light" : "Dark"}</span></button></div>
    </header>

    <main>
      <section className="intro" aria-labelledby="page-title"><div className="eyebrow"><span className="eyebrow-line"/> THE THOUGHTFUL WAY TO SHARE</div><h1 id="page-title">Give every shared image<br/><em>a little context.</em></h1><p>Add a subtle, repeating note across documents and photos before they leave your hands. Made for the things you need to share, but want to keep yours.</p></section>

      <div className="workspace">
        <section className="control-panel" aria-label="Watermark settings">
          <div className="panel-heading"><span className="step">01</span><div><h2>Your images</h2><p>Add one or more images to watermark</p></div></div>
          <div className={`drop-zone${dragging ? " dragging" : ""}`} role="button" tabIndex={busy ? -1 : 0} aria-disabled={busy} aria-label="Choose images or drop images here" onClick={() => !busy && inputRef.current?.click()} onKeyDown={onDropKey} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={event => { event.preventDefault(); setDragging(false); }} onDrop={onDrop}>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp" multiple hidden disabled={busy} onChange={onInput}/>
            <span className="upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15.5v2.75C4 19.216 4.784 20 5.75 20h12.5c.966 0 1.75-.784 1.75-1.75V15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            <strong>Drop your images here</strong><span>or <span className="text-link">browse files</span> from your device</span><small>JPG, PNG, WebP, AVIF, GIF or BMP</small>
          </div>
          {files.length > 0 && <div className="file-list" aria-label="Added images">{files.map((item, index) => <div className={`file-item${selected === index ? " selected" : ""}`} key={item.id}><button type="button" className="file-select" onClick={() => setSelected(index)} aria-label={`Preview ${item.file.name}`}><span className="file-thumbnail"><img src={item.url} alt=""/></span><span className="file-details"><strong title={item.file.name}>{item.file.name}</strong><small>{formatSize(item.file.size)}</small></span></button><button className="remove-file" type="button" disabled={busy} onClick={() => removeFile(item.id)} aria-label={`Remove ${item.file.name}`}>×</button></div>)}</div>}

          <div className="section-rule"/>
          <div className="panel-heading"><span className="step">02</span><div><h2>Your watermark</h2><p>A quiet reminder of why it was shared</p></div></div>
          <label className="field-label" htmlFor="watermark-text">Watermark text</label>
          <textarea id="watermark-text" rows={2} maxLength={160} spellCheck={false} disabled={busy} placeholder="e.g. Shared for mortgage transfer · Oct 2026" value={settings.text} onChange={event => updateSettings({ text: event.target.value })}/>
          <div className="field-help"><span>Include the recipient and purpose for traceability.</span><span>{settings.text.length} / 160</span></div>

          <div className="option-row"><div><div className="field-label">Direction</div><div className="field-subtitle">How the text repeats</div></div><div className="segmented" role="group" aria-label="Watermark direction"><button type="button" className={settings.direction === "diagonal" ? "segment active" : "segment"} aria-pressed={settings.direction === "diagonal"} onClick={() => updateSettings({ direction: "diagonal" })}>Diagonal</button><button type="button" className={settings.direction === "horizontal" ? "segment active" : "segment"} aria-pressed={settings.direction === "horizontal"} onClick={() => updateSettings({ direction: "horizontal" })}>Horizontal</button></div></div>
          <div className="slider-row"><div><label className="field-label" htmlFor="size-slider">Text size</label><div className="field-subtitle">Keep it small and unobtrusive</div></div><div className="slider-control"><input id="size-slider" type="range" min="9" max="24" value={settings.size} onChange={event => updateSettings({ size: Number(event.target.value) })}/><span>{settings.size} px</span></div></div>
          <div className="slider-row"><div><label className="field-label" htmlFor="opacity-slider">Visibility</label><div className="field-subtitle">Light grey on the image</div></div><div className="slider-control"><input id="opacity-slider" type="range" min="8" max="35" value={settings.opacity} onChange={event => updateSettings({ opacity: Number(event.target.value) })}/><span>{settings.opacity}%</span></div></div>
          <div className="slider-row last"><div><label className="field-label" htmlFor="spacing-slider">Spacing</label><div className="field-subtitle">Distance between repeats</div></div><div className="slider-control"><input id="spacing-slider" type="range" min="0" max="2" step="1" value={settings.spacing} onChange={event => updateSettings({ spacing: Number(event.target.value) })}/><span>{["Close", "Balanced", "Wide"][settings.spacing]}</span></div></div>
          <button className="primary-button" type="button" disabled={!files.length || !settings.text.trim() || busy} onClick={() => void generate()}><span>{busy ? "Generating…" : "Generate watermarked images"}</span><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          <p className="status" role="status" aria-live="polite">{status}</p>
        </section>

        <section className="preview-panel" aria-label="Watermark preview and downloads">
          <div className="preview-top"><div><div className="preview-kicker"><span className="live-dot"/> LIVE PREVIEW</div><h2>See the subtle difference.</h2><p>{files.length ? files[selected]?.file.name : "A preview of your watermark at work"}</p></div><span className="preview-badge">{files.length ? "YOUR IMAGE" : "SAMPLE IMAGE"}</span></div>
          <div className="preview-stage"><canvas ref={previewRef} aria-label="Preview of the watermarked image"/></div>
          <div className="preview-bottom"><div className="preview-tip"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5a6.5 6.5 0 0 0-3.2 12.16V17.5h6.4v-2.84A6.5 6.5 0 0 0 10 2.5Zm-2 15h4M8.5 12h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg><span>Subtle by intention. Adjust the sliders until it feels right.</span></div>{files.length > 1 && <div className="preview-navigation"><button type="button" onClick={() => setSelected((selected - 1 + files.length) % files.length)} aria-label="Previous image">‹</button><span>{selected + 1} / {files.length}</span><button type="button" onClick={() => setSelected((selected + 1) % files.length)} aria-label="Next image">›</button></div>}</div>
          {results.length > 0 && <div className="results"><div className="results-header"><div><h3>Your images are ready</h3><p>Download individually or all at once.</p></div><button type="button" className="download-all" onClick={() => void downloadAll()}>Download all .zip <span aria-hidden="true">↓</span></button></div><div className="result-list">{results.map(result => <div className="result-item" key={result.id}><span title={result.name}>{result.name}</span><button type="button" onClick={() => download(result.url, result.name)} aria-label={`Download ${result.name}`}>Download ↓</button></div>)}</div></div>}
        </section>
      </div>
      <section className="trust-strip" aria-label="Privacy and format information"><div><span className="trust-icon">⌁</span><div><strong>Processed in your browser</strong><span>No uploads or accounts required.</span></div></div><div><span className="trust-icon">▧</span><div><strong>Original resolution</strong><span>Images keep their full dimensions.</span></div></div><div><span className="trust-icon">↗</span><div><strong>Ready to share</strong><span>Save each image or a single ZIP.</span></div></div></section>
    </main>
    <footer><span>quietmark<span className="brand-dot">.</span></span><span>A small note for the things that matter.</span></footer>
  </div>;
}
