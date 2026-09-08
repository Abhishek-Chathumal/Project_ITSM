// npm hoists @testing-library/jest-dom to the repo root while vitest stays nested under
// apps/web, so jest-dom's own '@testing-library/jest-dom/vitest' entry cannot resolve
// 'vitest' from where npm put it. Registering the matchers explicitly resolves 'vitest'
// relative to this file instead, which holds regardless of how npm chooses to hoist.
// The matching type augmentation lives in ./jest-dom-matchers.d.ts.
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);
