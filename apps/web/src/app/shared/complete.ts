import { filter, map, type Observable, type OperatorFunction } from 'rxjs';

interface ApolloResultLike {
  data?: unknown;
  dataState?: string;
}

/** Emits only fully-loaded Apollo results (Apollo Client 4 may emit partial/empty states). */
export function completeData<T>(): OperatorFunction<ApolloResultLike, T> {
  return (source: Observable<ApolloResultLike>) =>
    source.pipe(
      filter((r) => r.dataState === 'complete' && r.data !== undefined),
      map((r) => r.data as T),
    );
}
