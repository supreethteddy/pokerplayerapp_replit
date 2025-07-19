-- Create GRE Chat Messages Table for Real-Time Player-Staff Communication
-- This script creates the table needed for the live chat feature between players and Guest Relation Executives

-- GRE Chat Messages Table
CREATE TABLE IF NOT EXISTS gre_chat_messages (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  sender VARCHAR(50) NOT NULL CHECK (sender IN ('player', 'gre', 'staff')),
  sender_name VARCHAR(255), -- Name of the GRE/staff member responding
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_gre_chat_player_id ON gre_chat_messages(player_id);
CREATE INDEX IF NOT EXISTS idx_gre_chat_timestamp ON gre_chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_gre_chat_sender ON gre_chat_messages(sender);

-- Add comments
COMMENT ON TABLE gre_chat_messages IS 'Real-time chat messages between players and Guest Relation Executives';
COMMENT ON COLUMN gre_chat_messages.player_id IS 'Reference to the player in the chat';
COMMENT ON COLUMN gre_chat_messages.sender IS 'Who sent the message: player, gre, or staff';
COMMENT ON COLUMN gre_chat_messages.status IS 'Message delivery status';

-- Enable Row Level Security (optional, for enhanced security)
ALTER TABLE gre_chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for players to view their own messages
CREATE POLICY IF NOT EXISTS "Players can view their own chat messages" 
ON gre_chat_messages FOR SELECT 
USING (player_id = current_setting('request.player_id')::INTEGER);

-- Create policy for staff to view all messages
CREATE POLICY IF NOT EXISTS "Staff can view all chat messages" 
ON gre_chat_messages FOR ALL 
USING (current_setting('request.user_role') = 'staff');

-- Insert demo messages for testing (optional)
-- INSERT INTO gre_chat_messages (player_id, player_name, message, sender, sender_name) VALUES
-- (29, 'vignesh gana', 'Hello, I need help with my account', 'player', NULL),
-- (29, 'vignesh gana', 'Hi! How can I assist you today?', 'gre', 'Support Team');

SELECT 'GRE Chat Messages table created successfully!' as result;