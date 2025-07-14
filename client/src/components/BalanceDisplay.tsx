import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, TrendingUp, TrendingDown, Trophy, Target, BarChart3, AlertCircle } from "lucide-react";

export default function BalanceDisplay() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 bg-slate-700" />
        <Skeleton className="h-24 bg-slate-700" />
      </div>
    );
  }

  const balance = parseFloat(user.balance || '0');
  const totalDeposits = parseFloat(user.totalDeposits || '0');
  const totalWithdrawals = parseFloat(user.totalWithdrawals || '0');
  const totalWinnings = parseFloat(user.totalWinnings || '0');
  const totalLosses = parseFloat(user.totalLosses || '0');
  const netWinnings = totalWinnings - totalLosses;

  return (
    <div className="space-y-6">
      {/* Current Balance Card */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-emerald-500" />
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400 mb-2">
              ₹{balance.toLocaleString('en-IN')}
            </div>
            <Badge 
              variant={balance > 0 ? "default" : "secondary"}
              className={`${balance > 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-600 text-slate-300'}`}
            >
              {balance > 0 ? "Active" : "No Balance"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-slate-700 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <div className="text-sm text-slate-400 mb-1">Total Deposits</div>
              <div className="text-lg font-semibold text-emerald-400">
                ₹{totalDeposits.toLocaleString('en-IN')}
              </div>
            </div>
            
            <div className="text-center p-4 bg-slate-700 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <div className="text-sm text-slate-400 mb-1">Total Withdrawals</div>
              <div className="text-lg font-semibold text-red-400">
                ₹{totalWithdrawals.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gaming Performance */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-amber-500" />
            Gaming Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-300">Total Winnings</span>
              </div>
              <span className="text-emerald-400 font-semibold">
                ₹{totalWinnings.toLocaleString('en-IN')}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-red-500" />
                <span className="text-slate-300">Total Losses</span>
              </div>
              <span className="text-red-400 font-semibold">
                ₹{totalLosses.toLocaleString('en-IN')}
              </span>
            </div>
            
            <div className="border-t border-slate-600 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Net Winnings</span>
                <span 
                  className={`font-bold ${netWinnings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {netWinnings >= 0 ? '+' : ''}₹{netWinnings.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gaming Stats */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
            Gaming Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {user.gamesPlayed || 0}
              </div>
              <div className="text-sm text-slate-400">Games Played</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {parseFloat(user.hoursPlayed || '0').toFixed(1)}h
              </div>
              <div className="text-sm text-slate-400">Hours Played</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notice */}
      <Card className="bg-amber-900/20 border-amber-700/30">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-amber-300 font-medium mb-1">Account Management</div>
              <div className="text-amber-200/80 text-sm">
                For deposits, withdrawals, and other account transactions, please contact our cashier or support team. 
                These operations require staff approval for security purposes.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}