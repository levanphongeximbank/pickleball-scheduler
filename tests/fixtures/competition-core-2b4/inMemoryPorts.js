/**
 * Phase 2B.4 — full in-memory repository port fake (tests only).
 * Not exported from Competition Core Production API.
 */

/**
 * @returns {Record<string, unknown>}
 */
export function createClosureInMemoryPorts() {
  /** @type {Map<string, unknown>} */
  const store = new Map();
  /** @type {Map<string, unknown[]>} */
  const revisions = new Map();

  function key(kind, id) {
    return `${kind}:${id}`;
  }

  function makeCrud(kind) {
    return {
      async getById(id) {
        return store.get(key(kind, id)) ?? null;
      },
      async listByCompetition(competitionId) {
        return [...store.entries()]
          .filter(([k, v]) => k.startsWith(`${kind}:`) && v?.competitionId === competitionId)
          .map(([, v]) => v);
      },
      async save(entity) {
        store.set(key(kind, entity.id), structuredClone(entity));
        return store.get(key(kind, entity.id));
      },
    };
  }

  const roster = makeCrud("roster");
  const lineup = makeCrud("lineup");

  return {
    participant: {
      ...makeCrud("participant"),
      async findByExternalReference(ref, competitionId) {
        for (const [k, v] of store.entries()) {
          if (!k.startsWith("participant:")) continue;
          if (
            v?.competitionId === competitionId &&
            v?.person?.kind === ref.kind &&
            v?.person?.id === ref.id
          ) {
            return v;
          }
        }
        return null;
      },
    },
    entry: {
      ...makeCrud("entry"),
      async findActiveDuplicate(scope) {
        return [...store.entries()]
          .filter(([k]) => k.startsWith("entry:"))
          .map(([, e]) => e)
          .filter((e) => {
            if (!e || e.competitionId !== scope.competitionId) return false;
            if ((e.divisionId ?? null) !== (scope.divisionId ?? null)) return false;
            if ((e.categoryId ?? null) !== (scope.categoryId ?? null)) return false;
            if ((e.entryRole ?? null) !== (scope.entryRole ?? null)) return false;
            return e.status === "ACTIVE" || e.status === "APPROVED";
          });
      },
    },
    registration: makeCrud("registration"),
    team: makeCrud("team"),
    roster: {
      ...roster,
      async saveRevision(rosterEntity) {
        const id = String(rosterEntity.id);
        const list = revisions.get(`roster:${id}`) || [];
        list.push(structuredClone(rosterEntity));
        revisions.set(`roster:${id}`, list);
        return roster.save(rosterEntity);
      },
      async listRevisions(id) {
        return [...(revisions.get(`roster:${id}`) || [])];
      },
    },
    lineup: {
      ...lineup,
      async saveRevision(revision) {
        const lineupId = String(revision.lineupId || revision.id);
        const list = revisions.get(`lineup:${lineupId}`) || [];
        list.push(structuredClone(revision));
        revisions.set(`lineup:${lineupId}`, list);
        return revision;
      },
      async listRevisions(lineupId) {
        return [...(revisions.get(`lineup:${lineupId}`) || [])];
      },
    },
    division: makeCrud("division"),
    category: makeCrud("category"),
  };
}
