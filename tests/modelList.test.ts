import { parseModelList } from '../src/llm/modelList';

describe('parseModelList', () => {
  it('reads ids from an OpenAI-style data array', () => {
    expect(parseModelList({ data: [{ id: 'qwen3' }, { id: 'gemma3' }] }))
      .toEqual(['gemma3', 'qwen3']);
  });
  it('skips entries without a string id', () => {
    expect(parseModelList({ data: [{ id: 'ok' }, {}, { id: 5 }, null] })).toEqual(['ok']);
  });
  it('skips empty ids', () => {
    expect(parseModelList({ data: [{ id: '' }, { id: 'ok' }] })).toEqual(['ok']);
  });
  it('returns an empty list for unexpected shapes', () => {
    expect(parseModelList(null)).toEqual([]);
    expect(parseModelList({})).toEqual([]);
    expect(parseModelList({ data: 'nope' })).toEqual([]);
    expect(parseModelList('string')).toEqual([]);
  });
  it('sorts ids alphabetically', () => {
    expect(parseModelList({ data: [{ id: 'b' }, { id: 'a' }] })).toEqual(['a', 'b']);
  });
});
