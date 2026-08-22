// Minimal browser globals so modules that touch localStorage (e.g. the zustand
// timer store) can be imported in the Node test environment.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v))
  }
  removeItem(k: string) {
    this.store.delete(k)
  }
  clear() {
    this.store.clear()
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  // @ts-expect-error - assigning a test double
  globalThis.localStorage = new MemoryStorage()
}
