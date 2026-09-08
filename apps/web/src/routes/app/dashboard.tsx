import { useQueryClient } from '@tanstack/react-query';
import { PERMISSIONS } from '@itsm/shared';
import type { AuditLogDto } from '@itsm/shared';
import { useAuth } from '../../hooks/use-auth';
import { useAuditLogs, usePermissionCatalog, useRoles, useUsers } from '../../hooks/use-admin-data';
import { PageHeader } from '../../components/layout/page-header';
import { Card } from '../../components/ui/card';
import { StatTile } from '../../components/ui/stat-tile';
import { Badge, IdChip, StatusDot, type Tone } from '../../components/ui/badge';
import { IconButton } from '../../components/ui/icon-button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback';
import { Table, TBody, TD, TH, THead, TR } from '../../components/ui/table';
import { Refresh, ScrollText } from '../../components/layout/icons';

/** Maps an audit action to a tone so the activity feed is scannable. */
function actionTone(action: string): Tone {
  if (action.endsWith('.delete') || action.endsWith('.disable')) return 'danger';
  if (action.endsWith('.create')) return 'success';
  if (action.startsWith('auth.')) return 'info';
  return 'neutral';
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RecentActivity({
  logs,
  isLoading,
  isError,
}: {
  logs: AuditLogDto[] | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isError) {
    return <ErrorState description="The audit trail could not be loaded." />;
  }
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (!logs || logs.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="h-6 w-6" />}
        title="No activity yet"
        description="Actions that change state are recorded here as they happen."
      />
    );
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Action</TH>
          <TH>Entity</TH>
          <TH className="hidden sm:table-cell">Source IP</TH>
          <TH>When</TH>
        </TR>
      </THead>
      <TBody>
        {logs.slice(0, 8).map((log) => (
          <TR key={log.id}>
            <TD>
              <StatusDot tone={actionTone(log.action)} label={log.action} />
            </TD>
            <TD className="text-muted-foreground">{log.entityType}</TD>
            <TD className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
              {log.ipAddress ?? '—'}
            </TD>
            <TD className="whitespace-nowrap text-muted-foreground">
              {formatTimestamp(log.createdAt)}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export default function DashboardPage() {
  const { user, isAllowed } = useAuth();
  const queryClient = useQueryClient();

  const users = useUsers();
  const roles = useRoles();
  const permissions = usePermissionCatalog();
  const audit = useAuditLogs();

  const canSeeAudit = isAllowed(PERMISSIONS.AUDIT_VIEW);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={user ? `Signed in as ${user.name} · ${user.role.name}` : undefined}
        actions={
          <IconButton
            label="Refresh"
            onClick={() => queryClient.invalidateQueries()}
            title="Refresh"
          >
            <Refresh />
          </IconButton>
        }
      />

      {/* Ticket metrics have no source until Phase 1, so they say so rather than
          rendering a zero that would read as real. The rest are live counts. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Open tickets" value={undefined} placeholder="Phase 1" />
        <StatTile label="Overdue" value={undefined} placeholder="Phase 1" />
        {isAllowed(PERMISSIONS.USER_MANAGE) && (
          <StatTile label="Users" value={users.data?.length} tone="info" />
        )}
        {isAllowed(PERMISSIONS.ROLE_MANAGE) && (
          <StatTile label="Roles" value={roles.data?.length} tone="info" />
        )}
        {isAllowed(PERMISSIONS.PERMISSION_VIEW) && (
          <StatTile label="Permissions" value={permissions.data?.length} tone="info" />
        )}
        {canSeeAudit && <StatTile label="Audit events" value={audit.data?.length} tone="accent" />}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {canSeeAudit && (
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Recent activity</h2>
              <span className="text-xs text-muted-foreground">Latest 8 of the audit trail</span>
            </div>
            <RecentActivity logs={audit.data} isLoading={audit.isLoading} isError={audit.isError} />
          </Card>
        )}

        <Card className={canSeeAudit ? undefined : 'lg:col-span-2'}>
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Your access</h2>
          </div>
          <div className="p-4">
            {user && user.permissions.length > 0 ? (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  Granted by the <span className="font-medium">{user.role.name}</span> role.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {user.permissions.map((key) => (
                    <IdChip key={key}>{key}</IdChip>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="No permissions granted"
                description="New roles start with zero permissions. An administrator grants them explicitly."
              />
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Where the build is</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4 text-sm">
          <Badge tone="success" withDot>
            Phase 0 · Foundation
          </Badge>
          <span className="text-muted-foreground">
            Authentication, RBAC, and the audit trail are live.
          </span>
          <Badge tone="neutral">Phase 1 · Ticketing — next</Badge>
        </div>
      </Card>
    </>
  );
}
