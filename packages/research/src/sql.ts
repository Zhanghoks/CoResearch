// Minimal query surface shared by research writes. Both the API's
// RequestDb and the worker's pg client satisfy this.

export type SqlQuery = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
};
