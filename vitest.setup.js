import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// findBy* and waitFor give up after one second by default. A screen that renders in 0.3 s alone takes several seconds when 179 test
// files share the machine, and a full run failed a different, correct, test each time. Five seconds still fails a screen that never
// shows what it should.
configure({ asyncUtilTimeout: 5000 });

// Mock window.open to avoid popup blockers in tests
window.open = vi.fn(() => ({
  document: {
    write: vi.fn(),
    close: vi.fn(),
  },
  focus: vi.fn(),
  print: vi.fn(),
  close: vi.fn(),
}));

// Mock scrollTo to avoid jsdom errors
window.scrollTo = vi.fn();

// Ensure document.getElementById('copy-label') always returns a safe element
const originalGetElementById = document.getElementById.bind(document);
document.getElementById = (id) => {
  const el = originalGetElementById(id);
  if (el) return el;
  if (id === 'copy-label') {
    const span = document.createElement('span');
    span.id = 'copy-label';
    document.body.appendChild(span);
    return span;
  }
  return el;
};
