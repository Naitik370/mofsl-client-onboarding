import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, type Meta, type Report, type Row, type User } from './lib';

const emptyMeta: Meta = { statuses: [], locations: [], segments: [], slaDays: 7 };
export type DateRange = { start: string; end: string };

/** Owns the session and server snapshots. Forms keep their own editable state. */
export function useWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [meta, setMeta] = useState<Meta>(emptyMeta);
  const [report, setReport] = useState<Report | null>(null);
  const [metrics, setMetrics] = useState<Report | null>(null);
  const [cases, setCases] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [dimension, setDimension] = useState('cseName');
  const [filters, setFilters] = useState<DateRange>({ start: '', end: '' });
  const requestVersion = useRef(0);

  const clearSession = useCallback(() => {
    requestVersion.current += 1;
    setUser(null);
    setCases([]);
    setHistory([]);
    setUsers([]);
    setReport(null);
    setMetrics(null);
    setMeta(emptyMeta);
    setError('');
  }, []);

  const handleError = useCallback(
    (cause: unknown): string => {
      const message = cause instanceof Error ? cause.message : 'Request failed';
      if (cause instanceof ApiError && cause.status === 401) {
        clearSession();
        setLoginError('Your session expired. Sign in again.');
      }
      return message;
    },
    [clearSession],
  );

  const reload = useCallback(async () => {
    if (!user) return;
    const version = ++requestVersion.current;
    const params = new URLSearchParams({ dimension, ...filters });

    try {
      const [metadata, filteredReport, unfilteredReport, entries, events, identities] =
        await Promise.all([
          api<Meta>('/api/meta'),
          api<Report>(`/api/reports?${params}`),
          filters.start || filters.end ? api<Report>('/api/reports') : Promise.resolve(null),
          api<Row[]>('/api/cases'),
          api<Row[]>('/api/history'),
          user.role === 'admin' ? api<Row[]>('/api/users') : Promise.resolve([]),
        ]);

      // A slower previous filter request must not replace a newer snapshot.
      if (version !== requestVersion.current) return;
      setMeta(metadata);
      setReport(filteredReport);
      setMetrics(unfilteredReport || filteredReport);
      setCases(entries);
      setHistory(events);
      setUsers(identities);
      setError('');
    } catch (cause) {
      if (version === requestVersion.current) setError(handleError(cause));
    }
  }, [user, dimension, filters, handleError]);

  useEffect(() => {
    let active = true;
    api<User>('/api/auth/me')
      .then((identity) => {
        if (active) setUser(identity);
      })
      .catch((cause) => {
        if (active && !(cause instanceof ApiError && cause.status === 401)) {
          setLoginError(handleError(cause));
        }
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, [handleError]);

  useEffect(() => {
    void reload();
    return () => {
      requestVersion.current += 1;
    };
  }, [reload]);

  async function signIn(credentials: Record<string, FormDataEntryValue>) {
    const identity = await api<User>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setLoginError('');
    setFilters({ start: '', end: '' });
    setDimension('cseName');
    setUser(identity);
  }

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
    clearSession();
    setLoginError('');
  }

  return {
    user,
    booting,
    error,
    loginError,
    meta,
    report,
    metrics,
    cases,
    history,
    users,
    dimension,
    setDimension,
    filters,
    setFilters,
    reload,
    signIn,
    signOut,
    handleError,
  };
}
