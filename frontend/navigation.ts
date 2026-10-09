export const viewTitles = {
  dashboard: 'MIS Overview',
  analysis: 'Performance MIS',
  cases: 'Case Register',
  entry: 'New Entry',
  upload: 'Bulk Upload',
  history: 'Audit History',
  users: 'User Administration',
  settings: 'SLA Settings',
};
export type View = keyof typeof viewTitles;
export type Route = { view: View; referenceId: string | null };

export function parseRoute(hash: string): Route {
  const [view, reference] = hash.replace(/^#\/?/, '').split('/');
  if (!Object.prototype.hasOwnProperty.call(viewTitles, view))
    return { view: 'dashboard', referenceId: null };
  try {
    return {
      view: view as View,
      referenceId:
        ['cases', 'entry'].includes(view) && reference ? decodeURIComponent(reference) : null,
    };
  } catch {
    return { view: 'cases', referenceId: null };
  }
}

export function routeHash(view: View, referenceId: string | null = null): string {
  return `#/${view}${referenceId ? `/${encodeURIComponent(referenceId)}` : ''}`;
}
