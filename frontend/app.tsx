import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { type Row } from './lib';
import { useWorkspace } from './useWorkspace';
import { BulkUpload } from './components/BulkUpload';
import { CaseEntry } from './components/CaseEntry';
import { LoginScreen } from './components/LoginScreen';
import { AuditHistory, CaseRegister, Overview, Performance } from './components/ReportingViews';
import { UserAdministration } from './components/UserAdministration';
import { SlaSettings } from './components/SlaSettings';
import { Errors } from './components/shared';
import './styles.css';

const titles = {
  dashboard: 'MIS Overview',
  analysis: 'Performance MIS',
  cases: 'Case Register',
  entry: 'New Entry',
  upload: 'Bulk Upload',
  history: 'Audit History',
  users: 'User Administration',
  settings: 'SLA Settings',
};
type View = keyof typeof titles;

/** Coordinates navigation; each screen owns its presentation and editable state. */
function App() {
  const workspace = useWorkspace();
  const [view, setView] = useState<View>('dashboard');
  const [selected, setSelected] = useState<Row | null>(null);
  const [entryVersion, setEntryVersion] = useState(0);
  const [toast, setToast] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [actionError, setActionError] = useState('');
  const { user, meta, report, metrics, cases, history, users, handleError } = workspace;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openEntry(row: Row | null = null) {
    setSelected(row);
    setEntryVersion((version) => version + 1);
    setView('entry');
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await workspace.signOut();
      setActionError('');
    } catch (cause) {
      setActionError(handleError(cause));
    } finally {
      setSigningOut(false);
    }
  }

  if (workspace.booting) {
    return (
      <div className="boot-screen" role="status">
        <div className="brand-mark">CO</div>
        <span>Loading secure workspace...</span>
      </div>
    );
  }
  if (!user) {
    return (
      <LoginScreen
        sessionError={workspace.loginError}
        onError={handleError}
        onSignIn={async (credentials) => {
          await workspace.signIn(credentials);
          setView('dashboard');
          setSelected(null);
          setToast('');
          setActionError('');
        }}
      />
    );
  }

  const canWrite = user.role !== 'viewer';
  const canBulk = ['admin', 'operations'].includes(user.role);
  const permittedViews = (Object.keys(titles) as View[]).filter(
    (name) =>
      (!['users', 'settings'].includes(name) || user.role === 'admin') &&
      (name !== 'entry' || canWrite) &&
      (name !== 'upload' || canBulk),
  );
  const error = actionError || workspace.error;

  return (
    <>
      <div className="app-shell" id="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">CO</div>
            <div>
              <strong>Client Onboarding</strong>
            </div>
          </div>
          <nav className="nav" aria-label="Primary navigation">
            {permittedViews.map((name) => (
              <button
                key={name}
                className={`nav-item ${view === name ? 'active' : ''}`}
                aria-current={view === name ? 'page' : undefined}
                onClick={() => (name === 'entry' ? openEntry() : setView(name))}
              >
                {titles[name]}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className={`live-dot ${report && !error ? 'online' : ''}`} />
            <span>{error ? 'Connection issue' : report ? 'API connected' : 'Connecting'}</span>
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <div>
              <h1>
                {view === 'entry' && selected && ['admin', 'operations'].includes(user.role)
                  ? 'Edit Entry'
                  : titles[view]}
              </h1>
            </div>
            <div className="top-actions">
              <button className="ghost-btn" onClick={() => void workspace.reload()}>
                Refresh
              </button>
              {canWrite && (
                <button className="primary-btn" onClick={() => openEntry()}>
                  + New entry
                </button>
              )}
              <div className="user-menu">
                <div>
                  <strong>{user.displayName}</strong>
                  <span>
                    {user.role === 'viewer' ? 'Management Viewer' : user.role.toUpperCase()}
                  </span>
                </div>
                <button className="text-btn" disabled={signingOut} onClick={signOut}>
                  Sign out
                </button>
              </div>
            </div>
          </header>
          <Errors message={error} />

          {view === 'dashboard' && (
            <Overview
              report={report}
              meta={meta}
              filters={workspace.filters}
              onFilter={workspace.setFilters}
            />
          )}
          {view === 'analysis' && (
            <Performance
              report={report}
              dimension={workspace.dimension}
              onDimension={workspace.setDimension}
            />
          )}
          {view === 'cases' && (
            <CaseRegister
              cases={cases}
              metrics={metrics}
              meta={meta}
              user={user}
              onEdit={openEntry}
            />
          )}
          {view === 'entry' && canWrite && report && (
            <CaseEntry
              key={entryVersion}
              user={user}
              meta={meta}
              cases={cases}
              selected={selected}
              onClear={() => openEntry()}
              onError={handleError}
              onSaved={async (saved) => {
                await workspace.reload();
                setView('cases');
                setToast(`Entry saved · ${saved.referenceId}`);
              }}
            />
          )}
          {view === 'entry' && !report && <p role="status">Loading case metadata...</p>}
          {view === 'upload' && canBulk && (
            <BulkUpload
              user={user}
              meta={meta}
              cases={cases}
              onError={handleError}
              onImported={async (count) => {
                await workspace.reload();
                setToast(`${count} rows imported`);
              }}
            />
          )}
          {view === 'history' && <AuditHistory history={history} />}
          {view === 'users' && user.role === 'admin' && (
            <UserAdministration
              users={users}
              onError={handleError}
              onCreated={async () => {
                await workspace.reload();
                setToast('User created');
              }}
            />
          )}
          {view === 'settings' && user.role === 'admin' && (
            <SlaSettings
              onError={handleError}
              onSaved={async () => {
                await workspace.reload();
                setToast('SLA settings saved');
              }}
            />
          )}
        </main>
      </div>
      <div className={`toast ${toast ? 'show' : ''}`} role="status">
        {toast}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
