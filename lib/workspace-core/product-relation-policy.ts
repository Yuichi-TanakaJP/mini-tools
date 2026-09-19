import type { WorkspaceCoreProductRelation } from "./types";

/** The canonical DB retains lineage. Dependency-facing UI feeds must omit it. */
export function dependencyFacingProductRelations(
  relations: WorkspaceCoreProductRelation[],
): WorkspaceCoreProductRelation[] {
  return relations.filter((relation) => relation.relationType !== "predecessor_of");
}
