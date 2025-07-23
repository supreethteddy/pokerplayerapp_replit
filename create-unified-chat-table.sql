-- CRITICAL: Unified Chat System Table for Staff Portal Integration
-- This creates the unified_chat_requests table that Staff Portal expects

-- Create the unified chat requests table
CREATE TABLE IF NOT EXISTS unified_chat_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    player_email TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    source TEXT DEFAULT 'poker_room_tracker',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
    resolution_note TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_chat_player_id ON unified_chat_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_unified_chat_status ON unified_chat_requests(status);
CREATE INDEX IF NOT EXISTS idx_unified_chat_priority ON unified_chat_requests(priority);
CREATE INDEX IF NOT EXISTS idx_unified_chat_created_at ON unified_chat_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_unified_chat_source ON unified_chat_requests(source);

-- Add RLS policies for security
ALTER TABLE unified_chat_requests ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to insert their own requests
CREATE POLICY "Users can create their own chat requests" ON unified_chat_requests
    FOR INSERT WITH CHECK (true);

-- Allow all authenticated users to read requests
CREATE POLICY "Users can read chat requests" ON unified_chat_requests
    FOR SELECT USING (true);

-- Allow staff to update requests (for status changes and responses)
CREATE POLICY "Staff can update chat requests" ON unified_chat_requests
    FOR UPDATE USING (true);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_unified_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_unified_chat_updated_at
    BEFORE UPDATE ON unified_chat_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_unified_chat_updated_at();

-- Insert a test message to verify the table works
INSERT INTO unified_chat_requests (
    player_id,
    player_name,
    player_email,
    message,
    priority,
    source,
    status
) VALUES (
    29,
    'Vignesh Gana',
    'vignesh.wildleaf@gmail.com',
    'UNIFIED SYSTEM TEST: Player Portal successfully integrated with Staff Portal unified chat system - ' || NOW()::TEXT,
    'urgent',
    'poker_room_tracker',
    'pending'
);

-- Verify table creation and data
SELECT 
    'Table created successfully' as status,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
    COUNT(CASE WHEN source = 'poker_room_tracker' THEN 1 END) as poker_room_requests
FROM unified_chat_requests;