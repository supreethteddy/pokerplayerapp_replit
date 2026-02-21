import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface HealthStatus {
  api: boolean;
  database: boolean;
  supabase: boolean;
  lastCheck: string;
}

export default function HealthMonitor() {
  const [autoFix, setAutoFix] = useState(false);
  const [lastFixAttempt, setLastFixAttempt] = useState<string>('');

  // Health check query
  const { data: health, isError, refetch } = useQuery<HealthStatus>({
    queryKey: ['/api/health'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/health');
        return await response.json();
      } catch (error) {
        console.error('Health check failed:', error);
        return {
          api: false,
          database: false,
          supabase: false,
          lastCheck: new Date().toISOString()
        };
      }
    },
    refetchInterval: 60000,
    retry: 3,
  });

  // Auto-fix functionality
  useEffect(() => {
    if (autoFix && health && (!health.api || !health.database || !health.supabase)) {
      const now = new Date();
      const lastAttempt = lastFixAttempt ? new Date(lastFixAttempt) : new Date(0);
      
      // Only attempt fix if more than 1 minute has passed
      if (now.getTime() - lastAttempt.getTime() > 60000) {
        console.log('Auto-fixing health issues...');
        handleAutoFix();
        setLastFixAttempt(now.toISOString());
      }
    }
  }, [health, autoFix, lastFixAttempt]);

  const handleAutoFix = async () => {
    try {
      console.log('Attempting auto-fix...');
      
      // Restart database connection
      await apiRequest('POST', '/api/restart-db');
      
      // Sync to Supabase
      await apiRequest('POST', '/api/sync-to-supabase');
      
      // Refresh health status
      setTimeout(() => refetch(), 2000);
      
    } catch (error) {
      console.error('Auto-fix failed:', error);
    }
  };

  const getStatusColor = (status: boolean) => {
    return status ? 'text-green-500' : 'text-red-500';
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <AlertTriangle className="w-4 h-4 text-red-500" />
    );
  };

  if (isError || !health) {
    return (
      <Alert className="mb-4 border-red-500 bg-red-500/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          System health check failed. 
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="ml-2"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const allHealthy = health.api && health.database && health.supabase;

  return (
    <div className="space-y-4">
      {/* Health Status Display */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">System Health</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-8"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Check
            </Button>
            <Button
              variant={autoFix ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoFix(!autoFix)}
              className="h-8"
            >
              {autoFix ? 'Auto-Fix On' : 'Auto-Fix Off'}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            {getStatusIcon(health.api)}
            <span className={getStatusColor(health.api)}>
              API: {health.api ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(health.database)}
            <span className={getStatusColor(health.database)}>
              Database: {health.database ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(health.supabase)}
            <span className={getStatusColor(health.supabase)}>
              Supabase: {health.supabase ? 'Synced' : 'Error'}
            </span>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-slate-400">
          Last check: {new Date(health.lastCheck).toLocaleTimeString()}
        </div>
      </div>

      {/* Warning if not all healthy */}
      {!allHealthy && (
        <Alert className="border-yellow-500 bg-yellow-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Some services are experiencing issues. 
            {autoFix ? ' Auto-fix is enabled.' : ' Enable auto-fix to automatically resolve issues.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}