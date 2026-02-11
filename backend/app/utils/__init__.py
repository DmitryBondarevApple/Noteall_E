"""Shared pipeline utilities for input_from derivation from edges."""


def build_input_from_map(edges: list) -> dict:
    """Build a map of node_id -> [source_node_ids] from an edges list.

    Given edges like [{"source": "A", "target": "B"}, {"source": "B", "target": "C"}],
    returns {"B": ["A"], "C": ["B"]}.
    """
    result = {}
    for e in edges:
        target = e.get("target")
        source = e.get("source")
        if target and source:
            if target not in result:
                result[target] = []
            if source not in result[target]:
                result[target].append(source)
    return result


def fix_nodes_input_from(nodes: list, edges: list) -> list:
    """Auto-fix input_from on nodes using edges when input_from is missing/null.

    Mutates nodes in-place and returns them for convenience.
    """
    input_from_map = build_input_from_map(edges)
    for node in nodes:
        node_id = node.get("node_id")
        if node_id and not node.get("input_from"):
            if node_id in input_from_map:
                node["input_from"] = input_from_map[node_id]
    return nodes
