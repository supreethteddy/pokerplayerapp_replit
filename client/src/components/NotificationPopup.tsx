import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Bell, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

interface NotificationPopupProps {
  userId: number;
  onChatNotificationClick?: () => void;
}

export default function NotificationPopup({ userId, onChatNotificationClick }: NotificationPopupProps) {
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());
  const [visibleNotifications, setVisibleNotifications] = useState<any[]>([]);
  const [dismissTimers, setDismissTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());

  // Enable real-time notifications via Supabase Realtime (no polling needed!)
  useRealtimeNotifications(userId);

  // Fetch notifications (now updated automatically via Realtime)
  const { data: notifications } = useQuery({
    queryKey: ['/api/push-notifications', userId],
    // No refetchInterval - Supabase Realtime handles updates automatically!
    refetchOnWindowFocus: true,
    staleTime: 0 // Always fetch fresh data
  });

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      // Get permanently dismissed notifications from localStorage
      const dismissedNotifications = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
      
      // Filter out notifications older than 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentNotifications = notifications.filter((notif: any) => 
        new Date(notif.created_at) > twentyFourHoursAgo
      );

      // Show new notifications as pop-ups (only if not already seen and not dismissed)
      const newNotifications = recentNotifications.filter((notif: any) => 
        !shownNotifications.has(notif.id) && 
        notif.delivery_status !== 'read' &&
        !dismissedNotifications.includes(String(notif.id))
      );

      if (newNotifications.length > 0) {
        setVisibleNotifications(prev => [...prev, ...newNotifications]);
        setShownNotifications(prev => new Set([...prev, ...newNotifications.map((n: any) => n.id)]));
        
        // Auto-dismiss notifications after 8 seconds (8000ms)
        newNotifications.forEach((notification: any) => {
          const timer = setTimeout(() => {
            dismissNotification(notification.id);
          }, 8000);
          
          setDismissTimers(prev => {
            const newMap = new Map(prev);
            newMap.set(notification.id, timer);
            return newMap;
          });
        });
      }
    }
  }, [notifications, shownNotifications]);

  const dismissNotification = (notificationId: string | number) => {
    // Clear any auto-dismiss timer
    const timer = dismissTimers.get(String(notificationId));
    if (timer) {
      clearTimeout(timer);
      setDismissTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(String(notificationId));
        return newMap;
      });
    }
    
    setVisibleNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    
    // Mark as read on server and add to permanent shown list
    fetch(`/api/push-notifications/${notificationId}/read`, {
      method: 'PATCH'
    }).catch(console.error);
    
    // Store in localStorage to prevent re-showing across sessions
    const dismissedNotifications = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
    if (!dismissedNotifications.includes(String(notificationId))) {
      dismissedNotifications.push(String(notificationId));
      localStorage.setItem('dismissedNotifications', JSON.stringify(dismissedNotifications));
    }
  };

  const handleNotificationClick = (notification: any) => {
    // Check if this is a chat notification by looking for chat-related keywords
    const isChatNotification = 
      notification.sent_by_role === 'gre' ||
      notification.sender_role === 'gre' ||
      notification.title?.toLowerCase().includes('chat') ||
      notification.title?.toLowerCase().includes('message') ||
      notification.message?.toLowerCase().includes('chat') ||
      notification.message?.toLowerCase().includes('message');

    if (isChatNotification && onChatNotificationClick) {
      console.log('🔔 [NOTIFICATION] Chat notification clicked, opening chat dialog');
      onChatNotificationClick();
    }
    
    // Always dismiss the notification when clicked
    dismissNotification(notification.id);
  };
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      dismissTimers.forEach(timer => clearTimeout(timer));
    };
  }, [dismissTimers]);

  const getPriorityIcon = (priority: string) => {
    if (!priority) return <Info className="w-5 h-5 text-blue-500" />;
    
    switch (priority.toLowerCase()) {
      case 'urgent': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'high': return <Bell className="w-5 h-5 text-yellow-500" />;
      case 'normal': return <Info className="w-5 h-5 text-blue-500" />;
      default: return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getPriorityColors = (priority: string) => {
    if (!priority) return 'border-blue-500 bg-blue-900/90 shadow-blue-500/30';
    
    switch (priority.toLowerCase()) {
      case 'urgent': return 'border-red-500 bg-red-900/90 shadow-red-500/30';
      case 'high': return 'border-yellow-500 bg-yellow-900/90 shadow-yellow-500/30';
      case 'normal': return 'border-blue-500 bg-blue-900/90 shadow-blue-500/30';
      default: return 'border-green-500 bg-green-900/90 shadow-green-500/30';
    }
  };

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {visibleNotifications.map((notification, index) => (
        <Card 
          key={notification.id}
          className={`${getPriorityColors(notification.priority)} border-2 shadow-lg backdrop-blur-sm animate-in slide-in-from-right-5 duration-500 cursor-pointer hover:scale-105 transition-transform`}
          style={{ 
            animationDelay: `${index * 200}ms`,
            animationFillMode: 'both'
          }}
          onClick={() => handleNotificationClick(notification)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getPriorityIcon(notification.priority)}
                <span className="text-xs font-medium text-white bg-slate-700/80 px-2 py-1 rounded">
                  {(notification.sender_role || notification.sent_by_role || 'SYSTEM')?.toString().toUpperCase() || 'SYSTEM'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissNotification(notification.id)}
                className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <h4 className="text-white font-semibold text-sm mb-1">
              {notification.title}
            </h4>
            
            <p className="text-white/90 text-xs mb-2 leading-relaxed">
              {notification.message}
            </p>
            
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>{notification.sender_name || notification.sent_by_name || 'System'}</span>
              <span>{new Date(notification.created_at || notification.sent_at).toLocaleTimeString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}