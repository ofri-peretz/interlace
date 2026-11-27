/**
 * The stores: memory (tests, stories, an app with its own persistence) and localStorage, which must
 * never throw and never lose what the person did while the page is open.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { emptySnapshot } from '../src/games/getting-started-model.js';
import { localStorageStore, memoryStore } from '../src/games/getting-started-store.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const snap = (at: number) => ({ ...emptySnapshot(at), done: { a: at } });

describe('memoryStore', () => {
  it('loads what it was given, saves, and tells every subscriber, like two tabs', () => {
    const store = memoryStore(snap(1));
    expect(store.load()).toEqual(snap(1));
    const heard: number[] = [];
    const off = store.subscribe!((s) => heard.push(s.at));
    store.save(snap(2));
    expect(store.load()).toEqual(snap(2));
    expect(store.current()).toEqual(snap(2));
    off();
    store.save(snap(3));
    expect(heard).toEqual([2]);
    expect(memoryStore().load()).toBeNull();
  });
});

describe('localStorageStore', () => {
  it('keeps the snapshot under a versioned key', () => {
    const store = localStorageStore('prep');
    expect(store.load()).toBeNull();
    store.save(snap(5));
    expect(JSON.parse(localStorage.getItem('prep:v1')!)).toEqual(snap(5));
    expect(store.load()).toEqual(snap(5));
  });

  it('keeps the snapshot in memory when storage cannot be written, and when it cannot be read', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const store = localStorageStore('prep');
    expect(() => store.save(snap(6))).not.toThrow();
    expect(store.load()).toEqual(snap(6)); // read back from this page's memory
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(store.load()).toEqual(snap(6));
  });

  it('treats unreadable text as nothing saved', () => {
    localStorage.setItem('prep:v1', '{not json');
    expect(localStorageStore('prep').load()).toBeNull();
  });

  it('does not throw when localStorage itself throws on access, or there is no window', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied');
    });
    const store = localStorageStore('prep');
    expect(store.load()).toBeNull();
    expect(() => store.save(snap(1))).not.toThrow();
    expect(store.load()).toEqual(snap(1)); // what the person did is still here, in this page's memory
  });

  it('works with no window at all (a server render)', () => {
    vi.stubGlobal('window', undefined);
    const store = localStorageStore('prep');
    expect(store.load()).toBeNull();
    expect(() => store.save(snap(2))).not.toThrow();
    expect(store.load()).toEqual(snap(2));
    expect(store.subscribe!(() => {})()).toBeUndefined();
  });

  it('hears another tab through the storage event, for its own key only', () => {
    const store = localStorageStore('prep');
    const heard: number[] = [];
    const off = store.subscribe!((s) => heard.push(s.at));
    const fire = (key: string | null, newValue: string | null) => window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
    fire('prep:v1', JSON.stringify(snap(7)));
    fire('other:v1', JSON.stringify(snap(8)));
    fire('prep:v1', null); // removed
    fire('prep:v1', '{broken');
    expect(heard).toEqual([7]);
    off();
    fire('prep:v1', JSON.stringify(snap(9)));
    expect(heard).toEqual([7]);
  });
});
