-- GRE Admin Portal Integration Script
-- Execute this script in Staff Portal Supabase to create GRE admin tab functionality

-- Create GRE admin configuration table
CREATE TABLE IF NOT EXISTS gre_admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(255) UNIQUE NOT NULL,
  config_value TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create GRE admin permissions table
CREATE TABLE IF NOT EXISTS gre_admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT NOT NULL,
  permission_type VARCHAR(100) NOT NULL,
  resource_access TEXT[], -- Array of accessible resources
  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create GRE admin activity logs table
CREATE TABLE IF NOT EXISTS gre_admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT NOT NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default GRE admin configuration
INSERT INTO gre_admin_config (config_key, config_value, description) VALUES
('gre_admin_enabled', 'true', 'Enable GRE admin portal access'),
('player_management_enabled', 'true', 'Allow GRE admin to manage players'),
('table_management_enabled', 'true', 'Allow GRE admin to manage tables'),
('kyc_approval_enabled', 'true', 'Allow GRE admin to approve KYC documents'),
('transaction_monitoring_enabled', 'true', 'Allow GRE admin to monitor transactions'),
('analytics_access_enabled', 'true', 'Allow GRE admin to view analytics'),
('system_health_access', 'true', 'Allow GRE admin to view system health'),
('max_concurrent_admins', '10', 'Maximum concurrent GRE admin sessions'),
('session_timeout_minutes', '60', 'GRE admin session timeout in minutes'),
('audit_log_retention_days', '90', 'How long to keep GRE admin activity logs');

-- Insert default GRE admin permissions for all admins
INSERT INTO gre_admin_permissions (admin_id, permission_type, resource_access, can_read, can_write, can_delete, can_approve) VALUES
('*', 'PLAYER_MANAGEMENT', ARRAY['players', 'player_preferences', 'kyc_documents'], true, true, false, true),
('*', 'TABLE_MANAGEMENT', ARRAY['tables', 'table_assignments', 'waitlist'], true, true, true, false),
('*', 'TRANSACTION_MONITORING', ARRAY['transactions', 'credits', 'debits'], true, false, false, false),
('*', 'ANALYTICS_ACCESS', ARRAY['analytics', 'reports', 'dashboards'], true, false, false, false),
('*', 'SYSTEM_HEALTH', ARRAY['system_logs', 'health_checks', 'performance'], true, false, false, false);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_gre_admin_config_key ON gre_admin_config(config_key);
CREATE INDEX IF NOT EXISTS idx_gre_admin_permissions_admin_id ON gre_admin_permissions(admin_id);
CREATE INDEX IF NOT EXISTS idx_gre_admin_permissions_type ON gre_admin_permissions(permission_type);
CREATE INDEX IF NOT EXISTS idx_gre_admin_activity_admin_id ON gre_admin_activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_gre_admin_activity_created_at ON gre_admin_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_gre_admin_activity_action ON gre_admin_activity_logs(action);

-- Create RLS (Row Level Security) policies for GRE admin access
ALTER TABLE gre_admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE gre_admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gre_admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read GRE admin configuration
CREATE POLICY "GRE admin config read access" ON gre_admin_config
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to read their own permissions
CREATE POLICY "GRE admin permissions read access" ON gre_admin_permissions
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert activity logs
CREATE POLICY "GRE admin activity log insert" ON gre_admin_activity_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to read activity logs
CREATE POLICY "GRE admin activity log read" ON gre_admin_activity_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create function to log GRE admin activities
CREATE OR REPLACE FUNCTION log_gre_admin_activity(
  p_admin_id TEXT,
  p_action VARCHAR(255),
  p_resource_type VARCHAR(100) DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO gre_admin_activity_logs (
    admin_id, action, resource_type, resource_id, old_values, new_values
  ) VALUES (
    p_admin_id, p_action, p_resource_type, p_resource_id, p_old_values, p_new_values
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check GRE admin permissions
CREATE OR REPLACE FUNCTION check_gre_admin_permission(
  p_admin_id TEXT,
  p_permission_type VARCHAR(100),
  p_action VARCHAR(20) DEFAULT 'read'
) RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := false;
BEGIN
  SELECT CASE 
    WHEN p_action = 'read' THEN can_read
    WHEN p_action = 'write' THEN can_write  
    WHEN p_action = 'delete' THEN can_delete
    WHEN p_action = 'approve' THEN can_approve
    ELSE false
  END INTO has_permission
  FROM gre_admin_permissions 
  WHERE (admin_id = p_admin_id OR admin_id = '*') 
    AND permission_type = p_permission_type
    AND is_active = true
  LIMIT 1;
  
  RETURN COALESCE(has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify GRE admin integration setup
SELECT 
  'GRE Admin Tables Created' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'gre_admin%') as table_count,
  (SELECT COUNT(*) FROM gre_admin_config) as config_count,
  (SELECT COUNT(*) FROM gre_admin_permissions) as permission_count;