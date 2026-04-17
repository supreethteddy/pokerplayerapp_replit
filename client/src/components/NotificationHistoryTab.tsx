import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUltraFastAuth } from '@/hooks/useUltraFastAuth';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  Info,
  Zap,
  LogIn,
  Clock,
  Trophy,
  CreditCard,
  RotateCcw,
  Calendar,
  Trash2,
  Mail,
  MailOpen,
} from 'lucide-react';
import { getPushNotificationImageUrl, getPushNotificationVideoUrl } from '@/lib/pushNotificationMedia';
import {
  hidePromotionFromHomeCarousel,
  unhidePromotionFromHomeCarousel,
} from '@/lib/promotionHomeCarousel';
import {
  PLAYER_PUSH_NOTIFICATION_UI_EVENT,
  isPlayerPushUnread,
} from '@/lib/playerPushNotifications';

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
    // KYC-specific notifications (approval / rejection / review)
    kyc: {
      icon: Info,
      badgeColor: 'bg-emerald-500 text-white',
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/10'
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

const formatTimeAgo = (dateString: string | undefined) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else {
    return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  }
};

export const NotificationHistoryTab: React.FC = () => {
  const { user } = useUltraFastAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('deletedNotifications') || '[]';
      const parsed = JSON.parse(raw) as (number | string)[];
      return new Set(parsed.map((v) => String(v)));
    } catch {
      return new Set();
    }
  });

  // Enable real-time notifications via Supabase Realtime (no polling needed!)
  useRealtimeNotifications(user?.id);

  // Fetch 24-hour notification history (now updated automatically via Realtime)
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/auth/player/push-notifications', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/auth/player/push-notifications');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    enabled: !!user?.id,
    // No refetchInterval - Supabase Realtime handles updates automatically!
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(
        'PUT',
        `/api/auth/player/push-notifications/${encodeURIComponent(notificationId)}/read`,
      ),
    onSuccess: (_data, notificationId) => {
      hidePromotionFromHomeCarousel(String(notificationId));
      queryClient.invalidateQueries({
        queryKey: ['/api/auth/player/push-notifications', user?.id],
      });
    },
    onError: (e: Error) => {
      toast({
        title: 'Could not mark read',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const markUnreadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(
        'PUT',
        `/api/auth/player/push-notifications/${encodeURIComponent(notificationId)}/unread`,
      ),
    onSuccess: (_data, notificationId) => {
      unhidePromotionFromHomeCarousel(String(notificationId));
      queryClient.invalidateQueries({
        queryKey: ['/api/auth/player/push-notifications', user?.id],
      });
    },
    onError: (e: Error) => {
      toast({
        title: 'Could not mark unread',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  const deleteNotification = (notificationId: string) => {
    setDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(notificationId);
      localStorage.setItem(
        'deletedNotifications',
        JSON.stringify(Array.from(next.values())),
      );
      window.dispatchEvent(new CustomEvent(PLAYER_PUSH_NOTIFICATION_UI_EVENT));
      return next;
    });
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

  // Apply local delete + sort: unread first, then newest first
  const visibleNotifications = (notifications || [])
    .filter((notification: any) => !deletedIds.has(String(notification.id)))
    .sort((a: any, b: any) => {
      const aUnread = isPlayerPushUnread(a);
      const bUnread = isPlayerPushUnread(b);
      if (aUnread !== bUnread) {
        return aUnread ? -1 : 1; // unread first
      }
      const aTime = new Date(
        a.createdAt || a.sentAt || a.created_at || a.sent_at || 0,
      ).getTime();
      const bTime = new Date(
        b.createdAt || b.sentAt || b.created_at || b.sent_at || 0,
      ).getTime();
      return bTime - aTime; // newest first
    });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications (24h)
        </h2>
        <Badge variant="secondary" className="bg-slate-700">
          {visibleNotifications.filter((n: any) => isPlayerPushUnread(n)).length} unread
          {visibleNotifications.length > 0
            ? ` · ${visibleNotifications.length} total`
            : ''}
        </Badge>
      </div>

      {visibleNotifications.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No notifications in the last 24 hours</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {visibleNotifications.map((notification: any) => {
              const nid = String(notification.id);
              const typeKey = notification.messageType || notification.message_type || notification.targetAudience || 'general';
              const config = getNotificationConfig(typeKey);
              const IconComponent = config.icon;
              const isUnread = isPlayerPushUnread(notification);
              const imageSrc = getPushNotificationImageUrl(notification);
              const videoSrc = getPushNotificationVideoUrl(notification);
              const bodyText =
                notification.message ||
                notification.details ||
                '';

              return (
                <Card
                  key={nid}
                  className={`bg-slate-800 border-slate-700 transition-all hover:bg-slate-750 ${
                    isUnread ? 'ring-1 ring-blue-500/30 shadow-blue-500/10 shadow-lg' : ''
                  }`}
                >
                  <CardContent className="p-0">
                    {(videoSrc || imageSrc) && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-t-lg border-b border-slate-700 bg-black">
                        {videoSrc ? (
                          <video
                            src={videoSrc}
                            controls
                            className="absolute inset-0 h-full w-full object-cover"
                            playsInline
                          />
                        ) : (
                          <img
                            src={imageSrc!}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                    )}

                    <div className="space-y-2 p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${config.bgColor} ${config.iconColor} flex-shrink-0`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h4 className={`text-sm font-semibold ${isUnread ? 'text-white' : 'text-gray-300'}`}>
                              {notification.title}
                            </h4>
                            <Badge className={`text-xs ${config.badgeColor}`}>
                              {String(typeKey || 'general').replace(/_/g, ' ')}
                            </Badge>
                            {isUnread && (
                              <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" title="Unread" />
                            )}
                          </div>
                          {bodyText ? (
                            <p className={`text-sm leading-relaxed ${isUnread ? 'text-gray-200' : 'text-gray-400'}`}>
                              {bodyText}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 pt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatTimeAgo(
                            notification.createdAt ||
                              notification.sentAt ||
                              notification.created_at ||
                              notification.sent_at,
                          )}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 border-slate-600 text-gray-200 hover:bg-slate-700"
                            disabled={!isUnread || markReadMutation.isPending}
                            onClick={() => markReadMutation.mutate(nid)}
                          >
                            <MailOpen className="mr-1 h-3 w-3" />
                            Mark read
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 border-slate-600 text-gray-200 hover:bg-slate-700"
                            disabled={isUnread || markUnreadMutation.isPending}
                            onClick={() => markUnreadMutation.mutate(nid)}
                          >
                            <Mail className="mr-1 h-3 w-3" />
                            Mark unread
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20"
                            onClick={() => deleteNotification(nid)}
                            title="Hide from this device"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
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