import React, { useEffect, useState } from 'react';
import { useUltraFastAuth } from '@/hooks/useUltraFastAuth';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Bell, AlertCircle, Info, Zap, LogIn, Clock, Trophy, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '@/lib/api/config';

type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

interface NotificationData {
  id: number;
  title: string;
  message: string;
  message_type: string;
  timestamp: Date;
  priority: NotificationPriority;
  senderName: string;
  senderRole: string;
  mediaUrl?: string;
  read_at?: Date;
}

interface NotificationBubbleProps {
  notification: NotificationData;
  onDismiss: (id: number) => void;
}

// Notification type to color mapping
const getNotificationTypeConfig = (messageType: string) => {
  const typeConfigs: Record<string, { 
    icon: React.ComponentType<any>; 
    color: string; 
    iconColor: string; 
    bgColor: string;
  }> = {
    login: { 
      icon: LogIn, 
      color: 'border-blue-500',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    seat_waiting: { 
      icon: Clock, 
      color: 'border-orange-500',
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20'
    },
    tournament: { 
      icon: Trophy, 
      color: 'border-purple-500',
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    payment: { 
      icon: CreditCard, 
      color: 'border-green-500',
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    general: { 
      icon: Bell, 
      color: 'border-emerald-500',
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
    },
    urgent: { 
      icon: Zap, 
      color: 'border-red-500',
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    }
  };

  return typeConfigs[messageType] || typeConfigs.general;
};

const NotificationBubble: React.FC<NotificationBubbleProps> = ({ notification, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-dismiss after delay based on priority
  useEffect(() => {
    if (!notification) return;

    const dismissDelay: Record<NotificationPriority, number> = {
      low: 6000,
      normal: 10000,
      high: 15000,
      urgent: 25000 // Urgent notifications stay longer
    };

    const priority = notification.priority || 'normal';
    const delay = dismissDelay[priority] || 10000;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(notification.id), 300);
    }, delay);

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const config = getNotificationTypeConfig(notification.message_type);
  const IconComponent = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-4 right-4 z-[9999] max-w-sm w-full"
          style={{ zIndex: 99999 }}
        >
          <Card className={`border-2 shadow-2xl backdrop-blur-sm ${config.color} ${config.bgColor}`}>
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
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 leading-relaxed">
                    {notification.message || 'No message'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">
                      {notification.senderName || 'System'} 
                      {notification.senderRole && ` (${notification.senderRole})`}
                    </span>
                    <span className={`uppercase font-bold text-xs px-2 py-1 rounded ${config.bgColor} ${config.iconColor}`}>
                      {notification.message_type.replace('_', ' ')}
                    </span>
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

export const NotificationBubbleManager: React.FC = () => {
  const { user } = useUltraFastAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Enable real-time notifications via Supabase Realtime (no polling needed!)
  useRealtimeNotifications(user?.id);

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

  // Function to save notification to bell icon history
  const saveNotificationToHistory = async (notification: NotificationData) => {
    try {
      await fetch(`${API_BASE_URL}/notification-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          notificationId: notification.id,
          playerId: user?.id,
          action: 'dismissed_to_history'
        }),
      });
    } catch (error) {
      console.error('❌ [NOTIFICATION HISTORY] Failed to save:', error);
    }
  };

  // Poll for new notifications
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/push-notifications/${user.id}`, {
          method: 'GET',
          credentials: 'include',
        }).catch(() => null); // Silently catch network errors
        
        // If fetch failed or endpoint doesn't exist, skip silently
        if (!response || response.status === 404) {
          return;
        }
        
        if (response.ok) {
          const data = await response.json();
          console.log('📱 [BUBBLE MANAGER] Fetched notifications:', data.length);

          // Only show notifications from the last 10 minutes as bubbles
          const recentNotifications = data.filter((notif: any) => {
            const notifTime = new Date(notif.created_at).getTime();
            const now = Date.now();
            return (now - notifTime) < 10 * 60 * 1000; // 10 minutes
          });

          // Show new notifications as bubbles
          recentNotifications.forEach((notif: any) => {
            if (!notifications.find(n => n.id === notif.id)) {
              const newNotification: NotificationData = {
                id: notif.id || 0,
                title: notif.title || 'Notification',
                message: notif.message || '',
                message_type: notif.message_type || 'general',
                timestamp: new Date(notif.created_at || Date.now()),
                priority: (notif.priority as NotificationPriority) || 'normal',
                senderName: notif.sender_name || notif.sent_by_name || 'System',
                senderRole: notif.sender_role || notif.sent_by_role || 'System',
                mediaUrl: notif.media_url
              };

              console.log('🎈 [BUBBLE] Showing new notification:', newNotification.title, newNotification.message_type);
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
                    // vibrate: notif.priority === 'urgent' ? [200, 100, 200, 100, 200] : [200], // Removed - not supported in all browsers
                    data: {
                      notificationId: notif.id,
                      url: '/'
                    }
                  });
                });
              }

              // Play notification sound for important notifications
              if (notif.priority === 'urgent' || notif.priority === 'high') {
                try {
                  const audio = new Audio('/notification-sound.mp3');
                  audio.volume = 0.3;
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
        console.error('❌ [BUBBLE MANAGER] Error fetching notifications:', error);
      }
    };

    // Initial fetch
    fetchNotifications();

    // Poll every 5 seconds for optimized performance
    const interval = setInterval(fetchNotifications, 5000);

    return () => clearInterval(interval);
  }, [user?.id, permission, notifications]);

  const dismissNotification = async (id: number) => {
    console.log('🎈 [BUBBLE] Dismissing notification:', id);
    const notification = notifications.find(n => n.id === id);
    
    if (notification) {
      // Save to bell icon history
      await saveNotificationToHistory(notification);
    }
    
    // Remove from bubble display
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="fixed top-0 right-0 z-[9999] pointer-events-none">
      <div className="space-y-2 p-4 pointer-events-auto">
        {notifications.map((notification, index) => (
          <div
            key={`bubble-${notification.id}-${index}`}
            style={{ 
              transform: `translateY(${index * 10}px)`,
              zIndex: 9999 - index
            }}
          >
            <NotificationBubble
              notification={notification}
              onDismiss={dismissNotification}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationBubbleManager;