"use client";
import { useEffect, useState, useRef } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  Layers,
  LayoutGrid,
  History,
  Code2,
  Check,
  ChevronDown,
  Upload,
  FileCode2,
  X,
  Download,
  Columns2,
  Eye,
  ChevronRight,
  Command,
  Folder,
  CheckCircle2,
} from "lucide-react";
import { demos, Design } from "../lib/demo";
type Diff = { kind: "same" | "add" | "remove"; text: string };
function diff(a: string, b: string): Diff[] {
  const x = a.split("\n"),
    y = b.split("\n");
  if (x.length * y.length > 1000000)
    return [
      ...x.map((text) => ({ kind: "remove" as const, text })),
      ...y.map((text) => ({ kind: "add" as const, text })),
    ];
  const rows = Array.from(
    { length: x.length + 1 },
    () => new Uint32Array(y.length + 1),
  );
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      rows[i][j] =
        x[i] === y[j]
          ? 1 + rows[i + 1][j + 1]
          : Math.max(rows[i + 1][j], rows[i][j + 1]);
  const out: Diff[] = [];
  let i = 0,
    j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) {
      out.push({ kind: "same", text: x[i++] });
      j++;
    } else if (
      j < y.length &&
      (i === x.length || rows[i][j + 1] >= rows[i + 1][j])
    )
      out.push({ kind: "add", text: y[j++] });
    else out.push({ kind: "remove", text: x[i++] });
  }
  return out;
}
function structural(a: string, b: string) {
  const parse = (s: string) => new DOMParser().parseFromString(s, "text/html");
  const x = parse(a),
    y = parse(b);
  const items: string[] = [];
  const txt = (d: Document) => d.body.textContent?.replace(/\s+/g, " ").trim();
  if (txt(x) !== txt(y)) items.push("Page copy and visible text updated");
  if (
    [...x.querySelectorAll("style")].map((e) => e.textContent).join() !==
    [...y.querySelectorAll("style")].map((e) => e.textContent).join()
  )
    items.push("Styles, colors, or layout rules changed");
  for (const tag of ["button", "a", "img", "input", "section", "div"]) {
    const p = x.querySelectorAll(tag).length,
      q = y.querySelectorAll(tag).length;
    if (p !== q)
      items.push(
        `${Math.abs(q - p)} ${tag} element${Math.abs(q - p) > 1 ? "s" : ""} ${q > p ? "added" : "removed"}`,
      );
  }
  if (!items.length && a !== b)
    items.push("HTML attributes, metadata, or scripts changed");
  return items;
}
const last = (d: Design) => d.versions[d.versions.length - 1];
export default function Studio() {
  const [designs, setDesigns] = useState<Design[]>(demos),
    [selected, setSelected] = useState("demo-evergreen"),
    [nav, setNav] = useState("All designs"),
    [tab, setTab] = useState("Overview"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All statuses"),
    [modal, setModal] = useState<"new" | "version" | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [view, setView] = useState("Visual"),
    [from, setFrom] = useState(1),
    [to, setTo] = useState(2),
    [file, setFile] = useState<File | null>(null),
    [fileHtml, setFileHtml] = useState(""),
    [name, setName] = useState(""),
    [author, setAuthor] = useState(""),
    [role, setRole] = useState("Designer"),
    [source, setSource] = useState("Lovable"),
    [notes, setNotes] = useState(""),
    [category, setCategory] = useState("Website"),
    [revision, setRevision] = useState<number | null>(null);
  const [collection, setCollection] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const d = designs.find((x) => x.id === selected) || designs[0];
  const v =
    revision === null
      ? last(d)
      : d.versions[Math.min(revision, d.versions.length - 1)];
  const left = d.versions[Math.min(from, d.versions.length - 1)],
    right = d.versions[Math.min(to, d.versions.length - 1)];
  const changes = diff(left.html, right.html);
  const [summary, setSummary] = useState<string[]>([]);
  async function load() {
    try {
      const r = await fetch("/api/designs");
      const data: any = await r.json();
      if (r.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!r.ok) throw Error(data.error);
      setDesigns([
        ...data,
        ...demos.filter((x) => !data.some((a: Design) => a.id === x.id)),
      ]);
      setSaved(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection unavailable");
    }
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("design");
    if (id) setSelected(id);
    load();
  }, []);
  useEffect(() => {
    setSummary(structural(left.html, right.html));
  }, [left.html, right.html]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const old = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const box = document.querySelector(".modal")!;
    const controls = () =>
      Array.from(
        box.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not([hidden]),select,textarea",
        ),
      ).filter((el) => el.offsetParent !== null);
    controls()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setModal(null);
      if (e.key === "Tab") {
        const els = controls();
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handler);
      old?.focus();
    };
  }, [modal, busy]);
  function select(x: Design) {
    window.history.replaceState(
      null,
      "",
      "?design=" + encodeURIComponent(x.id),
    );
    setSelected(x.id);
    setRevision(null);
    setFrom(Math.max(0, x.versions.length - 2));
    setTo(x.versions.length - 1);
    setTab("Overview");
  }
  function openUpload(type: "new" | "version") {
    setModal(type);
    setName(type === "new" ? "" : d.name);
    setCategory(type === "new" ? "Website" : d.category);
    setFile(null);
    setFileHtml("");
    setNotes("");
    setError("");
  }
  async function read(f: File) {
    if (!/\.html?$/i.test(f.name) || f.size > 750000) {
      setToast("Please choose an .html file under 750 KB.");
      return;
    }
    setFile(f);
    setFileHtml(await f.text());
    if (modal === "new" && !name)
      setName(f.name.replace(/\.html?$/i, "").replace(/[-_]/g, " "));
  }
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designId: modal === "version" ? d.id : undefined,
          name,
          category,
          html: fileHtml,
          author,
          role,
          source,
          notes,
        }),
      });
      const data: any = await r.json();
      if (!r.ok) throw Error(data.error);
      await load();
      setSelected(data.id);
      setRevision(null);
      setModal(null);
      setTab("History");
      setToast("Version uploaded. Your design history is saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  async function status() {
    try {
      const r = await fetch("/api/designs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: v.id,
          status: v.status === "Ready for dev" ? "In review" : "Ready for dev",
        }),
      });
      const b: any = await r.json();
      if (!r.ok) throw Error(b.error);
      await load();
      setToast("Handoff status updated.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Update failed");
    }
  }
  function download(html: string, filename: string) {
    const url = URL.createObjectURL(new Blob([html], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  const filtered = designs.filter(
    (x) =>
      x.name.toLowerCase().includes(search.toLowerCase()) &&
      (!collection || x.category === collection) &&
      (filter === "All statuses" || last(x).status === filter) &&
      (nav !== "Ready for dev" || last(x).status === "Ready for dev"),
  );
  return (
    <div
      className={
        tab === "Compare" && nav !== "Recent activity" ? "app comparing" : "app"
      }
    >
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="SA Studio home">
          <img
            className="brand-mark"
            src="/logo.svg"
            alt=""
            width="33"
            height="33"
          />
          <span className="brand-name">
            SA <em>Studio</em>
          </span>
        </a>
        <div className="workspace">
          <div className="workspace-icon">D</div>
          <div>
            <strong>Design workspace</strong>
            <small>Product & engineering</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            { label: "All designs", icon: LayoutGrid },
            { label: "Recent activity", icon: History },
            { label: "Ready for dev", icon: CheckCircle2 },
          ].map(({ label, icon: Icon }) => (
            <button
              className={nav === label ? "active" : ""}
              key={label}
              title={label}
              aria-label={label}
              onClick={() => {
                setNav(label);
                setCollection("");
              }}
            >
              <Icon size={17} />
              {label}
              {label === "All designs" && (
                <span className="nav-count">{designs.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-label projects-label">
          COLLECTIONS <Folder size={13} />
        </div>
        {["Website", "Dashboard", "Web app"].map((c) => (
          <button
            key={c}
            className="collection"
            onClick={() => {
              setNav("All designs");
              setCollection(c);
              setSearch("");
              setFilter("All statuses");
              const p = designs.find((x) => x.category === c);
              if (p) select(p);
            }}
          >
            <span className={"dot " + c.replace(" ", "")} />
            {c}
            <span>{designs.filter((x) => x.category === c).length}</span>
          </button>
        ))}
        <div className="sidebar-bottom">
          <div className="tip">
            <span className="tip-icon">✳</span>
            <strong>A little less guesswork.</strong>
            <p>
              Every iteration, in one place.
              <br />
              Better handoffs start here.
            </p>
            <button
              onClick={() => {
                setTab("Compare");
                setNav("All designs");
              }}
            >
              Explore version compare <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="profile">
            <div className="avatar">YO</div>
            <div>
              <strong>Your workspace</strong>
              <small>Team studio</small>
            </div>
            <span className="online" />
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            Workspace <ChevronRight size={13} /> <strong>{nav}</strong>
          </div>
          <div className="topbar-right">
            <span className="save-dot" />
            {saved ? "Shared storage connected" : "Connecting to studio"}
            <button
              className="signout"
              title="Sign out"
              onClick={async () => {
                await fetch("/api/session", { method: "DELETE" });
                window.location.assign("/login");
              }}
            >
              Sign out
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">A HOME FOR YOUR NEXT ITERATION</div>
              <h1>
                {nav === "Recent activity"
                  ? "Recent activity"
                  : nav === "Ready for dev"
                    ? "Ready for development"
                    : "Designs in progress"}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                From first idea to final handoff. Keep everyone on the same
                version.
              </p>
            </div>
            <button className="primary" onClick={() => openUpload("new")}>
              <Plus size={17} /> New design
            </button>
          </div>
          <div className="stats">
            <div>
              <span className="stat-icon lavender">
                <Layers size={18} />
              </span>
              <div>
                <strong>
                  {designs.length}
                  <span>designs</span>
                </strong>
                <small>Ideas taking shape</small>
              </div>
            </div>
            <div>
              <span className="stat-icon peach">
                <History size={18} />
              </span>
              <div>
                <strong>
                  {designs.reduce((s, x) => s + x.versions.length, 0)}
                  <span>versions</span>
                </strong>
                <small>Every iteration accounted for</small>
              </div>
            </div>
            <div>
              <span className="stat-icon mint">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <strong>
                  {
                    designs.filter((x) => last(x).status === "Ready for dev")
                      .length
                  }
                  <span>ready for dev</span>
                </strong>
                <small>Good to build</small>
              </div>
            </div>
            <div className="stat-note">
              <span>✧</span>Good design is a conversation.
              <br />
              Keep it going.
            </div>
          </div>
          {error && !modal && (
            <div className="connection-error">
              {error} <button onClick={load}>Retry connection</button>
            </div>
          )}
          {nav === "Recent activity" ? (
            <section className="activity-page">
              <h2>The latest iterations</h2>
              {designs
                .flatMap((x) => x.versions.map((v) => ({ d: x, v })))
                .sort((a, b) => b.v.createdAt.localeCompare(a.v.createdAt))
                .map(({ d: x, v }) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      select(x);
                      setRevision(x.versions.findIndex((z) => z.id === v.id));
                      setNav("All designs");
                    }}
                  >
                    <div className="avatar purple">
                      {v.author
                        .split(" ")
                        .map((s) => s[0])
                        .join("")}
                    </div>
                    <div>
                      <strong>{v.author}</strong> uploaded <b>v{v.number}</b> of{" "}
                      <strong>{x.name}</strong>
                      <p>{v.notes}</p>
                    </div>
                    <small>
                      {new Date(v.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </small>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
            </section>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <h2>
                    Your designs <span>{filtered.length}</span>
                  </h2>
                  <small>
                    One place for all your AI-generated explorations.
                  </small>
                </div>
                <div className="tools">
                  <div className="search">
                    <Search size={15} />
                    <input
                      aria-label="Search designs"
                      placeholder="Search designs..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Filter by status"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option>All statuses</option>
                    <option>In review</option>
                    <option>Ready for dev</option>
                  </select>
                </div>
              </div>
              <div className="design-grid">
                {filtered.map((x) => (
                  <button
                    key={x.id}
                    className={
                      "design-card " + (x.id === d.id ? "selected" : "")
                    }
                    onClick={() => select(x)}
                  >
                    <div className={"thumbnail " + x.category.replace(" ", "")}>
                      <div className="thumbnail-frame">
                        <iframe
                          title={x.name + " miniature"}
                          srcDoc={last(x).html}
                          sandbox="allow-scripts"
                          tabIndex={-1}
                        />
                      </div>
                      <span className="version-pill">v{last(x).number}</span>
                    </div>
                    <div className="card-body">
                      <div className="card-title">
                        <h3>{x.name}</h3>
                        <ArrowUpRight size={17} />
                      </div>
                      <div className="card-meta">
                        {x.category}
                        <span>·</span>
                        {x.versions.length} version
                        {x.versions.length !== 1 ? "s" : ""}
                        {x.example && <span className="example">Example</span>}
                      </div>
                      <div className="card-footer">
                        <span
                          className={
                            "status " +
                            (last(x).status === "Ready for dev"
                              ? "ready"
                              : "review")
                          }
                        >
                          <i />
                          {last(x).status}
                        </span>
                        <div className="card-author">
                          <span className="tiny-avatar">
                            {last(x)
                              .author.split(" ")
                              .map((s) => s[0])
                              .join("")}
                          </span>
                          <span>
                            {new Date(last(x).createdAt).toLocaleDateString(
                              "en-GB",
                              { month: "short", day: "numeric" },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {!filtered.length && (
                  <div className="empty">
                    No designs match this view. Try another filter or upload
                    your first design.
                  </div>
                )}
              </div>
              <section className="detail">
                <div className="detail-header">
                  <div>
                    <div className="detail-overline">
                      <span className="dot Website" />
                      {d.category} {d.example && <span>⬢ Example project</span>}
                    </div>
                    <h2>
                      {d.name}{" "}
                      <span className="current-version">v{v.number}</span>
                    </h2>
                  </div>
                  <div className="detail-actions">
                    <button
                      className="secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            window.location.origin +
                              "/?design=" +
                              encodeURIComponent(d.id),
                          );
                          setToast(
                            "Design link copied. Share it with your workspace.",
                          );
                        } catch {
                          setToast(
                            "Copy this address: " +
                              window.location.origin +
                              "/?design=" +
                              encodeURIComponent(d.id),
                          );
                        }
                      }}
                    >
                      <ArrowUpRight size={14} /> Share
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setTab("Compare");
                        setFrom(Math.max(0, d.versions.length - 2));
                        setTo(d.versions.length - 1);
                      }}
                    >
                      <Columns2 size={15} /> Compare versions
                    </button>
                    <button
                      className="primary small"
                      onClick={() => openUpload("version")}
                    >
                      <Upload size={15} /> Upload new version
                    </button>
                  </div>
                </div>
                <div className="tabs">
                  {["Overview", "History", "Compare"].map((t) => (
                    <button
                      key={t}
                      className={t === tab ? "active" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t === "Overview" ? (
                        <Eye size={15} />
                      ) : t === "History" ? (
                        <History size={15} />
                      ) : (
                        <Columns2 size={15} />
                      )}{" "}
                      {t}
                      {t === "History" && <span>{d.versions.length}</span>}
                    </button>
                  ))}
                  <span className="last-update">
                    Updated{" "}
                    {new Date(last(d).createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                {tab === "Overview" && (
                  <div className="overview">
                    <div className="preview">
                      <div className="preview-toolbar">
                        <span>
                          <span className="browser-dot" />
                          <span className="browser-dot" />
                          <span className="browser-dot" />
                        </span>
                        <small>
                          {d.name.toLowerCase().replace(/ /g, "-")}.html
                        </small>
                        <button
                          aria-label="Download HTML"
                          onClick={() =>
                            download(v.html, `${d.name}-v${v.number}.html`)
                          }
                        >
                          <Download size={14} />
                        </button>
                      </div>
                      <iframe
                        title="Design preview"
                        sandbox="allow-scripts"
                        srcDoc={v.html}
                      />
                      <div className="preview-foot">
                        <span>
                          <Eye size={13} /> Sandboxed HTML preview
                        </span>
                        <span>Version {v.number}</span>
                      </div>
                    </div>
                    <aside className="version-info">
                      <div className="info-heading">
                        <h3>
                          {revision === null
                            ? "Latest iteration"
                            : "Selected iteration"}
                        </h3>
                        <span
                          className={
                            "status " +
                            (v.status === "Ready for dev" ? "ready" : "review")
                          }
                        >
                          <i />
                          {v.status}
                        </span>
                      </div>
                      <div className="person">
                        <div className="avatar purple">
                          {v.author
                            .split(" ")
                            .map((s) => s[0])
                            .join("")}
                        </div>
                        <div>
                          <strong>{v.author}</strong>
                          <small>
                            {v.role} ·{" "}
                            {new Date(v.createdAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </small>
                        </div>
                      </div>
                      <div className="info-label">VERSION NOTES</div>
                      <p className="version-notes">
                        {v.notes || "No notes added for this version."}
                      </p>
                      <div className="source-row">
                        <span>Created with</span>
                        <span className="source-badge">
                          <Command size={12} />
                          {v.source}
                        </span>
                      </div>
                      <div className="handoff">
                        <span>
                          <Code2 size={16} />
                          <strong>Developer handoff</strong>
                        </span>
                        <p>
                          Review the changes, then give your team a clear
                          version to build.
                        </p>
                        <button onClick={status}>
                          {v.status === "Ready for dev" ? (
                            <>
                              <History size={14} /> Move back to review
                            </>
                          ) : (
                            <>
                              <Check size={14} /> Mark ready for dev
                            </>
                          )}
                        </button>
                      </div>
                    </aside>
                  </div>
                )}
                {tab === "History" && (
                  <div className="history-list">
                    <p className="history-intro">
                      A complete trail of decisions. Select a revision to open
                      its preview.
                    </p>
                    {[...d.versions].reverse().map((z, i) => (
                      <div className="history-item" key={z.id}>
                        <div className="timeline-node">
                          <History size={15} />
                        </div>
                        <div className="history-content">
                          <div>
                            <h3>
                              Version {z.number}{" "}
                              {i === 0 && (
                                <span className="latest">LATEST</span>
                              )}
                            </h3>
                            <span
                              className={
                                "status " +
                                (z.status === "Ready for dev"
                                  ? "ready"
                                  : "review")
                              }
                            >
                              <i />
                              {z.status}
                            </span>
                          </div>
                          <p>{z.notes || "No version notes."}</p>
                          <small>
                            {z.author} · {z.role} · {z.source} ·{" "}
                            {new Date(z.createdAt).toLocaleString("en-GB")}
                          </small>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => {
                            setRevision(d.versions.indexOf(z));
                            setTab("Overview");
                          }}
                        >
                          View version <ArrowUpRight size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {tab === "Compare" && (
                  <div className="compare">
                    <div className="compare-toolbar">
                      <div>
                        <select
                          aria-label="Previous version"
                          value={Math.min(from, d.versions.length - 1)}
                          onChange={(e) => setFrom(+e.target.value)}
                        >
                          {d.versions.map((z, i) => (
                            <option value={i} key={z.id}>
                              v{z.number} · {z.author}
                            </option>
                          ))}
                        </select>
                        <ArrowRight size={16} />
                        <select
                          aria-label="Next version"
                          value={Math.min(to, d.versions.length - 1)}
                          onChange={(e) => setTo(+e.target.value)}
                        >
                          {d.versions.map((z, i) => (
                            <option value={i} key={z.id}>
                              v{z.number} · {z.author}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="segmented">
                        {["Visual", "Code"].map((t) => (
                          <button
                            key={t}
                            className={view === t ? "active" : ""}
                            onClick={() => setView(t)}
                          >
                            {t === "Visual" ? (
                              <Columns2 size={13} />
                            ) : (
                              <Code2 size={13} />
                            )}{" "}
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="change-summary">
                      <div>
                        <span className="change-icon">
                          <FileCode2 size={17} />
                        </span>
                        <strong>
                          {left.html === right.html
                            ? "No changes between these versions"
                            : "What changed"}{" "}
                        </strong>
                        <span className="diff-count add">
                          +{changes.filter((z) => z.kind === "add").length}{" "}
                          lines
                        </span>
                        <span className="diff-count remove">
                          −{changes.filter((z) => z.kind === "remove").length}{" "}
                          lines
                        </span>
                      </div>
                      {summary.length > 0 && (
                        <ul>
                          {summary.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      )}
                      <small>
                        Detected from HTML and CSS. Review both previews to
                        confirm visual effects.
                      </small>
                    </div>
                    {view === "Visual" ? (
                      <div className="split-preview">
                        {[left, right].map((z, i) => (
                          <div key={i}>
                            <div className="split-label">
                              <strong>
                                {i === 0 ? "Before" : "After"}{" "}
                                <span>v{z.number}</span>
                              </strong>
                              <span>{z.author}</span>
                            </div>
                            <iframe
                              sandbox="allow-scripts"
                              title={
                                i === 0 ? "Previous design" : "Updated design"
                              }
                              srcDoc={z.html}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="code-diff">
                        {changes.map((z, i) => (
                          <div className={z.kind} key={i}>
                            <span>{i + 1}</span>
                            <b>
                              {z.kind === "add"
                                ? "+"
                                : z.kind === "remove"
                                  ? "−"
                                  : " "}
                            </b>
                            <code>{z.text || " "}</code>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="secondary export"
                      onClick={() =>
                        download(
                          `Design: ${d.name}\nComparison: v${left.number} → v${right.number}\n\n${summary.join("\n")}\n\nVersion notes: ${right.notes}\n\n${changes
                            .filter((z) => z.kind !== "same")
                            .map(
                              (z) => (z.kind === "add" ? "+ " : "- ") + z.text,
                            )
                            .join("\n")}`,
                          `${d.name}-changes.txt`,
                        )
                      }
                    >
                      <Download size={14} /> Export change report
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
          <footer>
            <span>
              <Layers size={13} /> SA Studio
            </span>
            <span>Every iteration has a story. Keep yours together.</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => !busy && setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">MAKE THE NEXT ITERATION COUNT</span>
                <h2 id="upload-title">
                  {modal === "new"
                    ? "Add a new design"
                    : "Upload a new version"}
                </h2>
              </div>
              <button
                aria-label="Close upload"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                <X size={20} />
              </button>
            </div>
            <p>
              {modal === "new"
                ? "Give your AI-generated HTML a shared home."
                : "Your previous versions stay intact. This upload adds to the story."}
            </p>
            <form onSubmit={upload}>
              <label>
                Design name
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={modal === "version"}
                />
              </label>
              <div
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]);
                }}
              >
                <Upload size={24} />
                <strong>{file ? file.name : "Drop your HTML file here"}</strong>
                <span>Self-contained .html · up to 750 KB</span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => input.current?.click()}
                >
                  {file ? "Choose another file" : "Browse files"}
                </button>
                <input
                  ref={input}
                  type="file"
                  accept=".html,.htm,text/html"
                  hidden
                  onChange={(e) =>
                    e.target.files?.[0] && read(e.target.files[0])
                  }
                />
              </div>
              <div className="form-row">
                <label>
                  Your name
                  <input
                    required
                    placeholder="e.g. Sophie Chen"
                    maxLength={120}
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </label>
                <label>
                  Role
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option>Designer</option>
                    <option>Product manager</option>
                    <option>Developer</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Created with
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    {[
                      "Lovable",
                      "Claude",
                      "v0",
                      "ChatGPT",
                      "Bolt",
                      "Other",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Collection
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option>Website</option>
                    <option>Dashboard</option>
                    <option>Web app</option>
                  </select>
                </label>
              </div>
              <label>
                What changed?
                <textarea
                  placeholder="Describe the decisions behind this iteration⬦"
                  value={notes}
                  maxLength={3000}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </label>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <div className="modal-footer">
                <span>
                  <History size={13} /> Version history is preserved
                </span>
                <button
                  className="primary"
                  disabled={!fileHtml || busy}
                  type="submit"
                >
                  {busy
                    ? "Saving..."
                    : "Upload " + (modal === "new" ? "design" : "version")}
                  <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
