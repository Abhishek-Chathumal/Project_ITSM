import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@itsm/shared';

export const PERMISSION_KEY = 'requiredPermission';

/**
 * Marks a route as requiring a specific permission key. Checked server-side by
 * PermissionGuard against the current session user's role permissions — this is
 * the mandatory authorization pattern for every module (Article II/III).
 */
export const RequirePermission = (key: PermissionKey) => SetMetadata(PERMISSION_KEY, key);
