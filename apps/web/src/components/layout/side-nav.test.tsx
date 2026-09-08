import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PERMISSIONS } from '@itsm/shared';
import { SideNav } from './side-nav';

const isAllowed = vi.fn();

vi.mock('../../hooks/use-auth', () => ({
  useAuth: () => ({ isAllowed }),
}));

function renderNav(permissions: string[]) {
  isAllowed.mockImplementation((key: string) => permissions.includes(key));
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <SideNav />
    </MemoryRouter>,
  );
}

describe('SideNav', () => {
  it('always shows the ungated primary items', () => {
    renderNav([]);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tickets')).toBeInTheDocument();
  });

  // Article III: a role with no grants sees no administration surface at all. This is
  // UX only — the API re-checks every request — but a Requester being shown an admin
  // section they can never open is a bug in its own right.
  it('hides the whole Administration section from a user with no permissions', () => {
    renderNav([]);
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Roles & Permissions')).not.toBeInTheDocument();
  });

  it('shows only the administration entries the user actually holds', () => {
    renderNav([PERMISSIONS.AUDIT_VIEW]);
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('renders a real link for a routed item and a disabled row for a future one', () => {
    renderNav([]);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/app');
    // Modules that do not exist yet must not be links that go nowhere.
    expect(screen.queryByRole('link', { name: 'Tickets' })).not.toBeInTheDocument();
    expect(screen.getByText('Tickets').closest('[aria-disabled="true"]')).not.toBeNull();
  });
});
