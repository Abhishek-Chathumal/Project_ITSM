import { useAuth } from '../../hooks/use-auth';
import { Card } from '../../components/ui/card';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Welcome, {user?.name}</h1>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Phase 0 foundation is live: authentication, RBAC, and the audit trail are working.
          Ticketing and the other ITIL modules arrive in later phases.
        </p>
      </Card>
    </div>
  );
}
