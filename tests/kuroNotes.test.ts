import {
  MAX_NOTES, MAX_NOTE_LEN, canAddNote, normalizeNote, addNote, extractNoteFromMessage,
} from '../src/llm/kuroNotes';

const filled = (n: number): string[] => Array.from({ length: n }, (_, i) => `Notiz ${i}`);

describe('canAddNote', () => {
  it('allows adding below the limit', () => {
    expect(canAddNote(filled(MAX_NOTES - 1))).toBe(true);
  });
  it('blocks at the limit', () => {
    expect(canAddNote(filled(MAX_NOTES))).toBe(false);
  });
  it('blocks above the limit', () => {
    expect(canAddNote(filled(MAX_NOTES + 1))).toBe(false);
  });
});

describe('normalizeNote', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeNote('  hallo  ')).toBe('hallo');
  });
  it('collapses newlines into single spaces', () => {
    expect(normalizeNote('a\n\nb')).toBe('a b');
  });
  it('truncates to the maximum length', () => {
    expect(normalizeNote('x'.repeat(500))).toHaveLength(MAX_NOTE_LEN);
  });
});

describe('addNote', () => {
  it('appends a normalized note', () => {
    expect(addNote(['a'], '  b  ')).toEqual(['a', 'b']);
  });
  it('ignores an empty note', () => {
    expect(addNote(['a'], '   ')).toEqual(['a']);
  });
  it('does not append when the list is full', () => {
    expect(addNote(filled(MAX_NOTES), 'neu')).toHaveLength(MAX_NOTES);
  });
  it('never silently drops the oldest entry when full', () => {
    const full = filled(MAX_NOTES);
    expect(addNote(full, 'neu')).toEqual(full);
  });
  it('does not mutate the input array', () => {
    const before = ['a'];
    addNote(before, 'b');
    expect(before).toEqual(['a']);
  });
});

describe('extractNoteFromMessage', () => {
  it('recognizes the German prefix', () => {
    expect(extractNoteFromMessage('merk dir: keine Streak-Hinweise'))
      .toBe('keine Streak-Hinweise');
  });
  it('recognizes the alternate German prefix', () => {
    expect(extractNoteFromMessage('merke dir: x')).toBe('x');
  });
  it('recognizes the English prefix', () => {
    expect(extractNoteFromMessage('remember: no streak reminders'))
      .toBe('no streak reminders');
  });
  it('is case-insensitive', () => {
    expect(extractNoteFromMessage('Merk Dir: x')).toBe('x');
  });
  it('tolerates leading whitespace', () => {
    expect(extractNoteFromMessage('  merk dir: x')).toBe('x');
  });
  it('returns null for an ordinary message', () => {
    expect(extractNoteFromMessage('womit fange ich an?')).toBeNull();
  });
  it('returns null when nothing follows the prefix', () => {
    expect(extractNoteFromMessage('merk dir:   ')).toBeNull();
  });
});
