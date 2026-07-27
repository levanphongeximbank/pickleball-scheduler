/**
 * In-memory repository for unit tests — remote-shaped rows only.
 * Not a mock fallback for production live failures.
 */

/**
 * @param {{
 *   clubs?: object[],
 *   courts?: object[],
 *   tournaments?: object[],
 *   rankings?: object[],
 *   failClubs?: Error|null,
 *   failCourts?: Error|null,
 *   failTournaments?: Error|null,
 *   failRankings?: Error|null,
 * }} seed
 */
export function createInMemoryPublicCatalogRepository(seed = {}) {
  const clubs = Array.isArray(seed.clubs) ? [...seed.clubs] : [];
  const courts = Array.isArray(seed.courts) ? [...seed.courts] : [];
  const tournaments = Array.isArray(seed.tournaments) ? [...seed.tournaments] : [];
  const rankings = Array.isArray(seed.rankings) ? [...seed.rankings] : [];
  let failClubs = seed.failClubs || null;
  let failCourts = seed.failCourts || null;
  let failTournaments = seed.failTournaments || null;
  let failRankings = seed.failRankings || null;

  function sortByName(rows, sort) {
    const copy = [...rows];
    if (sort === "name_asc") {
      copy.sort((a, b) => {
        const an = String(a.display_name || a.name || "").localeCompare(
          String(b.display_name || b.name || ""),
          "en"
        );
        if (an !== 0) return an;
        return String(a.id || "").localeCompare(String(b.id || ""), "en");
      });
    }
    return copy;
  }

  function sortByRank(rows, sort) {
    const copy = [...rows];
    if (sort === "rank_asc") {
      copy.sort((a, b) => {
        const ar = Number(a.rank || 0) - Number(b.rank || 0);
        if (ar !== 0) return ar;
        return String(a.id || "").localeCompare(String(b.id || ""), "en");
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
    setFailTournaments(err) {
      failTournaments = err;
    },
    setFailRankings(err) {
      failRankings = err;
    },
    async listPublicClubs(query) {
      if (failClubs) throw failClubs;
      const eligible = clubs.filter(
        (c) =>
          c.is_publicly_listed !== false &&
          c.status !== "inactive" &&
          !c.deleted_at
      );
      const sorted = sortByName(eligible, query.sort);
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
      const sorted = sortByName(eligible, query.sort);
      const slice = sorted.slice(query.offset, query.offset + query.limit);
      return { rows: slice, total: sorted.length };
    },
    async listPublicTournaments(query) {
      if (failTournaments) throw failTournaments;
      const eligible = tournaments.filter(
        (t) => (t.publication_state || "published") === "published"
      );
      const sorted = sortByName(eligible, query.sort);
      const slice = sorted.slice(query.offset, query.offset + query.limit);
      return { rows: slice, total: sorted.length };
    },
    async listPublicRankings(query) {
      if (failRankings) throw failRankings;
      let eligible = rankings.filter(
        (r) => (r.publication_state || "published") === "published"
      );
      if (query.category) {
        eligible = eligible.filter(
          (r) => String(r.category || "") === query.category
        );
      }
      const sorted = sortByRank(eligible, query.sort);
      const slice = sorted.slice(query.offset, query.offset + query.limit);
      return { rows: slice, total: sorted.length };
    },
  };
}
