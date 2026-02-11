import { buildInputFromMap, resolveInputFrom } from './pipelineUtils';

// ── buildInputFromMap ──

describe('buildInputFromMap', () => {
  test('linear chain', () => {
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'C' },
    ];
    expect(buildInputFromMap(edges)).toEqual({ B: ['A'], C: ['B'] });
  });

  test('fan-out', () => {
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'A', target: 'C' },
    ];
    expect(buildInputFromMap(edges)).toEqual({ B: ['A'], C: ['A'] });
  });

  test('fan-in', () => {
    const edges = [
      { source: 'A', target: 'C' },
      { source: 'B', target: 'C' },
    ];
    expect(buildInputFromMap(edges)).toEqual({ C: ['A', 'B'] });
  });

  test('no duplicates', () => {
    const edges = [
      { source: 'A', target: 'B' },
      { source: 'A', target: 'B' },
    ];
    expect(buildInputFromMap(edges)).toEqual({ B: ['A'] });
  });

  test('empty edges', () => {
    expect(buildInputFromMap([])).toEqual({});
  });

  test('null/undefined edges', () => {
    expect(buildInputFromMap(null)).toEqual({});
    expect(buildInputFromMap(undefined)).toEqual({});
  });

  test('missing fields skipped', () => {
    const edges = [
      { source: 'A' },
      { target: 'B' },
      { source: null, target: 'B' },
      {},
    ];
    expect(buildInputFromMap(edges)).toEqual({});
  });

  test('complex graph', () => {
    const edges = [
      { source: 's1', target: 's2' },
      { source: 's2', target: 's3' },
      { source: 's2', target: 's4' },
      { source: 's3', target: 's5' },
      { source: 's4', target: 's5' },
    ];
    expect(buildInputFromMap(edges)).toEqual({
      s2: ['s1'],
      s3: ['s2'],
      s4: ['s2'],
      s5: ['s3', 's4'],
    });
  });
});

// ── resolveInputFrom ──

describe('resolveInputFrom', () => {
  const map = { B: ['A'], C: ['B'] };

  test('returns from map when present', () => {
    expect(resolveInputFrom('B', map, null)).toEqual(['A']);
  });

  test('falls back to node value when not in map', () => {
    expect(resolveInputFrom('X', map, ['Y'])).toEqual(['Y']);
  });

  test('falls back to default when nothing found', () => {
    expect(resolveInputFrom('X', map, null, [])).toEqual([]);
    expect(resolveInputFrom('X', map, null, null)).toEqual(null);
  });

  test('map takes priority over node value', () => {
    expect(resolveInputFrom('B', map, ['Z'])).toEqual(['A']);
  });
});
