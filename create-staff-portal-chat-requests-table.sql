-- Create chat_requests table for Staff Portal integration
-- This table will store messages from Player Portal to appear in Staff Portal's GRE chat interface

CREATE TABLE IF NOT EXISTS public.chat_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    player_email TEXT,
    subject TEXT NOT NULL,
    priority TEXT DEFAULT 'urgent' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'resolved', 'closed')),
    source TEXT DEFAULT 'player_portal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE NULL,
    resolved_by TEXT NULL,
    notes TEXT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_requests_player_id ON chat_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_chat_requests_status ON chat_requests(status);
CREATE INDEX IF NOT EXISTS idx_chat_requests_priority ON chat_requests(priority);
CREATE INDEX IF NOT EXISTS idx_chat_requests_created_at ON chat_requests(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE chat_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY "Allow all access to chat_requests" ON chat_requests
    FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON chat_requests TO postgres;
GRANT ALL ON chat_requests TO service_role;
GRANT SELECT, INSERT, UPDATE ON chat_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON chat_requests TO authenticated;

-- Insert test data to verify functionality
INSERT INTO chat_requests (player_id, player_name, player_email, subject, priority) VALUES
(29, 'Vignesh Gana', 'vignesh.wildleaf@gmail.com', 'Test message for Staff Portal GRE integration', 'urgent'),
(29, 'Vignesh Gana', 'vignesh.wildleaf@gmail.com', 'Backend integration working - messages appear in GRE staff chat', 'high')
ON CONFLICT DO NOTHING;

-- Show table structure
\d chat_requests;

-- Show test data
SELECT id, player_id, player_name, subject, priority, status, created_at 
FROM chat_requests 
ORDER BY created_at DESC 
LIMIT 5;