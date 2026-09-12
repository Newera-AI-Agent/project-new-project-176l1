"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

type Section = { id: number; text: string; page: number };
type VoiceState = "idle" | "loading" | "ready" | "error";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_CHARS = 900;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length > MAX_CHARS && current) { chunks.push(current); current = sentence.trim(); }
    else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [status, setStatus] = useState<VoiceState>("idle");
  const [message, setMessage] = useState("Choose a PDF to begin reading.");
  const [dragging, setDragging] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [rate, setRate] = useState(1);
  const [current, setCurrent] = useState(-1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeUtterance = useRef<SpeechSynthesisUtterance | null>(null);
  const cancelRef = useRef(false);

  const loadVoices = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const available = window.speechSynthesis.getVoices();
    setVoices(available);
    if (!voiceName && available.length) setVoiceName(available.find(v => v.lang.startsWith("en"))?.name ?? available[0].name);
  }, [voiceName]);

  useEffect(() => {
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, [loadVoices]);

  const reset = useCallback(() => {
    cancelRef.current = true;
    window.speechSynthesis?.cancel();
    setFile(null); setSections([]); setCurrent(-1); setSpeaking(false); setPaused(false); setStatus("idle");
    setMessage("Choose a PDF to begin reading.");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const processFile = useCallback(async (candidate: File) => {
    if (status === "loading") return;
    if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
      setStatus("error"); setMessage("That file is not a PDF. Choose a file ending in .pdf."); return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setStatus("error"); setMessage("This PDF is larger than 25 MB. Choose a smaller file to process locally."); return;
    }
    setStatus("loading"); setMessage("Reading your PDF locally…"); setFile(candidate); setSections([]); setCurrent(-1);
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const data = new Uint8Array(await candidate.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data }).promise;
      const extracted: Section[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items.map((item) => "str" in item ? item.str : "").join(" ");
        chunkText(text).forEach(textChunk => extracted.push({ id: extracted.length, text: textChunk, page: pageNumber }));
      }
      if (!extracted.length) throw new Error("NO_TEXT");
      setSections(extracted); setStatus("ready"); setMessage(`Ready to read ${extracted.length} sections across ${pdf.numPages} pages.`);
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error && error.message === "NO_TEXT" ? "This PDF opened successfully, but it contains no selectable text. Try an OCR-enabled PDF." : "We couldn’t read this PDF. It may be malformed, encrypted, or image-only.");
    }
  }, [status]);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => { const selected = event.target.files?.[0]; if (selected) processFile(selected); };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); const dropped = event.dataTransfer.files[0]; if (dropped) processFile(dropped); };

  const speak = useCallback((index: number) => {
    if (!window.speechSynthesis) { setMessage("Speech synthesis is not available in this browser. You can still read the extracted text."); return; }
    const section = sections[index]; if (!section) return;
    window.speechSynthesis.cancel(); cancelRef.current = false;
    const utterance = new SpeechSynthesisUtterance(section.text); const chosen = voices.find(v => v.name === voiceName);
    if (chosen) utterance.voice = chosen; utterance.rate = rate;
    utterance.onstart = () => { setSpeaking(true); setPaused(false); setCurrent(index); };
    utterance.onend = () => { if (!cancelRef.current && index + 1 < sections.length) speak(index + 1); else { setSpeaking(false); setPaused(false); } };
    utterance.onerror = (event) => { if (event.error !== "canceled" && event.error !== "interrupted") setMessage("Speech stopped unexpectedly. Try play again or choose another voice."); setSpeaking(false); setPaused(false); };
    activeUtterance.current = utterance; setCurrent(index); window.speechSynthesis.speak(utterance);
  }, [rate, sections, voiceName, voices]);

  const play = () => { if (!sections.length) return; if (paused) { window.speechSynthesis.resume(); setPaused(false); } else speak(current >= 0 ? current : 0); };
  const pause = () => { window.speechSynthesis?.pause(); setPaused(true); };
  const stop = () => { cancelRef.current = true; window.speechSynthesis?.cancel(); setSpeaking(false); setPaused(false); setCurrent(-1); };
  const speechAvailable = typeof window !== "undefined" && "speechSynthesis" in window;

  return (
    <main className={styles.shell}>
      <header className={styles.header}><a className={styles.brand} href="/" aria-label="PDF Voice Reader home"><span className={styles.mark}>PV</span><span>PDF Voice Reader</span></a><span className={styles.localBadge}>LOCAL ONLY</span></header>
      <section className={styles.intro} aria-labelledby="page-title"><p className={styles.eyebrow}>READ WITH YOUR EARS</p><h1 id="page-title">Your PDF,<br /><em>spoken clearly.</em></h1><p className={styles.lede}>Turn a document into a focused listening session. Nothing leaves your browser.</p></section>
      <section className={styles.workspace} aria-label="PDF reader workspace">
        <div className={styles.uploadColumn}>
          <div className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <div className={styles.uploadIcon} aria-hidden="true">↑</div><h2>{file ? "Document loaded" : "Bring a PDF here"}</h2><p>Drop it in this space, or browse your device.</p>
            <label className={styles.browse}><span>{status === "loading" ? "Reading…" : "Choose PDF"}</span><input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={onFile} disabled={status === "loading"} /></label>
            <p className={styles.fileHint}>PDF only · max 25 MB</p>
          </div>
          <div className={styles.privacy}><span className={styles.lock} aria-hidden="true">⌁</span><div><strong>Private by design</strong><p>Your file is processed in this tab and never uploaded. Close or reset to clear it.</p></div></div>
        </div>
        <div className={styles.readerColumn}>
          <div className={styles.statusLine} role="status" aria-live="polite"><span className={`${styles.statusDot} ${status === "error" ? styles.errorDot : ""}`} />{message}</div>
          {status === "idle" && <div className={styles.empty}><div className={styles.emptyNumber}>01</div><h2>Nothing open yet</h2><p>Your extracted text will appear here as a calm, readable surface.</p></div>}
          {status === "loading" && <div className={styles.empty}><div className={styles.spinner} aria-hidden="true" /><h2>Reading document</h2><p>Extracting selectable text locally. Larger files can take a moment.</p></div>}
          {status === "error" && <div className={styles.empty}><div className={styles.emptyNumber}>!</div><h2>We hit a snag</h2><p>{message}</p><button className={styles.textButton} onClick={reset}>Clear and try another PDF</button></div>}
          {sections.length > 0 && <>
            <div className={styles.documentHead}><div><p className={styles.eyebrow}>NOW READING</p><h2>{file?.name}</h2></div><button className={styles.textButton} onClick={reset}>Load another</button></div>
            <div className={styles.controls}><button className={styles.play} onClick={play} disabled={!speechAvailable} aria-label={paused ? "Resume reading" : "Play reading"}>{paused ? "Resume" : "Play"}</button><button onClick={pause} disabled={!speaking || paused}>Pause</button><button onClick={stop} disabled={!speaking}>Stop</button><label className={styles.selectLabel}>Voice<select value={voiceName} onChange={(e) => setVoiceName(e.target.value)} disabled={!voices.length}>{voices.length ? voices.map(v => <option key={`${v.name}-${v.lang}`} value={v.name}>{v.name} · {v.lang}</option>) : <option>Voices loading…</option>}</select></label><label className={styles.rateLabel}>Rate <output>{rate.toFixed(1)}×</output><input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label></div>
            {!speechAvailable && <p className={styles.notice}>Speech synthesis is unavailable here. Text remains available to read.</p>}
            <div className={styles.readingSurface}>{sections.map((section) => <button key={section.id} className={`${styles.section} ${current === section.id ? styles.activeSection : ""}`} onClick={() => speak(section.id)} aria-label={`Read section ${section.id + 1}, page ${section.page}`}><span className={styles.sectionMeta}>{String(section.id + 1).padStart(2, "0")} · PAGE {section.page}</span><span>{section.text}</span></button>)}</div>
            <p className={styles.progress}>SECTION {current >= 0 ? current + 1 : "—"} OF {sections.length} <span>· Click any paragraph to start there</span></p>
          </>}
        </div>
      </section>
      <footer><span>PDF Voice Reader</span><span>Browser speech synthesis · No account required</span></footer>
    </main>
  );
}
