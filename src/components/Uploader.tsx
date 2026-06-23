"use client";

import { useRef, useState } from "react";

export interface UploadFile {
  name: string;
  content: string;
}

export interface ScanMeta {
  customer_name: string;
  sap_release: string;
  target_release: string;
}

const ACCEPT = [".abap", ".txt", ".prog", ".clas", ".fugr", ".zip"];

function isAbapName(name: string): boolean {
  return /\.(abap|txt|prog|clas|fugr|asprog|src)$/i.test(name);
}

export default function Uploader({
  onScan,
  busy,
}: {
  onScan: (files: UploadFile[], meta: ScanMeta) => void;
  busy: boolean;
}) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [drag, setDrag] = useState(false);
  const [meta, setMeta] = useState<ScanMeta>({
    customer_name: "Acme Manufacturing GmbH",
    sap_release: "ECC 6.0 EhP8",
    target_release: "S/4HANA 2023",
  });
  const inputRef = useRef<HTMLInputElement>(null);

  async function ingest(fileList: FileList | File[]) {
    const incoming: UploadFile[] = [];
    for (const f of Array.from(fileList)) {
      if (f.name.toLowerCase().endsWith(".zip")) {
        try {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(f);
          const entries = Object.values(zip.files).filter(
            (e) => !e.dir && isAbapName(e.name)
          );
          for (const e of entries) {
            const content = await e.async("string");
            incoming.push({ name: e.name.split("/").pop() || e.name, content });
          }
        } catch {
          // ignore bad zip
        }
      } else {
        const content = await f.text();
        incoming.push({ name: f.name, content });
      }
    }
    setFiles((prev) => {
      const map = new Map(prev.map((p) => [p.name, p]));
      for (const f of incoming) map.set(f.name, f);
      return Array.from(map.values()).slice(0, 50);
    });
  }

  async function loadSamples() {
    try {
      const res = await fetch("/api/samples");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      /* noop */
    }
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  return (
    <div className="card card-pad">
      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files) ingest(e.dataTransfer.files);
        }}
      >
        <div className="dz-icon">📂</div>
        <div className="dz-title">Drop ABAP files or a .zip here</div>
        <div className="dz-sub">
          .abap · .txt · .clas · .fugr · .zip — up to 50 programs · click to browse
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) ingest(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
        <button className="btn btn-sm" onClick={loadSamples} disabled={busy}>
          ⚡ Load sample ABAP set
        </button>
        {files.length > 0 && (
          <button className="btn btn-sm btn-ghost" onClick={() => setFiles([])} disabled={busy}>
            Clear all
          </button>
        )}
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f) => (
            <div className="file-chip" key={f.name}>
              <span style={{ color: "var(--accent3)" }}>▸</span>
              <span className="fc-name">{f.name}</span>
              <span className="fc-meta">{f.content.split(/\r?\n/).length} lines</span>
              {!busy && (
                <span className="fc-x" onClick={() => removeFile(f.name)} title="Remove">
                  ✕
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label>Customer / Project</label>
          <input
            value={meta.customer_name}
            onChange={(e) => setMeta({ ...meta, customer_name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Source Release</label>
          <select
            value={meta.sap_release}
            onChange={(e) => setMeta({ ...meta, sap_release: e.target.value })}
          >
            <option>ECC 6.0 EhP8</option>
            <option>ECC 6.0 EhP7</option>
            <option>ECC 6.0</option>
            <option>R/3 4.7</option>
          </select>
        </div>
        <div className="field">
          <label>Target Release</label>
          <select
            value={meta.target_release}
            onChange={(e) => setMeta({ ...meta, target_release: e.target.value })}
          >
            <option>S/4HANA 2023</option>
            <option>S/4HANA 2022</option>
            <option>S/4HANA 2021</option>
            <option>S/4HANA Cloud</option>
          </select>
        </div>
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        <button
          className="btn btn-primary"
          disabled={busy || files.length === 0}
          onClick={() => onScan(files, meta)}
        >
          {busy ? (
            <>
              <span className="spin" /> Analyzing<span className="dots" />
            </>
          ) : (
            <>▶ Run S/4HANA Readiness Scan</>
          )}
        </button>
        <span className="spacer" />
        <span className="badge-note">
          {files.length} file{files.length === 1 ? "" : "s"} ready
        </span>
      </div>
    </div>
  );
}
