-- =====================================
-- FEEDBACK AND PUSH NOTIFICATION SYSTEM
-- Complete table setup for Player Portal
-- =====================================

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS push_notifications CASCADE;
DROP TABLE IF EXISTS player_feedback CASCADE;

-- Create player_feedback table
CREATE TABLE player_feedback (
    id SERIAL PRIMARY KEY,
    player_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'responded')),
    response TEXT,
    responded_by TEXT,
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint to players table
ALTER TABLE player_feedback 
ADD CONSTRAINT fk_player_feedback_player_id 
FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_player_feedback_player_id ON player_feedback(player_id);
CREATE INDEX idx_player_feedback_status ON player_feedback(status);
CREATE INDEX idx_player_feedback_created_at ON player_feedback(created_at DESC);

-- Create push_notifications table
CREATE TABLE push_notifications (
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

-- Add foreign key constraint to players table (nullable for broadcast messages)
ALTER TABLE push_notifications 
ADD CONSTRAINT fk_push_notifications_target_player_id 
FOREIGN KEY (target_player_id) REFERENCES players(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_push_notifications_target_player_id ON push_notifications(target_player_id);
CREATE INDEX idx_push_notifications_broadcast ON push_notifications(broadcast_to_all);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);
CREATE INDEX idx_push_notifications_priority ON push_notifications(priority);
CREATE INDEX idx_push_notifications_sender_role ON push_notifications(sender_role);
CREATE INDEX idx_push_notifications_created_at ON push_notifications(created_at DESC);

-- Create composite index for efficient player notification queries
CREATE INDEX idx_push_notifications_player_broadcast ON push_notifications(target_player_id, broadcast_to_all, created_at DESC);

-- Enable Row Level Security (RLS) for both tables
ALTER TABLE player_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player_feedback
-- Players can only see their own feedback
CREATE POLICY "Players can view own feedback" ON player_feedback
    FOR SELECT USING (player_id = auth.uid()::text::integer);

-- Players can insert their own feedback
CREATE POLICY "Players can insert own feedback" ON player_feedback
    FOR INSERT WITH CHECK (player_id = auth.uid()::text::integer);

-- Staff can view all feedback
CREATE POLICY "Staff can view all feedback" ON player_feedback
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM staff_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager', 'super_admin')
        )
    );

-- Create RLS policies for push_notifications
-- Players can view notifications targeted to them or broadcast notifications
CREATE POLICY "Players can view own notifications" ON push_notifications
    FOR SELECT USING (
        target_player_id = auth.uid()::text::integer 
        OR broadcast_to_all = TRUE
    );

-- Players can update read status of their notifications
CREATE POLICY "Players can update own notification status" ON push_notifications
    FOR UPDATE USING (
        target_player_id = auth.uid()::text::integer 
        OR broadcast_to_all = TRUE
    );

-- Staff can insert notifications
CREATE POLICY "Staff can insert notifications" ON push_notifications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager', 'super_admin', 'gre', 'staff')
        )
    );

-- Staff can view all notifications
CREATE POLICY "Staff can view all notifications" ON push_notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM staff_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager', 'super_admin', 'gre', 'staff')
        )
    );

-- Insert sample data for testing (optional)
-- Uncomment the following lines to add test data

/*
-- Sample feedback data
INSERT INTO player_feedback (player_id, message, status) VALUES
(29, 'The mobile app is working great! Very smooth experience.', 'unread'),
(29, 'Could you add more tournament options for weekdays?', 'unread');

-- Sample push notification data
INSERT INTO push_notifications (
    sender_id, sender_name, sender_role, target_player_id, 
    title, message, priority
) VALUES
('staff_001', 'John Manager', 'manager', 29, 
 'Welcome to Player Portal', 
 'Welcome to our poker room! Your account has been verified and you can now start playing.', 
 'normal'),
('admin_001', 'Sarah Admin', 'admin', NULL,
 'System Maintenance Notice',
 'Scheduled maintenance will occur tonight from 2 AM to 4 AM. All games will be temporarily unavailable.',
 'high');

-- Set broadcast flag for the system maintenance notice
UPDATE push_notifications 
SET broadcast_to_all = TRUE 
WHERE title = 'System Maintenance Notice';
*/

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON player_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON push_notifications TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE player_feedback_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE push_notifications_id_seq TO authenticated;

-- Create functions for notification management
CREATE OR REPLACE FUNCTION mark_notification_as_read(notification_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE push_notifications 
    SET status = 'read', read_at = CURRENT_TIMESTAMP 
    WHERE id = notification_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get unread notification count for a player
CREATE OR REPLACE FUNCTION get_unread_notification_count(player_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) 
        FROM push_notifications 
        WHERE (target_player_id = player_id OR broadcast_to_all = TRUE)
        AND status = 'sent'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to send broadcast notification
CREATE OR REPLACE FUNCTION send_broadcast_notification(
    sender_id TEXT,
    sender_name TEXT,
    sender_role TEXT,
    title TEXT,
    message TEXT,
    priority TEXT DEFAULT 'normal'
)
RETURNS INTEGER AS $$
DECLARE
    new_notification_id INTEGER;
BEGIN
    INSERT INTO push_notifications (
        sender_id, sender_name, sender_role, target_player_id,
        title, message, priority, broadcast_to_all
    ) VALUES (
        sender_id, sender_name, sender_role, NULL,
        title, message, priority, TRUE
    ) RETURNING id INTO new_notification_id;
    
    RETURN new_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
SELECT 'Feedback and Push Notification System tables created successfully!' as result;