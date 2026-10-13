import { type Design, type Version } from "./demo";

export type SortOption = "updated" | "created" | "name" | "versions";
export type CatalogView = "grid" | "list" | "split";

export const GRID_PAGE_SIZE = 6;
export const LIST_PAGE_SIZE = 8;
export const SPLIT_PAGE_SIZE = 8;
export const ACTIVITY_PAGE_SIZE = 10;

export const latestVersionOf = (d: Design): Version =>
  d.versions[d.versions.length - 1];

export function matchesDesignQuery(design: Design, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const latest = latestVersionOf(design);
  if (design.name.toLowerCase().includes(q)) return true;
  if (design.category.toLowerCase().includes(q)) return true;
  if (latest?.notes?.toLowerCase().includes(q)) return true;
  return design.versions.some(
    (v) =>
      v.author.toLowerCase().includes(q) ||
      v.source.toLowerCase().includes(q) ||
      v.role.toLowerCase().includes(q),
  );
}

export function filterAndSortDesigns(
  designs: Design[],
  options: {
    search: string;
    collection: string;
    statusFilter: string;
    nav: string;
    sortBy: SortOption;
    pinnedIds?: ReadonlySet<string>;
    archivedIds?: ReadonlySet<string>;
  },
): Design[] {
  const {
    search,
    collection,
    statusFilter,
    nav,
    sortBy,
    pinnedIds,
    archivedIds,
  } = options;
  const filtered = designs.filter((x) => {
    const isArchived = Boolean(archivedIds?.has(x.id));
    if (nav === "Archived") {
      if (!isArchived) return false;
    } else if (isArchived) {
      return false;
    }
    const latest = latestVersionOf(x);
    return (
      matchesDesignQuery(x, search) &&
      (!collection || x.category === collection) &&
      (statusFilter === "All statuses" || latest.status === statusFilter) &&
      (nav !== "Ready for dev" || latest.status === "Ready for dev")
    );
  });

  return [...filtered].sort((a, b) => {
    const pinA = pinnedIds?.has(a.id) ? 1 : 0;
    const pinB = pinnedIds?.has(b.id) ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;

    const latestA = latestVersionOf(a);
    const latestB = latestVersionOf(b);
    if (sortBy === "name") {
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    if (sortBy === "versions") {
      const diff = b.versions.length - a.versions.length;
      if (diff !== 0) return diff;
      return latestB.createdAt.localeCompare(latestA.createdAt);
    }
    if (sortBy === "created") {
      const diff = b.createdAt.localeCompare(a.createdAt);
      if (diff !== 0) return diff;
      return latestB.createdAt.localeCompare(latestA.createdAt);
    }
    // Default: "updated" (most recently updated version first)
    const diff = latestB.createdAt.localeCompare(latestA.createdAt);
    if (diff !== 0) return diff;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export type ActivityItem = {
  d: Design;
  v: Version;
};

export function filterActivities(
  designs: Design[],
  options: {
    search?: string;
    designId?: string;
    statusFilter?: string;
    archivedIds?: ReadonlySet<string>;
  } = {},
): ActivityItem[] {
  const q = (options.search ?? "").trim().toLowerCase();
  const designId = options.designId ?? "";
  const statusFilter = options.statusFilter ?? "All statuses";

  return designs
    .filter((d) => {
      if (designId && d.id !== designId) return false;
      if (!designId && options.archivedIds?.has(d.id)) return false;
      return true;
    })
    .flatMap((d) => d.versions.map((v) => ({ d, v })))
    .filter(({ d, v }) => {
      if (statusFilter !== "All statuses" && v.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        v.author.toLowerCase().includes(q) ||
        v.source.toLowerCase().includes(q) ||
        v.notes.toLowerCase().includes(q) ||
        `v${v.number}`.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.v.createdAt.localeCompare(a.v.createdAt));
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
  showAll = false,
): {
  items: T[];
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalItems: number;
} {
  const totalItems = items.length;
  if (showAll || totalItems === 0) {
    return {
      items,
      currentPage: 1,
      totalPages: 1,
      startIndex: totalItems === 0 ? 0 : 1,
      endIndex: totalItems,
      totalItems,
    };
  }
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * pageSize;
  const sliced = items.slice(offset, offset + pageSize);
  return {
    items: sliced,
    currentPage,
    totalPages,
    startIndex: offset + 1,
    endIndex: offset + sliced.length,
    totalItems,
  };
}

export function pageSequence(
  currentPage: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}
