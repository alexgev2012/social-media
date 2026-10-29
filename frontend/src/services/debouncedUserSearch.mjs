export function scheduleUserSearch(query, search, onResult, delayMs = 300) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery || normalizedQuery.startsWith('#')) return () => {};

  let active = true;
  const controller = new AbortController();
  const timer = setTimeout(async () => {
    try {
      const results = await search(normalizedQuery, controller.signal);
      if (active) onResult({ query: normalizedQuery, results, error: null });
    } catch (error) {
      if (!active || controller.signal.aborted) return;
      onResult({
        query: normalizedQuery,
        results: [],
        error: error instanceof Error ? error.message : 'Could not search users. Please try again.',
      });
    }
  }, delayMs);

  return () => {
    active = false;
    clearTimeout(timer);
    controller.abort();
  };
}
