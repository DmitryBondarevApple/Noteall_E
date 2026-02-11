"""Unit tests for app.utils pipeline utilities."""
import pytest
from app.utils import build_input_from_map, fix_nodes_input_from


# ── build_input_from_map ──

class TestBuildInputFromMap:
    def test_linear_chain(self):
        edges = [
            {"source": "A", "target": "B"},
            {"source": "B", "target": "C"},
        ]
        assert build_input_from_map(edges) == {"B": ["A"], "C": ["B"]}

    def test_fan_out(self):
        edges = [
            {"source": "A", "target": "B"},
            {"source": "A", "target": "C"},
        ]
        assert build_input_from_map(edges) == {"B": ["A"], "C": ["A"]}

    def test_fan_in(self):
        edges = [
            {"source": "A", "target": "C"},
            {"source": "B", "target": "C"},
        ]
        assert build_input_from_map(edges) == {"C": ["A", "B"]}

    def test_no_duplicates(self):
        edges = [
            {"source": "A", "target": "B"},
            {"source": "A", "target": "B"},
        ]
        assert build_input_from_map(edges) == {"B": ["A"]}

    def test_empty_edges(self):
        assert build_input_from_map([]) == {}

    def test_missing_fields_skipped(self):
        edges = [
            {"source": "A"},
            {"target": "B"},
            {"source": None, "target": "B"},
            {"source": "A", "target": None},
            {},
        ]
        assert build_input_from_map(edges) == {}

    def test_complex_graph(self):
        edges = [
            {"source": "s1", "target": "s2"},
            {"source": "s2", "target": "s3"},
            {"source": "s2", "target": "s4"},
            {"source": "s3", "target": "s5"},
            {"source": "s4", "target": "s5"},
        ]
        result = build_input_from_map(edges)
        assert result == {
            "s2": ["s1"],
            "s3": ["s2"],
            "s4": ["s2"],
            "s5": ["s3", "s4"],
        }


# ── fix_nodes_input_from ──

class TestFixNodesInputFrom:
    def test_fixes_null_input_from(self):
        nodes = [
            {"node_id": "A", "input_from": None},
            {"node_id": "B", "input_from": None},
        ]
        edges = [{"source": "A", "target": "B"}]
        fix_nodes_input_from(nodes, edges)
        assert nodes[0]["input_from"] is None  # A has no incoming edges
        assert nodes[1]["input_from"] == ["A"]

    def test_preserves_existing_input_from(self):
        nodes = [
            {"node_id": "A", "input_from": []},
            {"node_id": "B", "input_from": ["X"]},
        ]
        edges = [{"source": "A", "target": "B"}]
        fix_nodes_input_from(nodes, edges)
        assert nodes[1]["input_from"] == ["X"]  # Not overwritten

    def test_fixes_empty_list(self):
        """Empty list is falsy, so it should be fixed too."""
        nodes = [
            {"node_id": "A", "input_from": []},
            {"node_id": "B", "input_from": []},
        ]
        edges = [{"source": "A", "target": "B"}]
        fix_nodes_input_from(nodes, edges)
        assert nodes[1]["input_from"] == ["A"]

    def test_mutates_in_place_and_returns(self):
        nodes = [
            {"node_id": "A"},
            {"node_id": "B"},
        ]
        edges = [{"source": "A", "target": "B"}]
        result = fix_nodes_input_from(nodes, edges)
        assert result is nodes
        assert nodes[1]["input_from"] == ["A"]

    def test_no_edges(self):
        nodes = [{"node_id": "A", "input_from": None}]
        fix_nodes_input_from(nodes, [])
        assert nodes[0].get("input_from") is None

    def test_three_node_chain_all_null(self):
        nodes = [
            {"node_id": "s1", "input_from": None},
            {"node_id": "s2", "input_from": None},
            {"node_id": "s3", "input_from": None},
        ]
        edges = [
            {"source": "s1", "target": "s2"},
            {"source": "s2", "target": "s3"},
        ]
        fix_nodes_input_from(nodes, edges)
        assert nodes[0]["input_from"] is None
        assert nodes[1]["input_from"] == ["s1"]
        assert nodes[2]["input_from"] == ["s2"]
