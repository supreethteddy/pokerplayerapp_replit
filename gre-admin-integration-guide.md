# GRE Admin Portal Integration Guide

## Overview
Complete integration guide for adding GRE admin functionality to the Staff Portal, ensuring full connectivity with the Player Portal and comprehensive cross-portal functionality.

## Database Setup

### 1. Execute GRE Admin Tables Script
Run the `gre-admin-integration.sql` script in your Staff Portal Supabase SQL Editor:

```sql
-- This script creates:
-- - gre_admin_config: Configuration settings for GRE admin portal
-- - gre_admin_permissions: Role-based access control system
-- - gre_admin_activity_logs: Complete audit trail for all admin actions
```

### 2. Verify Table Creation
After running the script, verify tables were created:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'gre_admin%';
```

## API Integration

### Available GRE Admin Endpoints

#### 1. Connectivity Test
```
GET /api/gre-admin/connectivity
```
Tests connection to all required tables and returns connectivity status.

#### 2. Player Management  
```
GET /api/gre-admin/players
```
Retrieves all players with their preferences, KYC documents, transactions, and game sessions.

#### 3. Table Management
```
GET /api/gre-admin/tables
```
Fetches all tables with assignments and waitlist information.

#### 4. Analytics Dashboard
```
GET /api/gre-admin/analytics
```
Provides comprehensive analytics including:
- Total players
- KYC approval rates
- Active tables
- Transaction volumes

#### 5. System Health Monitor
```
GET /api/gre-admin/system-health
```
Real-time system health checks for all core systems.

## Frontend Integration

### Add GRE Tab to Staff Portal

1. **Add Tab Navigation**
```jsx
<TabsTrigger value="gre-admin">GRE Admin</TabsTrigger>
```

2. **Create GRE Admin Component**
```jsx
<TabsContent value="gre-admin" className="space-y-4">
  <GREAdminDashboard />
</TabsContent>
```

3. **Implement GRE Admin Dashboard**
```jsx
const GREAdminDashboard = () => {
  const { data: connectivity } = useQuery({
    queryKey: ['/api/gre-admin/connectivity'],
    refetchInterval: 30000
  });

  const { data: analytics } = useQuery({
    queryKey: ['/api/gre-admin/analytics'],
    refetchInterval: 60000
  });

  const { data: systemHealth } = useQuery({
    queryKey: ['/api/gre-admin/system-health'],
    refetchInterval: 15000
  });

  // Dashboard implementation
  return (
    <div className="space-y-6">
      <ConnectivityStatus data={connectivity} />
      <AnalyticsDashboard data={analytics} />
      <SystemHealthMonitor data={systemHealth} />
      <PlayerManagement />
      <TableManagement />
    </div>
  );
};
```

## Permission System

### Default Permissions
- **PLAYER_MANAGEMENT**: Read/Write access to players, preferences, KYC documents
- **TABLE_MANAGEMENT**: Full access to tables, assignments, waitlist
- **TRANSACTION_MONITORING**: Read-only access to transactions and financial data
- **ANALYTICS_ACCESS**: Read-only access to analytics and reports
- **SYSTEM_HEALTH**: Read-only access to system monitoring

### Custom Permission Check
```sql
SELECT check_gre_admin_permission('admin_id', 'PLAYER_MANAGEMENT', 'write');
```

## Activity Logging

### Automatic Logging
All GRE admin actions are automatically logged with:
- Admin ID
- Action performed
- Resource affected
- Old and new values
- IP address and user agent
- Timestamp

### Manual Logging
```sql
SELECT log_gre_admin_activity(
  'admin_id',
  'PLAYER_KYC_APPROVED',
  'kyc_documents',
  'document_id',
  '{"status": "pending"}'::jsonb,
  '{"status": "approved"}'::jsonb
);
```

## Security Features

### Row Level Security (RLS)
- All GRE admin tables have RLS enabled
- Authenticated users can access based on permissions
- Activity logs are append-only for audit trail

### Data Retention
- Activity logs retained for 90 days (configurable)
- Old logs automatically cleaned up
- Critical actions permanently logged

## Testing Connectivity

### 1. Test API Endpoints
```bash
curl http://localhost:5000/api/gre-admin/connectivity
curl http://localhost:5000/api/gre-admin/system-health
curl http://localhost:5000/api/gre-admin/analytics
```

### 2. Verify Database Access
```sql
-- Test player access
SELECT COUNT(*) FROM players;

-- Test KYC access  
SELECT COUNT(*) FROM kyc_documents;

-- Test table access
SELECT COUNT(*) FROM tables;
```

### 3. Check Permissions
```sql
-- Verify admin permissions
SELECT * FROM gre_admin_permissions WHERE admin_id = '*';

-- Test permission function
SELECT check_gre_admin_permission('test_admin', 'PLAYER_MANAGEMENT', 'read');
```

## Cross-Portal Synchronization

### Player Portal Integration
- Player accounts automatically accessible in GRE admin
- Real-time updates between portals
- Unified player identification system

### Staff Portal Integration  
- GRE admin tab seamlessly integrated
- Shared authentication and session management
- Consistent UI/UX with existing portal design

### Master Admin Integration
- Complete visibility into GRE admin activities
- Override capabilities for critical operations
- Comprehensive audit trail access

## Configuration Options

### GRE Admin Settings
Available in `gre_admin_config` table:
- `gre_admin_enabled`: Enable/disable GRE admin access
- `player_management_enabled`: Control player management features
- `table_management_enabled`: Control table management features
- `kyc_approval_enabled`: Control KYC approval capabilities
- `max_concurrent_admins`: Limit concurrent admin sessions
- `session_timeout_minutes`: Session timeout configuration

### Update Configuration
```sql
UPDATE gre_admin_config 
SET config_value = 'true' 
WHERE config_key = 'gre_admin_enabled';
```

## Troubleshooting

### Common Issues

1. **Connectivity Test Fails**
   - Verify Supabase connection
   - Check table existence
   - Validate permissions

2. **Permission Denied Errors**
   - Check RLS policies
   - Verify admin permissions
   - Update permission settings

3. **Analytics Not Loading**
   - Verify data existence
   - Check query performance
   - Review error logs

### Support Commands
```bash
# Test all endpoints
curl http://localhost:5000/api/gre-admin/connectivity
curl http://localhost:5000/api/gre-admin/players
curl http://localhost:5000/api/gre-admin/tables
curl http://localhost:5000/api/gre-admin/analytics
curl http://localhost:5000/api/gre-admin/system-health
```

## Implementation Checklist

- [ ] Execute gre-admin-integration.sql script
- [ ] Verify all GRE admin tables created
- [ ] Test API endpoint connectivity
- [ ] Add GRE tab to Staff Portal navigation
- [ ] Implement GRE Admin Dashboard component
- [ ] Configure permissions for admin users
- [ ] Test cross-portal player connectivity
- [ ] Verify activity logging functionality
- [ ] Set up monitoring and alerts
- [ ] Document admin procedures

## Support

For technical support or questions about GRE admin integration:
1. Check API endpoint responses for error details
2. Review activity logs for debugging information
3. Verify database connectivity and permissions
4. Test with sample data before production deployment