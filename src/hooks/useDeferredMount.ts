import { useEffect, useState } from "react";

/** Remembers the first request so expensive panel contents stay mounted afterward. */
export function useDeferredMount(requested: boolean) {
  const [mounted, setMounted] = useState(requested);
  useEffect(() => {
    if (requested) setMounted(true);
  }, [requested]);
  return mounted;
}
