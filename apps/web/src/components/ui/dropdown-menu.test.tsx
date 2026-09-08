import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DropdownItem, DropdownMenu } from './dropdown-menu';

function renderMenu(onSelect = vi.fn()) {
  render(
    <div>
      <button type="button">outside</button>
      <DropdownMenu label="Account menu" trigger={<span>Trigger</span>}>
        {(close) => (
          <DropdownItem
            onSelect={() => {
              onSelect();
              close();
            }}
          >
            Sign out
          </DropdownItem>
        )}
      </DropdownMenu>
    </div>,
  );
  return { onSelect, trigger: screen.getByRole('button', { name: 'Account menu' }) };
}

describe('DropdownMenu', () => {
  it('is closed initially and reports that through aria-expanded', () => {
    const { trigger } = renderMenu();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click and closes again on a second click', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();

    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Without this a keyboard user is dropped at the top of the document.
    expect(trigger).toHaveFocus();
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on ArrowDown from the trigger', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();

    trigger.focus();
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('runs the item action and dismisses the menu', async () => {
    const user = userEvent.setup();
    const { onSelect, trigger } = renderMenu();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
