import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './stat-tile';

describe('StatTile', () => {
  it('renders a real value', () => {
    render(<StatTile label="Users" value={12} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  // The distinction this component exists to preserve: a metric that is still loading
  // must not render as 0, because a false zero is worse than an obvious placeholder.
  it('shows a loading state rather than a zero while the value is unknown', () => {
    render(<StatTile label="Users" value={undefined} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByText('Loading Users')).toBeInTheDocument();
  });

  it('renders a genuine zero as a zero', () => {
    render(<StatTile label="Overdue" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('Loading Overdue')).not.toBeInTheDocument();
  });

  it('shows the placeholder for a metric that has no source yet', () => {
    render(<StatTile label="Open tickets" value={undefined} placeholder="Phase 1" />);
    expect(screen.getByText('Phase 1')).toBeInTheDocument();
    expect(screen.queryByText('Loading Open tickets')).not.toBeInTheDocument();
  });
});
