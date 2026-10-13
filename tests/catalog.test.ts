import test from "node:test";
import assert from "node:assert/strict";
import {
  filterActivities,
  filterAndSortDesigns,
  GRID_PAGE_SIZE,
  LIST_PAGE_SIZE,
  matchesDesignQuery,
  pageSequence,
  paginateItems,
} from "../lib/catalog";
import { demos, type Design } from "../lib/demo";

test("rich search matches project name, category, author, AI tool source, and version notes", () => {
  const [evergreen, orbit, gather] = demos;

  // Name match
  assert.equal(matchesDesignQuery(evergreen, "storefront"), true);
  // Author match
  assert.equal(matchesDesignQuery(orbit, "alex morgan"), true);
  // AI source tool match
  assert.equal(matchesDesignQuery(orbit, "v0"), true);
  assert.equal(matchesDesignQuery(evergreen, "lovable"), true);
  // Notes match (latest version notes)
  assert.equal(matchesDesignQuery(evergreen, "refillable"), true);
  // Category match
  assert.equal(matchesDesignQuery(gather, "web app"), true);
  // Non-match
  assert.equal(matchesDesignQuery(orbit, "nonexistent-keyword"), false);
});

test("filterAndSortDesigns sorts by updated, created, name, and version count", () => {
  const sortedByUpdated = filterAndSortDesigns(demos, {
    search: "",
    collection: "",
    statusFilter: "All statuses",
    nav: "All designs",
    sortBy: "updated",
  });
  // Evergreen v3 is Oct 13, Orbit v1 is Oct 10, Gather v1 is Oct 09
  assert.deepEqual(
    sortedByUpdated.map((d) => d.id),
    ["demo-evergreen", "demo-orbit", "demo-gather"],
  );

  const sortedByCreated = filterAndSortDesigns(demos, {
    search: "",
    collection: "",
    statusFilter: "All statuses",
    nav: "All designs",
    sortBy: "created",
  });
  // Orbit created Oct 10, Gather Oct 09, Evergreen Oct 08
  assert.deepEqual(
    sortedByCreated.map((d) => d.id),
    ["demo-orbit", "demo-gather", "demo-evergreen"],
  );

  const sortedByName = filterAndSortDesigns(demos, {
    search: "",
    collection: "",
    statusFilter: "All statuses",
    nav: "All designs",
    sortBy: "name",
  });
  assert.deepEqual(
    sortedByName.map((d) => d.name),
    ["Evergreen storefront", "Gather onboarding", "Orbit analytics"],
  );

  const sortedByVersions = filterAndSortDesigns(demos, {
    search: "",
    collection: "",
    statusFilter: "All statuses",
    nav: "All designs",
    sortBy: "versions",
  });
  assert.equal(sortedByVersions[0].id, "demo-evergreen");
});

test("filterAndSortDesigns respects pinnedIds and archivedIds", () => {
  // Pinning floats "demo-gather" to the top even when sorting by updated
  const withPin = filterAndSortDesigns(demos, {
    search: "",
    collection: "",
    statusFilter: "All statuses",
    nav: "All designs",
    sortBy: "updated",
    pinnedIds: new Set(["demo-gather"]),
  });
  assert.deepEqual(
    withPin.map((d) => d.id),
    ["demo-gather", "demo-evergreen", "demo-orbit"],
  );

  // Archiving hides "demo-orbit" from active views and shows it only in "Archived"
  const archived = new Set(["demo-orbit"]);
  const activeOnly = filterAndSortDesigns(demos, {
    search: "",
    collection: "",
    statusFilter: "All statuses",
    nav: "All designs",
    sortBy: "updated",
    archivedIds: archived,
  });
  assert.deepEqual(
    activeOnly.map((d) => d.id),
    ["demo-evergreen", "demo-gather"],
  );

  const archivedOnly = filterAndSortDesigns(demos, {
    search: "",
    collection: "",
    statusFilter: "All statuses",
    nav: "Archived",
    sortBy: "updated",
    archivedIds: archived,
  });
  assert.deepEqual(
    archivedOnly.map((d) => d.id),
    ["demo-orbit"],
  );
});

test("filterActivities filters revision feed by query, project, status, and archivedIds", () => {
  const all = filterActivities(demos, {
    search: "",
    designId: "",
    statusFilter: "All statuses",
  });
  assert.equal(all.length, 5);

  const byAuthor = filterActivities(demos, {
    search: "alex morgan",
    designId: "",
    statusFilter: "All statuses",
  });
  assert.equal(byAuthor.length, 2);

  const byTool = filterActivities(demos, {
    search: "v0",
    designId: "",
    statusFilter: "All statuses",
  });
  assert.equal(byTool.length, 1);
  assert.equal(byTool[0].d.id, "demo-orbit");

  const byProjectAndStatus = filterActivities(demos, {
    search: "",
    designId: "demo-evergreen",
    statusFilter: "Superseded",
  });
  assert.equal(byProjectAndStatus.length, 2);

  const excludingArchived = filterActivities(demos, {
    search: "",
    designId: "",
    statusFilter: "All statuses",
    archivedIds: new Set(["demo-evergreen"]),
  });
  assert.equal(excludingArchived.length, 2);
});

test("paginateItems and pageSequence handle large project catalogs cleanly", () => {
  const manyProjects: Design[] = Array.from({ length: 45 }, (_, i) => ({
    id: `proj-${i + 1}`,
    name: `Project ${i + 1}`,
    category: i % 2 === 0 ? "Website" : "Dashboard",
    createdAt: "2026-10-10T10:00:00Z",
    versions: [
      {
        id: `ver-${i + 1}`,
        designId: `proj-${i + 1}`,
        number: 1,
        author: "Designer",
        role: "Designer",
        notes: "",
        source: "Claude",
        createdAt: "2026-10-10T10:00:00Z",
        status: "In review",
      },
    ],
  }));

  const page1 = paginateItems(manyProjects, 1, GRID_PAGE_SIZE, false);
  assert.equal(page1.items.length, GRID_PAGE_SIZE);
  assert.equal(page1.totalPages, 8);
  assert.equal(page1.startIndex, 1);
  assert.equal(page1.endIndex, 6);

  // Out-of-range page clamps to last page
  const lastPage = paginateItems(manyProjects, 99, GRID_PAGE_SIZE, false);
  assert.equal(lastPage.currentPage, 8);
  assert.equal(lastPage.startIndex, 43);
  assert.equal(lastPage.endIndex, 45);
  assert.equal(lastPage.items.length, 3);

  // Show all bypasses pagination slice
  const all = paginateItems(manyProjects, 3, LIST_PAGE_SIZE, true);
  assert.equal(all.items.length, 45);
  assert.equal(all.currentPage, 1);
  assert.equal(all.totalPages, 1);

  // Page sequence with ellipsis
  assert.deepEqual(pageSequence(1, 8), [1, 2, "ellipsis", 8]);
  assert.deepEqual(pageSequence(5, 8), [1, "ellipsis", 4, 5, 6, "ellipsis", 8]);
  assert.deepEqual(pageSequence(3, 5), [1, 2, 3, 4, 5]);
});
