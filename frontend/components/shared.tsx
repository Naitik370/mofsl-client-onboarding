import type { ReactNode } from 'react';
import { closed, excluded } from '../lib';

export const text = (value: unknown) => String(value ?? '');
export const dimensionLabels: Record<string, string> = {
  cseName: 'CSE',
  location: 'Location',
  segment: 'Vertical / Segment',
};
export type ErrorHandler = (cause: unknown) => string;

export function Status({ value }: { value: unknown }) {
  const status = text(value);
  const style = closed.includes(status)
    ? 'closed'
    : [...excluded, 'On Hold'].includes(status)
      ? 'exception'
      : '';
  return <span className={`status ${style}`}>{status}</span>;
}

export function Errors({ message }: { message: string }) {
  return message ? (
    <div className="form-errors" role="alert" aria-live="assertive">
      {message}
    </div>
  ) : null;
}

export function Table({
  headings,
  children,
  empty,
}: {
  headings: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={headings.length}>
                <div className="empty-state">No matching records.</div>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Panel({
  title,
  note,
  children,
}: {
  title?: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="report-panel">
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {note && <p>{note}</p>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
