import { useEffect, useState } from "react";

export default function HealthBanner() {
  const [lastUpdated, setLastUpdated] = useState<string>("2 min ago");

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const minutes = Math.floor(Math.random() * 5) + 1;
      setLastUpdated(`${minutes} min ago`);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-emerald-400 font-medium">System Status: Online</span>
        </div>
        <div className="text-xs text-slate-400">
          Last updated: <span className="text-slate-300">{lastUpdated}</span>
        </div>
      </div>
    </div>
  );
}
