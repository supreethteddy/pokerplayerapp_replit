import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface HealthStatus {
  api: boolean;
  database: boolean;
  supabase: boolean;
  lastCheck: string;
}

export default function HealthBanner() {
  const { data: health, isError } = useQuery<HealthStatus>({
    queryKey: ['/api/health'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/health');
      return await response.json();
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: 3,
  });

  const [lastUpdated, setLastUpdated] = useState<string>("now");

  useEffect(() => {
    if (health?.lastCheck) {
      const interval = setInterval(() => {
        const now = new Date();
        const lastCheck = new Date(health.lastCheck);
        const diffMinutes = Math.floor((now.getTime() - lastCheck.getTime()) / 60000);
        
        if (diffMinutes === 0) {
          setLastUpdated("now");
        } else if (diffMinutes === 1) {
          setLastUpdated("1 min ago");
        } else {
          setLastUpdated(`${diffMinutes} min ago`);
        }
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [health?.lastCheck]);

  if (isError || !health) {
    return (
      <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-sm text-red-400 font-medium">System Status: Error</span>
          </div>
          <div className="text-xs text-slate-400">
            Health check failed
          </div>
        </div>
      </div>
    );
  }

  const allHealthy = health.api && health.database && health.supabase;
  const statusColor = allHealthy ? "emerald" : "yellow";
  const statusText = allHealthy ? "Online" : "Partial";

  return (
    <div className={`bg-${statusColor}-500/10 border-b border-${statusColor}-500/20 px-4 py-2`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 bg-${statusColor}-500 rounded-full ${allHealthy ? 'animate-pulse' : ''}`}></div>
          <span className={`text-sm text-${statusColor}-400 font-medium`}>System Status: {statusText}</span>
        </div>
        <div className="text-xs text-slate-400">
          Last updated: <span className="text-slate-300">{lastUpdated}</span>
        </div>
      </div>
    </div>
  );
}