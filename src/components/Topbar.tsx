"use client";

import { useEffect, useState } from "react";

interface Meta {
  live: boolean;
  model: string | null;
  rules: number;
}

export default function Topbar() {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => setMeta({ live: false, model: null, rules: 0 }));
  }, []);

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">◆</div>
        <div>
          <div className="brand-name">
            ABAP Modernization <em>Copilot</em>
          </div>
          <div className="brand-sub">S/4HANA Readiness Analysis</div>
        </div>
      </div>

      <div className="row" style={{ gap: 10 }}>
        {meta && (
          <span className="badge-note" title="Simplification-item rules loaded">
            {meta.rules} rules
          </span>
        )}
        {meta &&
          (meta.live ? (
            <span className="mode-pill mode-live" title={`Powered by ${meta.model}`}>
              <span className="dot" /> LIVE · {meta.model}
            </span>
          ) : (
            <span className="mode-pill mode-demo" title="No API key set — deterministic demo engine">
              <span className="dot" /> DEMO MODE
            </span>
          ))}
      </div>
    </div>
  );
}
