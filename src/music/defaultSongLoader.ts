/** Shares one in-flight load and permits retries after a rejected load. */
export function createCoalescedLoader<T>(load: () => Promise<T>) {
  let pending: Promise<T> | null = null;
  return () => {
    if (pending) return pending;
    const request = Promise.resolve().then(load);
    pending = request.catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}

/** Applies a loaded value only while the caller's initial state is still current. */
export async function applyIfCurrent<T>(
  load: () => Promise<T>,
  isCurrent: () => boolean,
  apply: (value: T) => void,
) {
  const value = await load();
  if (!isCurrent()) return false;
  apply(value);
  return true;
}
