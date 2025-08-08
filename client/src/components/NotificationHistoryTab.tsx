import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUltraFastAuth } from '@/hooks/useUltraFastAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  AlertCircle, 
  Info, 
  Zap, 
  LogIn, 
  Clock, 
  Trophy, 
  CreditCard, 
  Trash2,
  RotateCcw,
  Calendar
} from 'lucide-react';

interface NotificationHistoryItem {
  id: number;
  title: string;
  message: string;
  message_type: string;
  priority: string;
  sender_name: string;
  sender_role: string;
  media_url?: string;
  created_at: string;
  read_at?: string;
}

// Notification type to color and icon mapping
const getNotificationConfig = (messageType: string) => {
  const configs: Record<string, { 
    icon: React.ComponentType<any>; 
    badgeColor: string; 
    iconColor: string;
    bgColor: string;
  }> = {
    login: { 
      icon: LogIn, 
      badgeColor: 'bg-blue-500 text-white',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/10'
    },
    seat_waiting: { 
      icon: Clock, 
      badgeColor: 'bg-orange-500 text-white',
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/10'
    },
    tournament: { 
      icon: Trophy, 
      badgeColor: 'bg-purple-500 text-white',
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/10'
    },
    payment: { 
      icon: CreditCard, 
      badgeColor: 'bg-green-500 text-white',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/10'
    },
    general: { 
      icon: Bell, 
      badgeColor: 'bg-emerald-500 text-white',
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/10'
    },
    urgent: { 
      icon: Zap, 
      badgeColor: 'bg-red-500 text-white',
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/10'
    }
  };

  return configs[messageType] || configs.general;
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else {
    return date.toLocaleDateString();
  }
};

export const NotificationHistoryTab: React.FC = () => {
  const { user } = useUltraFastAuth();
  const [selectedNotification, setSelectedNotification] = useState<NotificationHistoryItem | null>(null);

  // Fetch 24-hour notification history
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/notification-history', user?.id],
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const markAsRead = async (notificationId: number) => {
    try {
      await fetch('/api/notification-history/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          notificationId,
          playerId: user?.id
        }),
      });
      refetch();
    } catch (error) {
      console.error('❌ [NOTIFICATION HISTORY] Failed to mark as read:', error);
    }
  };

  const clearNotification = async (notificationId: number) => {
    try {
      await fetch('/api/notification-history/clear', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          notificationId,
          playerId: user?.id
        }),
      });
      refetch();
    } catch (error) {
      console.error('❌ [NOTIFICATION HISTORY] Failed to clear:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-bold text-white mb-4">Notification History (24h)</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-slate-600 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-600 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications (24h)
        </h2>
        <Badge variant="secondary" className="bg-slate-700">
          {notifications.length} total
        </Badge>
      </div>

      {notifications.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No notifications in the last 24 hours</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {notifications.map((notification: NotificationHistoryItem) => {
              const config = getNotificationConfig(notification.message_type);
              const IconComponent = config.icon;
              const isUnread = !notification.read_at;

              return (
                <Card 
                  key={notification.id} 
                  className={`bg-slate-800 border-slate-700 transition-all hover:bg-slate-750 cursor-pointer ${
                    isUnread ? 'ring-1 ring-blue-500/30 shadow-blue-500/10 shadow-lg' : ''
                  }`}
                  onClick={() => {
                    if (isUnread) markAsRead(notification.id);
                    setSelectedNotification(notification);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-full ${config.bgColor} ${config.iconColor} flex-shrink-0`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className={`text-sm font-semibold ${isUnread ? 'text-white' : 'text-gray-300'} truncate`}>
                            {notification.title}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${config.badgeColor}`}>
                              {notification.message_type.replace('_', ' ')}
                            </Badge>
                            {isUnread && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                        
                        <p className={`text-sm ${isUnread ? 'text-gray-200' : 'text-gray-400'} mb-2 leading-relaxed line-clamp-2`}>
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatTimeAgo(notification.created_at)}
                          </span>
                          <span className="flex items-center gap-2">
                            <span>
                              {notification.sender_name} ({notification.sender_role})
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-red-600/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearNotification(notification.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          </span>
                        </div>
                        
                        {notification.media_url && (
                          <div className="mt-2">
                            <img 
                              src={notification.media_url} 
                              alt="Notification media"
                              className="max-w-full h-auto rounded-md max-h-20 object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-slate-700">
        <p className="text-xs text-gray-400">
          Notifications are automatically cleared after 24 hours
        </p>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => refetch()}
          className="text-gray-400 hover:text-white"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>
    </div>
  );
};

export default NotificationHistoryTab;