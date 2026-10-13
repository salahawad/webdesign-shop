"use client";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowUpRight,
  ArrowUp,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  Search,
  Layers,
  LayoutGrid,
  List,
  History,
  Code2,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
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
  Monitor,
  Tablet,
  Smartphone,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
  AlertCircle,
  RotateCcw,
  ArrowUpDown,
  Pin,
  Archive,
  Trash2,
  PanelLeft,
} from "lucide-react";
import { demos, Design, type Version } from "../lib/demo";
import {
  ACTIVITY_PAGE_SIZE,
  type CatalogView,
  filterActivities,
  filterAndSortDesigns,
  GRID_PAGE_SIZE,
  LIST_PAGE_SIZE,
  pageSequence,
  paginateItems,
  type SortOption,
  SPLIT_PAGE_SIZE,
} from "../lib/catalog";
import { highlightChanges } from "../lib/visual-diff";
import { MAX_UPLOAD_BYTES } from "../lib/upload";

type Diff = {
  kind: "same" | "add" | "remove";
  text: string;
  lineNumber?: number;
};

function diff(a: string, b: string): Diff[] {
  const x = a.split("\n"),
    y = b.split("\n");
  if (x.length * y.length > 1000000)
    return [
      ...x.map((text, idx) => ({
        kind: "remove" as const,
        text,
        lineNumber: idx + 1,
      })),
      ...y.map((text, idx) => ({
        kind: "add" as const,
        text,
        lineNumber: idx + 1,
      })),
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
    j = 0,
    line = 1;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) {
      out.push({ kind: "same", text: x[i++], lineNumber: line++ });
      j++;
    } else if (
      j < y.length &&
      (i === x.length || rows[i][j + 1] >= rows[i + 1][j])
    )
      out.push({ kind: "add", text: y[j++], lineNumber: line++ });
    else out.push({ kind: "remove", text: x[i++], lineNumber: line++ });
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

const statusClass = (status: string) =>
  status === "Ready for dev"
    ? "ready"
    : status === "Superseded"
      ? "superseded"
      : "review";

const placeholder = (text: string) =>
  `<p style="margin:0;padding:20px;font:13px/1.5 -apple-system,BlinkMacSystemFont,'DM Sans',sans-serif;color:#6e6582">${text}</p>`;

function LazyThumbnail({
  versionId,
  title,
  srcDoc,
  ready,
  onVisible,
}: {
  versionId: string;
  title: string;
  srcDoc: string;
  ready: boolean;
  onVisible: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      onVisible(versionId);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          onVisible(versionId);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [versionId, onVisible]);

  return (
    <div ref={ref} className="thumbnail-frame">
      {inView && ready ? (
        <iframe
          title={title}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          loading="lazy"
          tabIndex={-1}
        />
      ) : (
        <div className="thumbnail-placeholder" aria-hidden="true">
          <div className="thumbnail-skeleton-bar" />
          <div className="thumbnail-skeleton-hero" />
          <div className="thumbnail-skeleton-lines">
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Studio() {
  const [designs, setDesigns] = useState<Design[]>(demos),
    [selected, setSelected] = useState("demo-evergreen"),
    [nav, setNav] = useState("All designs"),
    [tab, setTab] = useState("Overview"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All statuses"),
    [sortBy, setSortBy] = useState<SortOption>("updated"),
    [catalogView, setCatalogView] = useState<CatalogView>("grid"),
    [browserCollapsed, setBrowserCollapsed] = useState(false),
    [page, setPage] = useState(1),
    [showAllDesigns, setShowAllDesigns] = useState(false),
    [activityLimit, setActivityLimit] = useState(ACTIVITY_PAGE_SIZE),
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
    [source, setSource] = useState("Claude Design"),
    [notes, setNotes] = useState(""),
    [category, setCategory] = useState("Website"),
    [revision, setRevision] = useState<number | null>(null);
  const [collection, setCollection] = useState("");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const [compactCompare, setCompactCompare] = useState(true);
  const [diffOnly, setDiffOnly] = useState(false);
  const [highlights, setHighlights] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [observedVersionIds, setObservedVersionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => new Set());
  const [activitySearch, setActivitySearch] = useState("");
  const [activityDesignId, setActivityDesignId] = useState("");
  const [activityStatus, setActivityStatus] = useState("All statuses");

  const input = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);

  const markVersionVisible = useCallback((versionId: string) => {
    setObservedVersionIds((prev) => {
      if (prev.has(versionId)) return prev;
      const next = new Set(prev);
      next.add(versionId);
      return next;
    });
  }, []);

  const d = designs.find((x) => x.id === selected) || designs[0];
  const latestVersion = last(d);
  const v =
    revision === null
      ? latestVersion
      : d.versions[Math.min(revision, d.versions.length - 1)];
  const isHistorical = v.id !== latestVersion.id;

  const leftIndex = Math.min(from, d.versions.length - 1);
  const rightIndex = Math.min(to, d.versions.length - 1);
  const left = d.versions[leftIndex],
    right = d.versions[rightIndex];

  // Stored versions arrive without HTML; null marks a failed fetch until the next retry.
  const [htmlCache, setHtmlCache] = useState<Record<string, string | null>>({});
  const fetching = useRef(new Set<string>());
  const htmlOf = (z: Version) => z.html ?? htmlCache[z.id];
  const previewDoc = (z: Version) =>
    htmlOf(z) ??
    placeholder(
      htmlOf(z) === null ? "Preview unavailable." : "Loading preview…",
    );
  const leftHtml = htmlOf(left),
    rightHtml = htmlOf(right);
  const comparing = tab === "Compare" && leftHtml != null && rightHtml != null;
  const highlightedPreviews = useMemo(
    () =>
      comparing && view === "Visual" && highlights
        ? highlightChanges(leftHtml, rightHtml)
        : null,
    [comparing, view, highlights, leftHtml, rightHtml],
  );

  // The line diff is quadratic: compute it only for the Compare tab, not on every keystroke.
  const changes = useMemo(
    () =>
      tab === "Compare" && leftHtml != null && rightHtml != null
        ? diff(leftHtml, rightHtml)
        : [],
    [tab, leftHtml, rightHtml],
  );
  const visibleDiffLines = useMemo(
    () => (diffOnly ? changes.filter((z) => z.kind !== "same") : changes),
    [changes, diffOnly],
  );
  const addedCount = useMemo(
    () => changes.filter((z) => z.kind === "add").length,
    [changes],
  );
  const removedCount = useMemo(
    () => changes.filter((z) => z.kind === "remove").length,
    [changes],
  );

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
      // Retry previews that failed earlier.
      setHtmlCache((cache) =>
        Object.fromEntries(Object.entries(cache).filter(([, h]) => h !== null)),
      );
      setSaved(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection unavailable");
    }
  }

  useEffect(() => {
    try {
      const savedPinned = localStorage.getItem("sa-studio-pinned");
      if (savedPinned) setPinnedIds(new Set(JSON.parse(savedPinned)));
      const savedArchived = localStorage.getItem("sa-studio-archived");
      if (savedArchived) setArchivedIds(new Set(JSON.parse(savedArchived)));
    } catch {
      // Ignore storage access errors in restricted contexts
    }
    const id = new URLSearchParams(window.location.search).get("design");
    if (id) setSelected(id);
    load();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (modal) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (!isEditable && e.key === "/") {
        e.preventDefault();
        setBrowserCollapsed(false);
        searchInputRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBrowserCollapsed(false);
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal]);

  useEffect(() => {
    setSummary(
      tab === "Compare" && leftHtml != null && rightHtml != null
        ? structural(leftHtml, rightHtml)
        : [],
    );
  }, [tab, leftHtml, rightHtml]);

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
          lastEl = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl?.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
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

  function select(x: Design, keepTab = false, scrollToInspector = false) {
    window.history.replaceState(
      null,
      "",
      "?design=" + encodeURIComponent(x.id),
    );
    setSelected(x.id);
    setRevision(null);
    setFrom(Math.max(0, x.versions.length - 2));
    setTo(x.versions.length - 1);
    if (!keepTab) setTab("Overview");
    if (scrollToInspector && catalogView !== "split") {
      requestAnimationFrame(() => {
        const el = detailRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top > window.innerHeight * 0.55 || rect.top < 0) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  }

  function togglePin(designId: string) {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      const pinned = !next.has(designId);
      if (pinned) next.add(designId);
      else next.delete(designId);
      try {
        localStorage.setItem("sa-studio-pinned", JSON.stringify([...next]));
      } catch {}
      setToast(
        pinned ? "Project pinned to top of catalog." : "Project unpinned.",
      );
      return next;
    });
  }

  function toggleArchive(target: Design) {
    const willArchive = !archivedIds.has(target.id);
    setArchivedIds((prev) => {
      const next = new Set(prev);
      if (willArchive) next.add(target.id);
      else next.delete(target.id);
      try {
        localStorage.setItem("sa-studio-archived", JSON.stringify([...next]));
      } catch {}
      return next;
    });
    if (willArchive && nav !== "Archived") {
      const fallback = designs.find(
        (x) => x.id !== target.id && !archivedIds.has(x.id),
      );
      if (fallback) select(fallback, true);
      setToast("Project archived. View it anytime under Archived.");
    } else {
      setToast("Project restored to active workspace.");
    }
  }

  async function removeDesign(target: Design) {
    if (target.example) return;
    if (
      !window.confirm(
        `Delete "${target.name}" and all ${target.versions.length} version(s)? This cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      const r = await fetch("/api/designs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id }),
      });
      const b: any = await r.json();
      if (!r.ok) throw Error(b.error);
      const fallback =
        designs.find((x) => x.id !== target.id && !archivedIds.has(x.id)) ||
        demos[0];
      await load();
      if (fallback) select(fallback);
      setToast(`Deleted "${target.name}".`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function openUpload(type: "new" | "version") {
    setModal(type);
    setName(type === "new" ? "" : d.name);
    setCategory(type === "new" ? "Website" : d.category);
    setFile(null);
    setFileHtml("");
    setNotes("");
    setError("");
    setIsDragging(false);
  }

  async function read(f: File) {
    if (!/\.html?$/i.test(f.name) || f.size > MAX_UPLOAD_BYTES) {
      setToast("Please choose a .html or .htm file up to 4.5 MB.");
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
      const body = JSON.stringify({
        designId: modal === "version" ? d.id : undefined,
        name,
        category,
        html: fileHtml,
        author,
        role,
        source,
        notes,
      });
      if (new Blob([body]).size > MAX_UPLOAD_BYTES) {
        throw Error(
          "The file and upload details exceed 4.5 MB. Choose a smaller file.",
        );
      }
      const r = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
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

  // A blob document inherits the studio origin, so the upload runs only inside
  // a sandboxed iframe there, isolated like the in-page previews.
  function openInNewTab(html: string) {
    const srcdoc = html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const page = `<!doctype html><meta charset="utf-8"><style>html,body,iframe{margin:0;border:0;width:100%;height:100%;display:block}</style><iframe sandbox="allow-scripts" srcdoc="${srcdoc}"></iframe>`;
    const url = URL.createObjectURL(new Blob([page], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  async function copyHtml(html: string) {
    try {
      await navigator.clipboard.writeText(html);
      setToast("HTML source copied to clipboard.");
    } catch {
      setToast("Could not copy HTML to clipboard.");
    }
  }

  function resetFilters() {
    setSearch("");
    setCollection("");
    setFilter("All statuses");
    setSortBy("updated");
    setPage(1);
    if (nav === "Ready for dev") setNav("All designs");
  }

  function resetActivityFilters() {
    setActivitySearch("");
    setActivityDesignId("");
    setActivityStatus("All statuses");
    setActivityLimit(ACTIVITY_PAGE_SIZE);
  }

  const activeDesigns = useMemo(
    () => designs.filter((x) => !archivedIds.has(x.id)),
    [designs, archivedIds],
  );
  const archivedCount = designs.length - activeDesigns.length;
  const readyCount = activeDesigns.filter(
    (x) => last(x).status === "Ready for dev",
  ).length;
  const totalVersions = activeDesigns.reduce(
    (s, x) => s + x.versions.length,
    0,
  );
  const hasActiveFilters =
    Boolean(search) ||
    Boolean(collection) ||
    filter !== "All statuses" ||
    sortBy !== "updated";
  const hasActiveActivityFilters =
    Boolean(activitySearch) ||
    Boolean(activityDesignId) ||
    activityStatus !== "All statuses";

  function showWorkspace(view: string) {
    setNav(view);
    setSearch("");
    setCollection("");
    setFilter("All statuses");
    setPage(1);
    setTab("Overview");
    if (view === "Ready for dev") {
      const ready = activeDesigns.find(
        (design) => last(design).status === view,
      );
      if (ready) select(ready);
    } else if (view === "Archived") {
      const firstArchived = designs.find((design) =>
        archivedIds.has(design.id),
      );
      if (firstArchived) select(firstArchived);
    } else if (view === "All designs" && archivedIds.has(d.id)) {
      if (activeDesigns[0]) select(activeDesigns[0]);
    }
    requestAnimationFrame(() => {
      const results = document.getElementById("workspace-results");
      results?.scrollIntoView({ block: "start" });
      results?.focus({ preventScroll: true });
    });
  }

  const filtered = useMemo(
    () =>
      filterAndSortDesigns(designs, {
        search,
        collection,
        statusFilter: filter,
        nav,
        sortBy,
        pinnedIds,
        archivedIds,
      }),
    [designs, search, collection, filter, nav, sortBy, pinnedIds, archivedIds],
  );

  const pageSize =
    catalogView === "grid"
      ? GRID_PAGE_SIZE
      : catalogView === "split"
        ? SPLIT_PAGE_SIZE
        : LIST_PAGE_SIZE;
  const paginated = useMemo(
    () => paginateItems(filtered, page, pageSize, showAllDesigns),
    [filtered, page, pageSize, showAllDesigns],
  );
  const visibleDesigns = paginated.items;

  // Keep the selected project on the active page when selected externally.
  useEffect(() => {
    if (showAllDesigns) return;
    const idx = filtered.findIndex((x) => x.id === selected);
    if (idx >= 0) {
      const targetPage = Math.floor(idx / pageSize) + 1;
      setPage((curr) => (curr === targetPage ? curr : targetPage));
    }
  }, [selected, pageSize, showAllDesigns]);

  const allActivities = useMemo(
    () =>
      filterActivities(designs, {
        search: activitySearch,
        designId: activityDesignId,
        statusFilter: activityStatus,
        archivedIds,
      }),
    [designs, activitySearch, activityDesignId, activityStatus, archivedIds],
  );
  const visibleActivities = useMemo(
    () => allActivities.slice(0, activityLimit),
    [allActivities, activityLimit],
  );

  // Separate critical inspector fetches from low-priority card thumbnail fetches.
  const criticalWanted = [
    ...new Set(
      [v, ...(tab === "Compare" ? [left, right] : [])]
        .filter((z) => htmlOf(z) === undefined)
        .map((z) => z.id),
    ),
  ].join("\n");

  const thumbnailWanted = [
    ...new Set(
      (catalogView === "grid" && !browserCollapsed && nav !== "Recent activity"
        ? visibleDesigns.map(last)
        : []
      )
        .filter((z) => htmlOf(z) === undefined && observedVersionIds.has(z.id))
        .map((z) => z.id),
    ),
  ].join("\n");

  useEffect(() => {
    const fetchVersion = (id: string, lowPriority: boolean) => {
      if (fetching.current.has(id)) return;
      fetching.current.add(id);
      const init: RequestInit = lowPriority
        ? ({ priority: "low" } as RequestInit)
        : {};
      fetch(`/api/versions/${encodeURIComponent(id)}`, init)
        .then(async (r) => {
          if (r.status === 401) return window.location.assign("/login");
          const body: any = await r.json();
          if (!r.ok) throw Error(body.error);
          setHtmlCache((cache) => ({ ...cache, [id]: body.html }));
        })
        .catch((e) => {
          setHtmlCache((cache) => ({ ...cache, [id]: null }));
          setError(e instanceof Error ? e.message : "Preview unavailable");
        })
        .finally(() => fetching.current.delete(id));
    };

    for (const id of criticalWanted ? criticalWanted.split("\n") : []) {
      fetchVersion(id, false);
    }
    for (const id of thumbnailWanted ? thumbnailWanted.split("\n") : []) {
      fetchVersion(id, true);
    }
  }, [criticalWanted, thumbnailWanted]);

  return (
    <div
      className={
        tab === "Compare" && nav !== "Recent activity" && compactCompare
          ? "app comparing"
          : "app"
      }
    >
      <a href="#main-content" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <aside className="sidebar" aria-label="Studio sidebar">
        <a className="brand" href="/" aria-label="SA Studio home">
          <img
            className="brand-mark"
            src="/logo.svg"
            alt=""
            width="34"
            height="34"
          />
          <span className="brand-name">
            SA <em>Studio</em>
          </span>
        </a>

        <div className="workspace">
          <div className="workspace-icon" aria-hidden="true">
            D
          </div>
          <div className="workspace-meta">
            <strong>Design workspace</strong>
            <small>Product &amp; engineering</small>
          </div>
          <ChevronDown size={14} aria-hidden="true" />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace views">
          {[
            {
              label: "All designs",
              icon: LayoutGrid,
              count: activeDesigns.length,
            },
            { label: "Recent activity", icon: History, count: totalVersions },
            { label: "Ready for dev", icon: CheckCircle2, count: readyCount },
            { label: "Archived", icon: Archive, count: archivedCount },
          ].map(({ label, icon: Icon, count }) => {
            const isActive = nav === label && !collection;
            return (
              <button
                className={isActive ? "active" : ""}
                aria-current={isActive ? "page" : undefined}
                key={label}
                title={label}
                aria-label={label}
                onClick={() => showWorkspace(label)}
              >
                <Icon size={17} aria-hidden="true" />
                <span className="nav-item-text">{label}</span>
                <span className="nav-count">{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="nav-label projects-label">
          <span>COLLECTIONS</span>
          <Folder size={13} aria-hidden="true" />
        </div>
        <div className="collections-list" role="group" aria-label="Collections">
          {["Website", "Dashboard", "Web app"].map((c) => {
            const isSelected = collection === c && nav !== "Recent activity";
            return (
              <button
                key={c}
                className={"collection" + (isSelected ? " active" : "")}
                aria-pressed={isSelected}
                onClick={() => {
                  if (isSelected) {
                    setCollection("");
                  } else {
                    setNav("All designs");
                    setCollection(c);
                    setSearch("");
                    setFilter("All statuses");
                    const p = activeDesigns.find((x) => x.category === c);
                    if (p) select(p);
                  }
                }}
              >
                <span
                  className={"dot " + c.replace(" ", "")}
                  aria-hidden="true"
                />
                <span className="collection-name">{c}</span>
                <span>
                  {activeDesigns.filter((x) => x.category === c).length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-bottom">
          <div className="tip">
            <span className="tip-icon" aria-hidden="true">
              ✳
            </span>
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
            <div className="avatar" aria-hidden="true">
              YO
            </div>
            <div>
              <strong>Your workspace</strong>
              <small>Team studio</small>
            </div>
            <span
              className="online"
              title="Connected"
              aria-label="Workspace online"
            />
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="breadcrumbs" aria-label="Breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} aria-hidden="true" />
            <button
              type="button"
              className="breadcrumb-link"
              onClick={() => setCollection("")}
            >
              <strong>{nav}</strong>
            </button>
            {collection && (
              <>
                <ChevronRight size={13} aria-hidden="true" />
                <span className="breadcrumb-pill">
                  <span
                    className={"dot " + collection.replace(" ", "")}
                    aria-hidden="true"
                  />
                  {collection}
                  <button
                    type="button"
                    aria-label={`Clear ${collection} filter`}
                    onClick={() => setCollection("")}
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              </>
            )}
            {nav !== "Recent activity" && d && (
              <>
                <ChevronRight size={13} aria-hidden="true" />
                <span className="breadcrumb-current">{d.name}</span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <span className="connection-pill">
              <span className="save-dot" aria-hidden="true" />
              <span className="connection-text">
                {saved ? "Shared storage connected" : "Connecting to studio"}
              </span>
            </span>
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

        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">A HOME FOR YOUR NEXT ITERATION</div>
              <h1>
                {nav === "Recent activity"
                  ? "Recent activity"
                  : nav === "Ready for dev"
                    ? "Ready for development"
                    : nav === "Archived"
                      ? "Archived projects"
                      : collection
                        ? `${collection} designs`
                        : "Designs in progress"}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                From first idea to final handoff. Keep everyone on the same
                version.
              </p>
            </div>
            <button className="primary" onClick={() => openUpload("new")}>
              <Plus size={17} aria-hidden="true" />
              <span>New design</span>
            </button>
          </div>

          <div className="stats" role="region" aria-label="Workspace summary">
            <button
              type="button"
              className={
                "stat-card" +
                (nav === "All designs" && !hasActiveFilters ? " active" : "")
              }
              aria-pressed={nav === "All designs" && !hasActiveFilters}
              onClick={() => showWorkspace("All designs")}
            >
              <span className="stat-icon lavender" aria-hidden="true">
                <Layers size={18} />
              </span>
              <div>
                <strong>
                  {activeDesigns.length}
                  <span>designs</span>
                </strong>
                <small>Ideas taking shape</small>
              </div>
            </button>
            <button
              type="button"
              className={
                "stat-card" + (nav === "Recent activity" ? " active" : "")
              }
              aria-pressed={nav === "Recent activity"}
              onClick={() => showWorkspace("Recent activity")}
            >
              <span className="stat-icon peach" aria-hidden="true">
                <History size={18} />
              </span>
              <div>
                <strong>
                  {totalVersions}
                  <span>versions</span>
                </strong>
                <small>Every iteration accounted for</small>
              </div>
            </button>
            <button
              type="button"
              className={
                "stat-card" + (nav === "Ready for dev" ? " active" : "")
              }
              aria-pressed={nav === "Ready for dev"}
              onClick={() => showWorkspace("Ready for dev")}
            >
              <span className="stat-icon mint" aria-hidden="true">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <strong>
                  {readyCount}
                  <span>ready for dev</span>
                </strong>
                <small>Good to build</small>
              </div>
            </button>
            <div className="stat-note">
              <span aria-hidden="true">✧</span>
              <div>
                Good design is a conversation.
                <br />
                Keep it going.
              </div>
            </div>
          </div>

          {error && !modal && (
            <div className="connection-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
              <button onClick={load}>Retry connection</button>
            </div>
          )}

          {nav === "Recent activity" ? (
            <section
              className="activity-page"
              id="workspace-results"
              tabIndex={-1}
            >
              <div className="activity-header">
                <div>
                  <h2>
                    The latest iterations <span>{allActivities.length}</span>
                  </h2>
                  <p className="activity-subtitle">
                    Chronological log of every prototype revision across your
                    workspace.
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => showWorkspace("All designs")}
                >
                  <LayoutGrid size={14} aria-hidden="true" /> Back to grid
                </button>
              </div>
              <div
                className="activity-toolbar"
                role="region"
                aria-label="Filter recent activity"
              >
                <div className="search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    aria-label="Search activity by author, notes, project, or tool"
                    placeholder="Search author, notes, project, tool…"
                    value={activitySearch}
                    onChange={(e) => {
                      setActivitySearch(e.target.value);
                      setActivityLimit(ACTIVITY_PAGE_SIZE);
                    }}
                  />
                  {activitySearch && (
                    <button
                      type="button"
                      className="clear-search"
                      aria-label="Clear activity search"
                      onClick={() => {
                        setActivitySearch("");
                        setActivityLimit(ACTIVITY_PAGE_SIZE);
                      }}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Filter activity by project"
                  value={activityDesignId}
                  onChange={(e) => {
                    setActivityDesignId(e.target.value);
                    setActivityLimit(ACTIVITY_PAGE_SIZE);
                  }}
                >
                  <option value="">All projects</option>
                  {activeDesigns.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter activity by status"
                  value={activityStatus}
                  onChange={(e) => {
                    setActivityStatus(e.target.value);
                    setActivityLimit(ACTIVITY_PAGE_SIZE);
                  }}
                >
                  <option>All statuses</option>
                  <option>In review</option>
                  <option>Ready for dev</option>
                  <option>Superseded</option>
                </select>
                {hasActiveActivityFilters && (
                  <button
                    type="button"
                    className="secondary reset-btn"
                    onClick={resetActivityFilters}
                  >
                    <RotateCcw size={13} aria-hidden="true" /> Reset
                  </button>
                )}
              </div>
              {visibleActivities.map(({ d: x, v: itemVersion }) => (
                <button
                  key={itemVersion.id}
                  onClick={() => {
                    select(x, false, true);
                    setRevision(
                      x.versions.findIndex((z) => z.id === itemVersion.id),
                    );
                    setNav("All designs");
                  }}
                >
                  <div className="avatar purple" aria-hidden="true">
                    {itemVersion.author
                      .split(" ")
                      .map((s) => s[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="activity-title-row">
                      <span>
                        <strong>{itemVersion.author}</strong> uploaded{" "}
                        <b>v{itemVersion.number}</b> of{" "}
                        <strong>{x.name}</strong>
                      </span>
                      <span
                        className={"status " + statusClass(itemVersion.status)}
                      >
                        <i aria-hidden="true" />
                        {itemVersion.status}
                      </span>
                    </div>
                    <p>{itemVersion.notes}</p>
                  </div>
                  <small>
                    {new Date(itemVersion.createdAt).toLocaleDateString(
                      "en-GB",
                      {
                        day: "numeric",
                        month: "short",
                      },
                    )}
                  </small>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </button>
              ))}
              {!visibleActivities.length && (
                <div className="empty">
                  <p>
                    No activity revisions match these filters. Try adjusting
                    your search or project selection.
                  </p>
                  {hasActiveActivityFilters && (
                    <div className="empty-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={resetActivityFilters}
                      >
                        <RotateCcw size={14} aria-hidden="true" /> Reset
                        activity filters
                      </button>
                    </div>
                  )}
                </div>
              )}
              {allActivities.length > ACTIVITY_PAGE_SIZE && (
                <div className="activity-pagination">
                  <span className="pagination-summary">
                    Showing {visibleActivities.length} of {allActivities.length}{" "}
                    revisions
                  </span>
                  <div className="pagination-actions">
                    {activityLimit < allActivities.length && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setActivityLimit((n) => n + ACTIVITY_PAGE_SIZE)
                        }
                      >
                        Show more activity (
                        {allActivities.length - activityLimit} remaining)
                      </button>
                    )}
                    {activityLimit > ACTIVITY_PAGE_SIZE && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setActivityLimit(ACTIVITY_PAGE_SIZE)}
                      >
                        Show fewer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <>
              <div
                ref={catalogRef}
                className="section-heading"
                id="workspace-results"
                tabIndex={-1}
              >
                <div>
                  <h2>
                    {nav === "Archived" ? "Archived designs" : "Your designs"}{" "}
                    <span>{filtered.length}</span>
                  </h2>
                  <small>
                    {nav === "Archived"
                      ? "Projects stored away from the active workspace. Restore any project to bring it back."
                      : "One place for all your AI-generated explorations. Select a project to inspect or compare below."}
                  </small>
                </div>
                <div className="tools">
                  <div
                    className="category-pills"
                    role="group"
                    aria-label="Filter by category"
                  >
                    {["All", "Website", "Dashboard", "Web app"].map((cat) => {
                      const active =
                        (cat === "All" && !collection) || collection === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={"pill-btn" + (active ? " active" : "")}
                          aria-pressed={active}
                          onClick={() => {
                            setCollection(cat === "All" ? "" : cat);
                            setPage(1);
                          }}
                        >
                          {cat !== "All" && (
                            <span
                              className={"dot " + cat.replace(" ", "")}
                              aria-hidden="true"
                            />
                          )}
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  <div className="search">
                    <Search size={15} aria-hidden="true" />
                    <input
                      ref={searchInputRef}
                      aria-label="Search designs by name, author, tool, or notes"
                      placeholder="Search name, author, tool… (/)"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                        if (browserCollapsed) setBrowserCollapsed(false);
                      }}
                    />
                    {search && (
                      <button
                        type="button"
                        className="clear-search"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearch("");
                          setPage(1);
                          searchInputRef.current?.focus();
                        }}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <select
                    aria-label="Filter by status"
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option>All statuses</option>
                    <option>In review</option>
                    <option>Ready for dev</option>
                  </select>
                  <label className="sort-control">
                    <ArrowUpDown size={13} aria-hidden="true" />
                    <select
                      aria-label="Sort designs"
                      value={sortBy}
                      onChange={(e) => {
                        setSortBy(e.target.value as SortOption);
                        setPage(1);
                      }}
                    >
                      <option value="updated">Sort: Latest updated</option>
                      <option value="created">Sort: Newest created</option>
                      <option value="name">Sort: Name (A–Z)</option>
                      <option value="versions">Sort: Most versions</option>
                    </select>
                  </label>
                  <div
                    className="view-switcher"
                    role="group"
                    aria-label="Catalog view mode"
                  >
                    <button
                      type="button"
                      className={catalogView === "grid" ? "active" : ""}
                      aria-pressed={catalogView === "grid"}
                      aria-label="Grid view"
                      title="Grid view (with thumbnails)"
                      onClick={() => {
                        setCatalogView("grid");
                        setBrowserCollapsed(false);
                      }}
                    >
                      <LayoutGrid size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={catalogView === "list" ? "active" : ""}
                      aria-pressed={catalogView === "list"}
                      aria-label="Compact list view"
                      title="Compact list view (fast scanning)"
                      onClick={() => {
                        setCatalogView("list");
                        setBrowserCollapsed(false);
                      }}
                    >
                      <List size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={catalogView === "split" ? "active" : ""}
                      aria-pressed={catalogView === "split"}
                      aria-label="Split-pane master-detail view"
                      title="Split view (side-by-side project rail and inspector)"
                      onClick={() => {
                        setCatalogView("split");
                        setBrowserCollapsed(false);
                      }}
                    >
                      <PanelLeft size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="secondary collapse-catalog-btn"
                    aria-expanded={!browserCollapsed}
                    onClick={() => setBrowserCollapsed((prev) => !prev)}
                    title={
                      browserCollapsed
                        ? "Expand project catalog"
                        : "Collapse catalog to focus on inspector"
                    }
                  >
                    {browserCollapsed ? (
                      <>
                        <ChevronDown size={14} aria-hidden="true" /> Expand (
                        {filtered.length})
                      </>
                    ) : (
                      <>
                        <ChevronUp size={14} aria-hidden="true" /> Collapse
                      </>
                    )}
                  </button>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      className="secondary reset-btn"
                      onClick={resetFilters}
                      title="Reset active filters"
                    >
                      <RotateCcw size={13} aria-hidden="true" /> Reset
                    </button>
                  )}
                </div>
              </div>

              <div
                className={
                  catalogView === "split" && !browserCollapsed
                    ? "workspace-split"
                    : "workspace-stack"
                }
              >
                {browserCollapsed ? (
                  <div
                    className="collapsed-catalog-bar"
                    role="region"
                    aria-label="Quick project switcher"
                  >
                    <div className="collapsed-catalog-current">
                      <span className="active-card-badge inline">
                        Inspecting
                      </span>
                      <span
                        className={"dot " + d.category.replace(" ", "")}
                        aria-hidden="true"
                      />
                      <strong>{d.name}</strong>
                      <span className="collapsed-meta">
                        v{latestVersion.number} · {d.versions.length} version
                        {d.versions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="collapsed-catalog-actions">
                      <label className="quick-jump-label">
                        <span>Switch project:</span>
                        <select
                          aria-label="Quick switch project"
                          value={d.id}
                          onChange={(e) => {
                            const target = designs.find(
                              (x) => x.id === e.target.value,
                            );
                            if (target) select(target, true);
                          }}
                        >
                          {(filtered.length ? filtered : activeDesigns).map(
                            (x) => (
                              <option key={x.id} value={x.id}>
                                {pinnedIds.has(x.id) ? "★ " : ""}
                                {x.name} ({x.category} · v{last(x).number})
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setBrowserCollapsed(false)}
                      >
                        <ChevronDown size={14} aria-hidden="true" /> Show all{" "}
                        {filtered.length} projects
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="split-catalog-pane">
                    {catalogView === "grid" ? (
                      <div className="design-grid">
                        {visibleDesigns.map((x) => {
                          const latest = last(x);
                          const isCardSelected = x.id === d.id;
                          const isPinned = pinnedIds.has(x.id);
                          const isArchived = archivedIds.has(x.id);
                          return (
                            <button
                              key={x.id}
                              className={
                                "design-card " +
                                (isCardSelected ? "selected" : "")
                              }
                              aria-pressed={isCardSelected}
                              onClick={() => select(x, false, true)}
                            >
                              <div
                                className={
                                  "thumbnail " + x.category.replace(" ", "")
                                }
                              >
                                <LazyThumbnail
                                  versionId={latest.id}
                                  title={x.name + " miniature"}
                                  srcDoc={previewDoc(latest)}
                                  ready={htmlOf(latest) !== undefined}
                                  onVisible={markVersionVisible}
                                />
                                <span className="version-pill">
                                  v{latest.number}
                                </span>
                                {isCardSelected && (
                                  <span className="active-card-badge">
                                    Inspecting
                                  </span>
                                )}
                              </div>
                              <div className="card-body">
                                <div className="card-title">
                                  <h3>{x.name}</h3>
                                  <ArrowUpRight size={17} aria-hidden="true" />
                                </div>
                                <div className="card-meta">
                                  <span
                                    className={
                                      "dot " + x.category.replace(" ", "")
                                    }
                                    aria-hidden="true"
                                  />
                                  <span>{x.category}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {x.versions.length} version
                                    {x.versions.length !== 1 ? "s" : ""}
                                  </span>
                                  {isPinned && (
                                    <span
                                      className="pinned-badge"
                                      title="Pinned project"
                                    >
                                      <Pin size={10} aria-hidden="true" />{" "}
                                      Pinned
                                    </span>
                                  )}
                                  {isArchived && (
                                    <span className="archived-badge">
                                      Archived
                                    </span>
                                  )}
                                  {x.example && (
                                    <span className="example">Example</span>
                                  )}
                                </div>
                                <div className="card-footer">
                                  <span
                                    className={
                                      "status " + statusClass(latest.status)
                                    }
                                  >
                                    <i aria-hidden="true" />
                                    {latest.status}
                                  </span>
                                  <div className="card-author">
                                    <span
                                      className="tiny-avatar"
                                      aria-hidden="true"
                                    >
                                      {latest.author
                                        .split(" ")
                                        .map((s) => s[0])
                                        .join("")}
                                    </span>
                                    <span>
                                      {new Date(
                                        latest.createdAt,
                                      ).toLocaleDateString("en-GB", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {!filtered.length && (
                          <div className="empty">
                            <p>
                              {nav === "Archived"
                                ? "No archived projects yet. Archive any project from the inspector to store it here."
                                : "No designs match this view. Try clearing your filters or upload a new HTML prototype."}
                            </p>
                            <div className="empty-actions">
                              {hasActiveFilters && (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={resetFilters}
                                >
                                  <RotateCcw size={14} aria-hidden="true" />{" "}
                                  Reset filters
                                </button>
                              )}
                              {nav === "Archived" ? (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => showWorkspace("All designs")}
                                >
                                  <LayoutGrid size={14} aria-hidden="true" />{" "}
                                  View active designs
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="primary small"
                                  onClick={() => openUpload("new")}
                                >
                                  <Plus size={14} aria-hidden="true" /> New
                                  design
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="design-list"
                        role="region"
                        aria-label={
                          catalogView === "split"
                            ? "Docked project rail"
                            : "Compact project list"
                        }
                      >
                        {visibleDesigns.map((x) => {
                          const latest = last(x);
                          const isRowSelected = x.id === d.id;
                          const isPinned = pinnedIds.has(x.id);
                          const isArchived = archivedIds.has(x.id);
                          return (
                            <button
                              key={x.id}
                              type="button"
                              className={
                                "design-row" +
                                (isRowSelected ? " selected" : "")
                              }
                              aria-pressed={isRowSelected}
                              onClick={() => select(x, false, true)}
                            >
                              <div className="design-row-main">
                                <span
                                  className={
                                    "dot " + x.category.replace(" ", "")
                                  }
                                  aria-hidden="true"
                                />
                                <strong className="design-row-name">
                                  {x.name}
                                </strong>
                                {isRowSelected && (
                                  <span className="active-card-badge inline">
                                    Inspecting
                                  </span>
                                )}
                                {isPinned && (
                                  <span
                                    className="pinned-badge"
                                    title="Pinned project"
                                  >
                                    <Pin size={10} aria-hidden="true" /> Pinned
                                  </span>
                                )}
                                {isArchived && (
                                  <span className="archived-badge">
                                    Archived
                                  </span>
                                )}
                                {x.example && (
                                  <span className="example">Example</span>
                                )}
                              </div>
                              <div className="design-row-meta">
                                <span className="design-row-category">
                                  {x.category}
                                </span>
                                <span className="design-row-versions">
                                  v{latest.number} · {x.versions.length} rev
                                  {x.versions.length !== 1 ? "s" : ""}
                                </span>
                                <span className="source-badge compact">
                                  <Command size={11} aria-hidden="true" />
                                  {latest.source}
                                </span>
                                <span
                                  className={
                                    "status " + statusClass(latest.status)
                                  }
                                >
                                  <i aria-hidden="true" />
                                  {latest.status}
                                </span>
                                <span className="card-author">
                                  <span
                                    className="tiny-avatar"
                                    aria-hidden="true"
                                  >
                                    {latest.author
                                      .split(" ")
                                      .map((s) => s[0])
                                      .join("")}
                                  </span>
                                  <span className="row-author-name">
                                    {latest.author}
                                  </span>
                                  <span>
                                    {new Date(
                                      latest.createdAt,
                                    ).toLocaleDateString("en-GB", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </span>
                                <ArrowUpRight
                                  size={16}
                                  className="row-arrow"
                                  aria-hidden="true"
                                />
                              </div>
                            </button>
                          );
                        })}
                        {!filtered.length && (
                          <div className="empty">
                            <p>
                              {nav === "Archived"
                                ? "No archived projects yet. Archive any project from the inspector to store it here."
                                : "No designs match this view. Try clearing your filters or upload a new HTML prototype."}
                            </p>
                            <div className="empty-actions">
                              {hasActiveFilters && (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={resetFilters}
                                >
                                  <RotateCcw size={14} aria-hidden="true" />{" "}
                                  Reset filters
                                </button>
                              )}
                              {nav === "Archived" ? (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => showWorkspace("All designs")}
                                >
                                  <LayoutGrid size={14} aria-hidden="true" />{" "}
                                  View active designs
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="primary small"
                                  onClick={() => openUpload("new")}
                                >
                                  <Plus size={14} aria-hidden="true" /> New
                                  design
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {filtered.length > pageSize && (
                      <nav
                        className="catalog-pagination"
                        aria-label="Design catalog pagination"
                      >
                        <span className="pagination-summary">
                          {showAllDesigns
                            ? `Showing all ${filtered.length} designs`
                            : `Showing ${paginated.startIndex}–${paginated.endIndex} of ${filtered.length} designs`}
                        </span>
                        <div className="pagination-controls">
                          {!showAllDesigns && paginated.totalPages > 1 && (
                            <div
                              className="page-buttons"
                              role="group"
                              aria-label="Pages"
                            >
                              <button
                                type="button"
                                className="secondary page-btn"
                                disabled={paginated.currentPage <= 1}
                                aria-label="Previous page"
                                onClick={() =>
                                  setPage((p) => Math.max(1, p - 1))
                                }
                              >
                                <ChevronLeft size={14} aria-hidden="true" />{" "}
                                Prev
                              </button>
                              {pageSequence(
                                paginated.currentPage,
                                paginated.totalPages,
                              ).map((item, idx) =>
                                item === "ellipsis" ? (
                                  <span
                                    key={`ellipsis-${idx}`}
                                    className="page-ellipsis"
                                    aria-hidden="true"
                                  >
                                    …
                                  </span>
                                ) : (
                                  <button
                                    key={item}
                                    type="button"
                                    className={
                                      "page-num" +
                                      (item === paginated.currentPage
                                        ? " active"
                                        : "")
                                    }
                                    aria-current={
                                      item === paginated.currentPage
                                        ? "page"
                                        : undefined
                                    }
                                    onClick={() => setPage(item)}
                                  >
                                    {item}
                                  </button>
                                ),
                              )}
                              <button
                                type="button"
                                className="secondary page-btn"
                                disabled={
                                  paginated.currentPage >= paginated.totalPages
                                }
                                aria-label="Next page"
                                onClick={() =>
                                  setPage((p) =>
                                    Math.min(paginated.totalPages, p + 1),
                                  )
                                }
                              >
                                Next{" "}
                                <ChevronRight size={14} aria-hidden="true" />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            className="secondary toggle-all-btn"
                            onClick={() => setShowAllDesigns((prev) => !prev)}
                          >
                            {showAllDesigns
                              ? `Paginate (${pageSize} per page)`
                              : `Show all (${filtered.length})`}
                          </button>
                        </div>
                      </nav>
                    )}
                  </div>
                )}

                <section
                  ref={detailRef}
                  className="detail"
                  aria-label={`${d.name} workspace`}
                >
                  <div className="detail-header">
                    <div>
                      <div className="detail-overline">
                        <span
                          className={"dot " + d.category.replace(" ", "")}
                          aria-hidden="true"
                        />
                        <span>{d.category}</span>
                        {d.example && <span>• Example project</span>}
                        <span>• {d.versions.length} revisions</span>
                      </div>
                      <div className="detail-title-row">
                        <h2>
                          {d.name}{" "}
                          <span className="current-version">v{v.number}</span>
                        </h2>
                        {d.versions.length > 1 && (
                          <div
                            className="version-switcher"
                            role="group"
                            aria-label="Switch version"
                          >
                            {(d.versions.length <= 6
                              ? d.versions
                              : d.versions.slice(-5)
                            ).map((ver) => {
                              const idx = d.versions.indexOf(ver);
                              const active = ver.id === v.id;
                              return (
                                <button
                                  key={ver.id}
                                  type="button"
                                  className={
                                    "version-chip" + (active ? " active" : "")
                                  }
                                  aria-pressed={active}
                                  title={`View v${ver.number} by ${ver.author}`}
                                  onClick={() => {
                                    setRevision(
                                      idx === d.versions.length - 1
                                        ? null
                                        : idx,
                                    );
                                    if (tab === "Compare") setTab("Overview");
                                  }}
                                >
                                  v{ver.number}
                                </button>
                              );
                            })}
                            {d.versions.length > 6 && (
                              <select
                                aria-label="Jump to any version"
                                className="version-jump-select"
                                value={d.versions.indexOf(v)}
                                onChange={(e) => {
                                  const idx = +e.target.value;
                                  setRevision(
                                    idx === d.versions.length - 1 ? null : idx,
                                  );
                                  if (tab === "Compare") setTab("Overview");
                                }}
                              >
                                {d.versions.map((ver, idx) => (
                                  <option key={ver.id} value={idx}>
                                    v{ver.number} ({ver.author})
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="detail-actions">
                      {(catalogView !== "split" || browserCollapsed) && (
                        <button
                          type="button"
                          className="secondary"
                          title="Scroll back to project catalog"
                          onClick={() => {
                            setBrowserCollapsed(false);
                            requestAnimationFrame(() => {
                              catalogRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                            });
                          }}
                        >
                          <ArrowUp size={14} aria-hidden="true" /> Projects
                        </button>
                      )}
                      <button
                        type="button"
                        className={
                          "secondary" +
                          (pinnedIds.has(d.id) ? " active-toggle" : "")
                        }
                        aria-pressed={pinnedIds.has(d.id)}
                        title={
                          pinnedIds.has(d.id)
                            ? "Unpin project"
                            : "Pin project to top of catalog"
                        }
                        onClick={() => togglePin(d.id)}
                      >
                        <Pin size={14} aria-hidden="true" />{" "}
                        {pinnedIds.has(d.id) ? "Pinned" : "Pin"}
                      </button>
                      <button
                        type="button"
                        className={
                          "secondary" +
                          (archivedIds.has(d.id) ? " active-toggle" : "")
                        }
                        aria-pressed={archivedIds.has(d.id)}
                        title={
                          archivedIds.has(d.id)
                            ? "Restore project to active workspace"
                            : "Archive project"
                        }
                        onClick={() => toggleArchive(d)}
                      >
                        <Archive size={14} aria-hidden="true" />{" "}
                        {archivedIds.has(d.id) ? "Restore" : "Archive"}
                      </button>
                      {!d.example && (
                        <button
                          type="button"
                          className="secondary danger-btn"
                          title="Delete project permanently"
                          onClick={() => removeDesign(d)}
                        >
                          <Trash2 size={14} aria-hidden="true" /> Delete
                        </button>
                      )}
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
                        <ArrowUpRight size={14} aria-hidden="true" /> Share
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setTab("Compare");
                          setFrom(Math.max(0, d.versions.length - 2));
                          setTo(d.versions.length - 1);
                        }}
                      >
                        <Columns2 size={15} aria-hidden="true" /> Compare
                        versions
                      </button>
                      <button
                        className="primary small"
                        onClick={() => openUpload("version")}
                      >
                        <Upload size={15} aria-hidden="true" /> Upload new
                        version
                      </button>
                    </div>
                  </div>

                  <div
                    className="tabs"
                    role="tablist"
                    aria-label="Design views"
                  >
                    {["Overview", "History", "Compare"].map((t) => (
                      <button
                        key={t}
                        role="tab"
                        aria-selected={t === tab}
                        className={t === tab ? "active" : ""}
                        onClick={() => setTab(t)}
                      >
                        {t === "Overview" ? (
                          <Eye size={15} aria-hidden="true" />
                        ) : t === "History" ? (
                          <History size={15} aria-hidden="true" />
                        ) : (
                          <Columns2 size={15} aria-hidden="true" />
                        )}{" "}
                        {t}
                        {t === "History" && <span>{d.versions.length}</span>}
                      </button>
                    ))}
                    <span className="last-update">
                      Updated{" "}
                      {new Date(latestVersion.createdAt).toLocaleDateString(
                        "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                        },
                      )}
                    </span>
                  </div>

                  {tab === "Overview" && (
                    <div className="overview" role="tabpanel">
                      <div className="preview">
                        {isHistorical && (
                          <div className="historical-banner" role="status">
                            <span>
                              Viewing historical <strong>v{v.number}</strong> (
                              {v.status})
                            </span>
                            <button
                              type="button"
                              onClick={() => setRevision(null)}
                            >
                              Return to latest (v{latestVersion.number}) →
                            </button>
                          </div>
                        )}
                        <div className="preview-toolbar">
                          <span className="browser-dots" aria-hidden="true">
                            <span className="browser-dot" />
                            <span className="browser-dot" />
                            <span className="browser-dot" />
                          </span>
                          <small className="preview-filename">
                            {d.name.toLowerCase().replace(/ /g, "-")}-v
                            {v.number}.html
                          </small>
                          <div className="preview-controls">
                            <div
                              className="viewport-switcher"
                              role="group"
                              aria-label="Preview viewport size"
                            >
                              {(
                                [
                                  {
                                    id: "desktop",
                                    label: "Desktop preview",
                                    icon: Monitor,
                                  },
                                  {
                                    id: "tablet",
                                    label: "Tablet preview (768px)",
                                    icon: Tablet,
                                  },
                                  {
                                    id: "mobile",
                                    label: "Mobile preview (390px)",
                                    icon: Smartphone,
                                  },
                                ] as const
                              ).map(({ id, label, icon: ViewportIcon }) => (
                                <button
                                  key={id}
                                  type="button"
                                  className={viewport === id ? "active" : ""}
                                  aria-label={label}
                                  aria-pressed={viewport === id}
                                  title={label}
                                  onClick={() => setViewport(id)}
                                >
                                  <ViewportIcon size={13} aria-hidden="true" />
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="toolbar-icon-btn"
                              aria-label="Copy HTML source"
                              title="Copy HTML source"
                              disabled={htmlOf(v) == null}
                              onClick={() => {
                                const html = htmlOf(v);
                                if (html != null) copyHtml(html);
                              }}
                            >
                              <Copy size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="toolbar-icon-btn"
                              aria-label="Open preview in new tab"
                              title="Open preview in new tab"
                              disabled={htmlOf(v) == null}
                              onClick={() => {
                                const html = htmlOf(v);
                                if (html != null) openInNewTab(html);
                              }}
                            >
                              <ExternalLink size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="toolbar-icon-btn"
                              aria-label="Download HTML"
                              title="Download HTML"
                              disabled={htmlOf(v) == null}
                              onClick={() => {
                                const html = htmlOf(v);
                                if (html != null)
                                  download(html, `${d.name}-v${v.number}.html`);
                              }}
                            >
                              <Download size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        <div className={"preview-stage " + viewport}>
                          <iframe
                            title="Design preview"
                            sandbox="allow-scripts"
                            srcDoc={previewDoc(v)}
                          />
                        </div>
                        <div className="preview-foot">
                          <span>
                            <Eye size={13} aria-hidden="true" /> Sandboxed HTML
                            preview ·{" "}
                            {viewport === "desktop"
                              ? "Responsive (100%)"
                              : viewport === "tablet"
                                ? "Tablet (768px)"
                                : "Mobile (390px)"}
                          </span>
                          <span>
                            Version {v.number} of {d.versions.length}
                          </span>
                        </div>
                      </div>

                      <aside className="version-info">
                        <div className="info-heading">
                          <h3>
                            {revision === null
                              ? "Latest iteration"
                              : `Revision v${v.number}`}
                          </h3>
                          <span className={"status " + statusClass(v.status)}>
                            <i aria-hidden="true" />
                            {v.status}
                          </span>
                        </div>
                        <div className="person">
                          <div className="avatar purple" aria-hidden="true">
                            {v.author
                              .split(" ")
                              .map((s) => s[0])
                              .join("")}
                          </div>
                          <div>
                            <strong>{v.author}</strong>
                            <small>
                              {v.role} ·{" "}
                              {new Date(v.createdAt).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                },
                              )}
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
                            <Command size={12} aria-hidden="true" />
                            {v.source}
                          </span>
                        </div>
                        <div className="handoff">
                          <span>
                            <Code2 size={16} aria-hidden="true" />
                            <strong>Developer handoff</strong>
                          </span>
                          <p>
                            Review the changes, then give your team a clear
                            version to build.
                          </p>
                          <button onClick={status}>
                            {v.status === "Ready for dev" ? (
                              <>
                                <History size={14} aria-hidden="true" /> Move
                                back to review
                              </>
                            ) : (
                              <>
                                <Check size={14} aria-hidden="true" /> Mark
                                ready for dev
                              </>
                            )}
                          </button>
                        </div>
                      </aside>
                    </div>
                  )}

                  {tab === "History" && (
                    <div className="history-list" role="tabpanel">
                      <p className="history-intro">
                        A complete trail of decisions. Select a revision to open
                        its interactive preview or compare it against the
                        latest.
                      </p>
                      {[...d.versions].reverse().map((z, i) => {
                        const idx = d.versions.indexOf(z);
                        const isCurrentPreview = z.id === v.id;
                        return (
                          <div
                            className={
                              "history-item" +
                              (isCurrentPreview ? " current" : "")
                            }
                            key={z.id}
                          >
                            <div className="timeline-node" aria-hidden="true">
                              <History size={15} />
                            </div>
                            <div className="history-content">
                              <div>
                                <h3>
                                  Version {z.number}{" "}
                                  {i === 0 && (
                                    <span className="latest">LATEST</span>
                                  )}
                                  {isCurrentPreview && i !== 0 && (
                                    <span className="viewing-badge">
                                      VIEWING
                                    </span>
                                  )}
                                </h3>
                                <span
                                  className={"status " + statusClass(z.status)}
                                >
                                  <i aria-hidden="true" />
                                  {z.status}
                                </span>
                              </div>
                              <p>{z.notes || "No version notes."}</p>
                              <small>
                                {z.author} · {z.role} · {z.source} ·{" "}
                                {new Date(z.createdAt).toLocaleString("en-GB")}
                              </small>
                            </div>
                            <div className="history-actions">
                              {d.versions.length > 1 && i !== 0 && (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => {
                                    setFrom(idx);
                                    setTo(d.versions.length - 1);
                                    setTab("Compare");
                                  }}
                                >
                                  <Columns2 size={14} aria-hidden="true" /> Diff
                                  vs latest
                                </button>
                              )}
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => {
                                  setRevision(
                                    idx === d.versions.length - 1 ? null : idx,
                                  );
                                  setTab("Overview");
                                }}
                              >
                                View version{" "}
                                <ArrowUpRight size={14} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {tab === "Compare" && (
                    <div className="compare" role="tabpanel">
                      {d.versions.length < 2 && (
                        <div className="single-version-banner">
                          <div>
                            <strong>Only 1 version in {d.name} so far</strong>
                            <p>
                              Upload a second iteration to compare side-by-side
                              previews and inspect line-by-line HTML diffs.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="primary small"
                            onClick={() => openUpload("version")}
                          >
                            <Upload size={14} aria-hidden="true" /> Upload v2
                          </button>
                        </div>
                      )}
                      <div className="compare-toolbar">
                        <div className="compare-selectors">
                          <label className="compare-select-group">
                            <span className="compare-select-label">Before</span>
                            <select
                              aria-label="Previous version"
                              value={leftIndex}
                              onChange={(e) => setFrom(+e.target.value)}
                            >
                              {d.versions.map((z, i) => (
                                <option value={i} key={z.id}>
                                  v{z.number} · {z.author}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="swap-btn"
                            title="Swap compared versions"
                            aria-label="Swap compared versions"
                            onClick={() => {
                              setFrom(rightIndex);
                              setTo(leftIndex);
                            }}
                          >
                            <ArrowLeftRight size={15} aria-hidden="true" />
                          </button>
                          <label className="compare-select-group">
                            <span className="compare-select-label">After</span>
                            <select
                              aria-label="Next version"
                              value={rightIndex}
                              onChange={(e) => setTo(+e.target.value)}
                            >
                              {d.versions.map((z, i) => (
                                <option value={i} key={z.id}>
                                  v{z.number} · {z.author}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="compare-controls-right">
                          {view === "Visual" && (
                            <button
                              type="button"
                              className={
                                "secondary diff-filter-btn" +
                                (highlights ? " active" : "")
                              }
                              aria-pressed={highlights}
                              onClick={() => setHighlights((prev) => !prev)}
                            >
                              <Eye size={14} aria-hidden="true" /> Highlight
                              changes
                            </button>
                          )}
                          {view === "Code" && (
                            <button
                              type="button"
                              className={
                                "secondary diff-filter-btn" +
                                (diffOnly ? " active" : "")
                              }
                              aria-pressed={diffOnly}
                              onClick={() => setDiffOnly((prev) => !prev)}
                            >
                              {diffOnly
                                ? "Showing changes only"
                                : "Changes only"}
                            </button>
                          )}
                          <div
                            className="segmented"
                            role="group"
                            aria-label="Comparison mode"
                          >
                            {["Visual", "Code"].map((t) => (
                              <button
                                key={t}
                                type="button"
                                aria-pressed={view === t}
                                className={view === t ? "active" : ""}
                                onClick={() => setView(t)}
                              >
                                {t === "Visual" ? (
                                  <Columns2 size={13} aria-hidden="true" />
                                ) : (
                                  <Code2 size={13} aria-hidden="true" />
                                )}{" "}
                                {t}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="secondary workspace-toggle"
                            onClick={() => setCompactCompare((prev) => !prev)}
                            title={
                              compactCompare
                                ? "Show full studio navigation"
                                : "Expand comparison workspace"
                            }
                          >
                            {compactCompare ? (
                              <>
                                <Minimize2 size={13} aria-hidden="true" /> Show
                                grid
                              </>
                            ) : (
                              <>
                                <Maximize2 size={13} aria-hidden="true" /> Focus
                                compare
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="change-summary">
                        <div>
                          <span className="change-icon" aria-hidden="true">
                            <FileCode2 size={17} />
                          </span>
                          <strong>
                            {!comparing
                              ? "Loading versions…"
                              : leftHtml === rightHtml
                                ? "No changes between these versions"
                                : "What changed"}{" "}
                          </strong>
                          <span className="diff-count add">
                            +{addedCount} lines
                          </span>
                          <span className="diff-count remove">
                            −{removedCount} lines
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

                      {view === "Visual" && highlights && (
                        <div
                          className="change-legend"
                          aria-label="Highlight colors"
                        >
                          <span className="changed">
                            <i aria-hidden="true" /> Changed
                          </span>
                          <span className="added">
                            <i aria-hidden="true" /> Added
                          </span>
                          <span className="removed">
                            <i aria-hidden="true" /> Removed
                          </span>
                          <small>
                            Highlights compare HTML and embedded CSS.
                          </small>
                        </div>
                      )}
                      {view === "Visual" ? (
                        <div className="split-preview">
                          {[left, right].map((z, i) => (
                            <div key={i}>
                              <div className="split-label">
                                <strong>
                                  {i === 0 ? "Before" : "After"}{" "}
                                  <span>v{z.number}</span>
                                </strong>
                                <span>
                                  {z.author} · {z.source}
                                </span>
                              </div>
                              <iframe
                                sandbox="allow-scripts"
                                title={
                                  i === 0 ? "Previous design" : "Updated design"
                                }
                                srcDoc={
                                  highlightedPreviews?.[i] ?? previewDoc(z)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="code-diff">
                          {visibleDiffLines.length > 0 ? (
                            visibleDiffLines.map((z, i) => (
                              <div className={z.kind} key={i}>
                                <span>{z.lineNumber ?? i + 1}</span>
                                <b>
                                  {z.kind === "add"
                                    ? "+"
                                    : z.kind === "remove"
                                      ? "−"
                                      : " "}
                                </b>
                                <code>{z.text || " "}</code>
                              </div>
                            ))
                          ) : (
                            <div className="same">
                              <span>—</span>
                              <b> </b>
                              <code>No line differences to display.</code>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        className="secondary export"
                        disabled={!comparing}
                        onClick={() =>
                          download(
                            `Design: ${d.name}\nComparison: v${left.number} → v${right.number}\n\n${summary.join("\n")}\n\nVersion notes: ${right.notes}\n\n${changes
                              .filter((z) => z.kind !== "same")
                              .map(
                                (z) =>
                                  (z.kind === "add" ? "+ " : "- ") + z.text,
                              )
                              .join("\n")}`,
                            `${d.name}-changes.txt`,
                          )
                        }
                      >
                        <Download size={14} aria-hidden="true" /> Export change
                        report
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}

          <footer>
            <span>
              <Layers size={14} aria-hidden="true" /> SA Studio
            </span>
            <span>Every iteration has a story. Keep yours together.</span>
          </footer>
        </main>
      </div>

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{toast}</span>
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} aria-hidden="true" />
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
                    : `Upload v${d.versions.length + 1} for ${d.name}`}
                </h2>
              </div>
              <button
                aria-label="Close upload"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <p>
              {modal === "new"
                ? "Give your AI-generated HTML prototype a shared home."
                : "Your previous versions stay intact. This upload adds a new revision to the timeline."}
            </p>
            <form onSubmit={upload}>
              <label htmlFor="upload-design-name">
                Design name
                <input
                  id="upload-design-name"
                  required
                  maxLength={120}
                  placeholder="e.g. Checkout flow redesign"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={modal === "version"}
                />
              </label>
              <div
                className={
                  "dropzone" +
                  (isDragging ? " dragging" : "") +
                  (file ? " has-file" : "")
                }
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files[0]) read(e.dataTransfer.files[0]);
                }}
              >
                <Upload size={24} aria-hidden="true" />
                <strong>{file ? file.name : "Drop your HTML file here"}</strong>
                <span>
                  {file
                    ? `${file.size >= 1_000_000 ? `${(file.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1_000))} KB`} · Ready to upload`
                    : "Self-contained .html or .htm · 4.5 MB including upload details"}
                </span>
                <div
                  className="dropzone-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => input.current?.click()}
                  >
                    {file ? "Choose another file" : "Browse files"}
                  </button>
                  {file && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setFile(null);
                        setFileHtml("");
                        if (input.current) input.current.value = "";
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
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
                <label htmlFor="upload-author">
                  Your name
                  <input
                    id="upload-author"
                    required
                    placeholder="e.g. Sophie Chen"
                    maxLength={120}
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </label>
                <label htmlFor="upload-role">
                  Role
                  <select
                    id="upload-role"
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
                <label htmlFor="upload-source">
                  Created with
                  <select
                    id="upload-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    {[
                      "Claude Design",
                      "Lovable",
                      "v0",
                      "ChatGPT",
                      "Bolt",
                      "Other",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label htmlFor="upload-collection">
                  Collection
                  <select
                    id="upload-collection"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={modal === "version"}
                  >
                    <option>Website</option>
                    <option>Dashboard</option>
                    <option>Web app</option>
                  </select>
                </label>
              </div>
              <label htmlFor="upload-notes">
                What changed?
                <textarea
                  id="upload-notes"
                  placeholder="Describe the decisions behind this iteration…"
                  value={notes}
                  maxLength={3000}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </label>
              {error && (
                <div className="form-error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              <div className="modal-footer">
                <span>
                  <History size={13} aria-hidden="true" />{" "}
                  {fileHtml
                    ? "Version history is preserved"
                    : "Select a .html or .htm file above to continue"}
                </span>
                <button
                  className="primary"
                  disabled={!fileHtml || busy}
                  type="submit"
                >
                  <span>
                    {busy
                      ? "Saving..."
                      : "Upload " + (modal === "new" ? "design" : "version")}
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
