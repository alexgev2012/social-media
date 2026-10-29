export interface UserSearchSnapshot<T> {
  query: string;
  results: T[];
  error: string | null;
}
export function scheduleUserSearch<T>(
  query: string,
  search: (query: string, signal: AbortSignal) => Promise<T[]>,
  onResult: (snapshot: UserSearchSnapshot<T>) => void,
  delayMs?: number,
): () => void;
