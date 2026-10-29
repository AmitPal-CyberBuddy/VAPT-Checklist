import type { ReactNode } from 'react';
import { Button, Modal } from '../ui/primitives';
import { PALETTE_KBD } from '../ui/CommandPalette';

/**
 * The keyboard map, one keystroke away.
 *
 * The workspace loop is fully keyboard-driven, but until now the only place
 * the keys were listed was a hint bar that appears at ≥1280 px inside the
 * workspace itself — undiscoverable from anywhere else. `?` opens this from
 * any screen (wired in AppShell); the same list is reachable from the rail.
 */

const GROUPS: { title: string; rows: { keys: ReactNode; action: string }[] }[] = [
  {
    title: 'Everywhere',
    rows: [
      { keys: <kbd>{PALETTE_KBD}</kbd>, action: 'Search and jump — screens, engagements, library tests' },
      { keys: <kbd>?</kbd>, action: 'This shortcuts list' },
      { keys: <kbd>Esc</kbd>, action: 'Close the open dialog or search' },
    ],
  },
  {
    title: 'Testing Workspace — moving',
    rows: [
      { keys: (<><kbd>J</kbd> <kbd>K</kbd></>), action: 'Next / previous test (or ↓ / ↑)' },
      { keys: <kbd>⏎</kbd>, action: 'Next test that is still Not Tested' },
      { keys: <kbd>/</kbd>, action: 'Focus the test search' },
    ],
  },
  {
    title: 'Testing Workspace — recording',
    rows: [
      { keys: (<><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></>), action: 'Status: Not Tested · Tested · N/A' },
      { keys: (<><kbd>V</kbd> <kbd>B</kbd></>), action: 'Result: Vulnerable · Not Vulnerable' },
      { keys: <kbd>E</kbd>, action: 'Jump to the notes field' },
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="The whole testing loop — open, read, record, next — without reaching for the mouse."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="section-kicker mb-2">
              {group.title}
            </h3>
            <dl className="divide-y divide-ink-800 border-y border-ink-800">
              {group.rows.map((row) => (
                <div key={row.action} className="flex items-center gap-3 py-2">
                  <dt className="flex w-24 shrink-0 items-center gap-1">{row.keys}</dt>
                  <dd className="text-sm text-ink-200">{row.action}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Modal>
  );
}
