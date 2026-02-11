/**
 * Shared pipeline utilities for input_from derivation from edges.
 */

/**
 * Build a map of nodeId -> [sourceNodeIds] from an edges array.
 * Given edges like [{source: "A", target: "B"}], returns {B: ["A"]}.
 */
export function buildInputFromMap(edges) {
  const result = {};
  for (const e of edges || []) {
    if (e.target && e.source) {
      if (!result[e.target]) result[e.target] = [];
      if (!result[e.target].includes(e.source)) {
        result[e.target].push(e.source);
      }
    }
  }
  return result;
}

/**
 * Get the resolved input_from for a node, preferring edges-derived value over the node's own.
 * @param {string} nodeId
 * @param {object} inputFromMap - result of buildInputFromMap
 * @param {Array|null} nodeInputFrom - the node's existing input_from value
 * @param {*} fallback - default value if nothing found ([] or null)
 * @returns {Array|null}
 */
export function resolveInputFrom(nodeId, inputFromMap, nodeInputFrom, fallback = []) {
  return inputFromMap[nodeId] || nodeInputFrom || fallback;
}
