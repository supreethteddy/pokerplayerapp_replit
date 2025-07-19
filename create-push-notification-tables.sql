-- SQL Script to create push notification tables in Staff Portal Supabase
-- Run this in Staff Portal Supabase SQL Editor

-- Create push_notifications table for Staff Portal to send notifications to Player Portal
CREATE TABLE IF NOT EXISTS push_notifications (
    id SERIAL PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'manager', 'gre', 'staff', 'super_admin')),
    target_player_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video')),
    media_url TEXT,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
    broadcast_to_all BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create player_feedback table for receiving feedback from Player Portal
CREATE TABLE IF NOT EXISTS player_feedback (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'responded')),
    response TEXT,
    responded_by TEXT,
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security (RLS) for Supabase
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_feedback ENABLE ROW LEVEL SECURITY;

-- Create policies for push_notifications
CREATE POLICY "Staff can insert notifications" ON push_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can view all notifications" ON push_notifications
  FOR SELECT USING (true);

CREATE POLICY "Staff can update notifications" ON push_notifications
  FOR UPDATE USING (true);

-- Create policies for player_feedback
CREATE POLICY "Staff can view all feedback" ON player_feedback
  FOR SELECT USING (true);

CREATE POLICY "Staff can update feedback status" ON player_feedback
  FOR UPDATE USING (true);

CREATE POLICY "Allow feedback insertion" ON player_feedback
  FOR INSERT WITH CHECK (true);

-- Insert a test notification
INSERT INTO push_notifications (
  sender_id, 
  sender_name, 
  sender_role, 
  target_player_id, 
  title, 
  message, 
  priority
) VALUES (
  'staff_portal_admin', 
  'Staff Portal Manager', 
  'manager', 
  29, 
  'Push Notification System Active', 
  'The real-time push notification system is now operational! Staff can send notifications that will appear as pop-ups on the Player Portal.',
  'high'
);

-- Insert a broadcast notification for all players
INSERT INTO push_notifications (
  sender_id, 
  sender_name, 
  sender_role, 
  title, 
  message, 
  priority,
  broadcast_to_all
) VALUES (
  'staff_portal_system', 
  'Poker Room Management', 
  'admin', 
  'System Announcement', 
  'Welcome to our enhanced notification system! You will now receive real-time updates and announcements.',
  'normal',
  true
);