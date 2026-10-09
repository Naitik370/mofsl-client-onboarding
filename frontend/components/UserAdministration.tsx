import { useState, type FormEvent } from 'react';
import { api, formatDate, type Row } from '../lib';
import { Errors, Panel, Table, text, type ErrorHandler } from './shared';

type Props = { users: Row[]; onCreated: () => Promise<void>; onError: ErrorHandler };

export function UserAdministration({ users, onCreated, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      await onCreated();
    } catch (cause) {
      setError(onError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view active">
      <div className="section-heading">
        <div>
          <h2>User Administration</h2>
        </div>
      </div>
      <div className="user-admin-grid">
        <section className="report-panel form-panel">
          <h2>Create user</h2>
          <form className="user-form" onSubmit={createUser}>
            <label>
              Username
              <input name="username" required autoComplete="off" />
            </label>
            <label>
              Display name
              <input name="displayName" required autoComplete="off" />
            </label>
            <label>
              Role
              <select name="role">
                {['operations', 'cse', 'mofsl', 'viewer', 'admin'].map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
            <label>
              Temporary password
              <input
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <Errors message={error} />
            <button className="primary-btn" disabled={busy}>
              Create user
            </button>
          </form>
        </section>
        <Panel title="Active users">
          <Table
            headings={['Username', 'Display name', 'Role', 'Status', 'Created']}
            empty={!users.length}
          >
            {users.map((row) => (
              <tr key={Number(row.id)}>
                <td>
                  <strong>{text(row.username)}</strong>
                </td>
                <td>{text(row.displayName)}</td>
                <td>
                  <span className="role-badge">{text(row.role)}</span>
                </td>
                <td>{row.isActive ? 'Active' : 'Disabled'}</td>
                <td>{formatDate(text(row.createdAt).slice(0, 10))}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>
    </section>
  );
}
