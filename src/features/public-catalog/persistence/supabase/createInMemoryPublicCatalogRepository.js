/**
 * In-memory repository for unit tests — remote-shaped rows only.
 * Not a mock fallback for production live failures.
 */

/**
 * @param {{ clubs?: object[], courts?: object[], failClubs?: Error|null, failCourts?: Error|null }} seed
 */
export function createInMemoryPublicCatalogRepository(seed = {}) {
  const clubs = Array.isArray(seed.clubs) ? [...seed.clubs] : [];
  const courts = Array.isArray(seed.courts) ? [...seed.courts] : [];
  let failClubs = seed.failClubs || null;
  let failCourts = seed.failCourts || null;

  function sortClubs(rows, sort) {
    const copy = [...rows];
    if (sort === "name_asc") {
      copy.sort((a, b) => {
        const an = String(a.display_name || a.name || "").localeCompare(
          String(b.display_name || b.name || ""),
          "en"
        );
        if (an !== 0) return an;
        return String(a.id || a.club_id || "").localeCompare(
          String(b.id || b.club_id || ""),
          "en"
        );
      });
    }
    return copy;
  }

  function sortCourts(rows, sort) {
    const copy = [...rows];
    if (sort === "name_asc") {
      copy.sort((a, b) => {
        const an = String(a.display_name || a.name || "").localeCompare(
          String(b.display_name || b.name || ""),
          "en"
        );
        if (an !== 0) return an;
        return String(a.id || a.court_id || "").localeCompare(
          String(b.id || b.court_id || ""),
          "en"
        );
      });
    }
    return copy;
  }

  return {
    setFailClubs(err) {
      failClubs = err;
    },
    setFailCourts(err) {
      failCourts = err;
    },
    async listPublicClubs(query) {
      if (failClubs) throw failClubs;
      const eligible = clubs.filter(
        (c) =>
          c.is_publicly_listed !== false &&
          c.status !== "inactive" &&
          !c.deleted_at
      );
      const sorted = sortClubs(eligible, query.sort);
      const slice = sorted.slice(query.offset, query.offset + query.limit);
      return { rows: slice, total: sorted.length };
    },
    async listPublicCourts(query) {
      if (failCourts) throw failCourts;
      let eligible = courts.filter(
        (c) =>
          c.is_publicly_listed !== false &&
          (c.publication_state || "published") === "published" &&
          (c.operational_state || c.status || "active") === "active" &&
          c.active !== false
      );
      if (query.clubId) {
        eligible = eligible.filter(
          (c) => String(c.club_id || c.clubId) === query.clubId
        );
      }
      const sorted = sortCourts(eligible, query.sort);
      const slice = sorted.slice(query.offset, query.offset + query.limit);
      return { rows: slice, total: sorted.length };
    },
  };
}
