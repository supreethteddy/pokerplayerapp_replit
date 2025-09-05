import React, { useEffect, useState } from 'react';
import { useUltraFastAuth } from '@/hooks/useUltraFastAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Bell, AlertCircle, Info, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

interface NotificationData {
  id: number;
  title: string;
  message: string;
  type: string;
  timestamp: Date;
  priority: NotificationPriority;
  senderName: string;
  senderRole: string;
  mediaUrl?: string;
}

interface NotificationPopupProps {
  notification: NotificationData;
  onDismiss: (id: number) => void;
}

const NotificationPopup: React.FC<NotificationPopupProps> = ({ notification, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-dismiss after delay based on priority
  useEffect(() => {
    if (!notification) return;

    const dismissDelay: Record<NotificationPriority, number> = {
      low: 5000,
      normal: 8000,
      high: 12000,
      urgent: 20000 // Urgent notifications stay longer
    };

    const priority = notification.priority || 'normal';
    const delay = dismissDelay[priority] || 8000;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(notification.id), 300);
    }, delay);

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const priorityConfig: Record<NotificationPriority, { 
    icon: React.ComponentType<any>; 
    color: string; 
    iconColor: string; 
  }> = {
    low: { 
      icon: Info, 
      color: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    normal: { 
      icon: Bell, 
      color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
    high: { 
      icon: AlertCircle, 
      color: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
      iconColor: 'text-orange-600 dark:text-orange-400'
    },
    urgent: { 
      icon: Zap, 
      color: 'border-red-500 bg-red-50 dark:bg-red-900/20',
      iconColor: 'text-red-600 dark:text-red-400'
    }
  };

  const priority = notification.priority || 'normal';
  const config = priorityConfig[priority];
  const IconComponent = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.8 }}
          className="fixed top-4 right-4 z-[9999] max-w-sm w-full"
          style={{ zIndex: 99999 }}
        >
          <Card className={`border-2 shadow-2xl backdrop-blur-sm ${config.color}`}>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 ${config.iconColor}`}>
                  <IconComponent className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {notification.title || 'Notification'}
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                      onClick={() => {
                        setIsVisible(false);
                        setTimeout(() => onDismiss(notification.id), 300);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {notification.message || 'No message'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">
                      {notification.senderName || 'Unknown'} ({notification.senderRole || 'System'})
                    </span>
                    <div className="text-right">
                      <div className="uppercase font-bold text-xs">
                        {priority.toUpperCase()}
                      </div>
                      <div className="text-xs opacity-75">
                        {((notification as any).targetAudience || 'all').replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  {notification.mediaUrl && (
                    <div className="mt-2">
                      <img 
                        src={notification.mediaUrl} 
                        alt="Notification media"
                        className="max-w-full h-auto rounded-md"
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const PushNotificationManager: React.FC = () => {
  const { user } = useUltraFastAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);

      if (Notification.permission === 'default') {
        Notification.requestPermission().then((result) => {
          setPermission(result);
        });
      }
    }
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Poll for new notifications
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      try {
        console.log(`🔔 [NOTIFICATION DEBUG] Fetching notifications for user ${user.id}`);
        const response = await fetch(`/api/push-notifications/${user.id}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`🔔 [NOTIFICATION DEBUG] Received ${data.length} notifications for user ${user.id}:`, {
          total: data.length,
          byAudience: data.reduce((acc: any, notif: any) => {
            const audience = notif.targetAudience || 'unknown';
            acc[audience] = (acc[audience] || 0) + 1;
            return acc;
          }, {}),
          notifications: data.map((n: any) => ({
            id: n.id,
            title: n.title,
            audience: n.targetAudience,
            priority: n.priority
          }))
        });

          // Show notifications from the last 24 hours (more reasonable timeframe)
          const recentNotifications = data.filter((notif: any) => {
            const notifTime = new Date(notif.created_at).getTime();
            const now = Date.now();
            return (now - notifTime) < 24 * 60 * 60 * 1000; // 24 hours
          });

          // Show new notifications as popups
          recentNotifications.forEach((notif: any) => {
            if (!notifications.find(n => n.id === notif.id)) {
              const newNotification: NotificationData = {
                id: notif.id || 0,
                title: notif.title || 'Notification',
                message: notif.message || '',
                type: notif.type || 'info',
                timestamp: new Date(notif.created_at || Date.now()),
                priority: (notif.priority as NotificationPriority) || 'normal',
                senderName: notif.sent_by_name || notif.sent_by || 'Unknown',
                senderRole: notif.sent_by_role || 'System',
                mediaUrl: notif.media_url
              };

              setNotifications(prev => [...prev, newNotification]);

              // Show browser notification if permission granted
              if (permission === 'granted' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification(notif.title, {
                    body: notif.message,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    tag: `notification-${notif.id}`,
                    requireInteraction: notif.priority === 'urgent',
                    vibrate: notif.priority === 'urgent' ? [200, 100, 200, 100, 200] : [200],
                    data: {
                      notificationId: notif.id,
                      url: '/'
                    }
                  });
                });
              }

              // Play notification sound
              if (notif.priority === 'urgent' || notif.priority === 'high') {
                try {
                  const audio = new Audio('/notification-sound.mp3');
                  audio.volume = 0.5;
                  audio.play().catch(() => {
                    // Ignore audio play errors (user interaction required)
                  });
                } catch (error) {
                  // Ignore audio errors
                }
              }
            }
          });
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    // Initial fetch
    fetchNotifications();

    // Poll every 5 seconds for real-time updates (better balance of performance and responsiveness)
    const interval = setInterval(fetchNotifications, 5000);

    return () => clearInterval(interval);
  }, [user?.id, permission, notifications]);

  const dismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="fixed top-0 right-0 z-[9999] pointer-events-none">
      <div className="space-y-2 p-4 pointer-events-auto">
        {notifications.map((notification, index) => (
          <div
            key={`notification-${notification.id}-${index}`}
            style={{ 
              transform: `translateY(${index * 10}px)`,
              zIndex: 9999 - index
            }}
          >
            <NotificationPopup
              notification={notification}
              onDismiss={dismissNotification}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PushNotificationManager;