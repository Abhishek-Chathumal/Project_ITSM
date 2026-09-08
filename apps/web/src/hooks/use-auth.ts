import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PermissionKey, SessionUserDto } from '@itsm/shared';
import { apiFetch, invalidateCsrfToken, ApiError } from '../lib/api-client';

const AUTH_ME_KEY = ['auth', 'me'];

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<SessionUserDto | null>({
    queryKey: AUTH_ME_KEY,
    queryFn: async () => {
      try {
        return await apiFetch<SessionUserDto>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  });

  const login = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      apiFetch<SessionUserDto>('/auth/login', { method: 'POST', body: JSON.stringify(creds) }),
    onSuccess: (sessionUser) => {
      // Login regenerates the server-side session id, invalidating any CSRF token
      // minted before it — force a fresh one on the next mutating request.
      invalidateCsrfToken();
      queryClient.setQueryData(AUTH_ME_KEY, sessionUser);
    },
  });

  const logout = useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      invalidateCsrfToken();
      queryClient.setQueryData(AUTH_ME_KEY, null);
    },
  });

  /** UX-only convenience — the API re-checks every permission server-side regardless. */
  function isAllowed(key: PermissionKey): boolean {
    return user?.permissions.includes(key) ?? false;
  }

  return { user, isLoading, login, logout, isAllowed };
}
