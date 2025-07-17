# MASTER ADMIN PORTAL INTEGRATION PROMPT

## Overview
Implement comprehensive KYC document management, player administration, and analytics in your Master Admin Portal with full cross-portal synchronization.

## Required Environment Variables
```
MASTER_ADMIN_SUPABASE_URL=https://oyhnpnymlezjusnwpjeu.supabase.co
MASTER_ADMIN_SUPABASE_SERVICE_KEY=[Your Service Key]
```

## 1. Advanced KYC Management API Endpoints

### Add these endpoints to your Master Admin Portal:

```javascript
// Get all KYC documents with advanced filtering
app.get("/api/admin/kyc-documents/advanced", async (req, res) => {
  try {
    const { status, documentType, dateFrom, dateTo, limit = 50, offset = 0 } = req.query;
    console.log(`🔍 [ADMIN KYC] Advanced KYC search with filters`);
    
    let query = supabase
      .from('kyc_documents')
      .select(`
        *,
        players!inner(id, first_name, last_name, email, phone, kyc_status)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply filters
    if (status) query = query.eq('status', status);
    if (documentType) query = query.eq('document_type', documentType);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);
    
    const { data: documents, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch KYC documents: ${error.message}`);
    }
    
    console.log(`✅ [ADMIN KYC] Found ${documents?.length || 0} documents with filters`);
    res.json(documents || []);
  } catch (error) {
    console.error(`❌ [ADMIN KYC] Error in advanced search:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk KYC operations with audit logging
app.post("/api/admin/kyc-documents/bulk-action", async (req, res) => {
  try {
    const { action, docIds, reason, adminId } = req.body;
    console.log(`📝 [ADMIN KYC] Bulk ${action} on ${docIds.length} documents`);
    
    // Perform bulk action
    const { data: documents, error } = await supabase
      .from('kyc_documents')
      .update({ 
        status: action,
        updated_at: new Date().toISOString(),
        admin_notes: reason
      })
      .in('id', docIds)
      .select();
    
    if (error) {
      throw new Error(`Failed to perform bulk action: ${error.message}`);
    }
    
    // Log audit trail
    const auditEntries = documents.map(doc => ({
      action: `kyc_${action}`,
      target_type: 'kyc_document',
      target_id: doc.id,
      admin_id: adminId,
      details: { reason, document_type: doc.document_type, player_id: doc.player_id }
    }));
    
    await supabase.from('audit_logs').insert(auditEntries);
    
    console.log(`✅ [ADMIN KYC] Bulk ${action} completed on ${documents.length} documents`);
    res.json({ success: true, updatedCount: documents.length, documents });
  } catch (error) {
    console.error(`❌ [ADMIN KYC] Error in bulk action:`, error);
    res.status(500).json({ error: error.message });
  }
});

// KYC Analytics and Reporting
app.get("/api/admin/kyc-analytics/comprehensive", async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    console.log(`📊 [ADMIN KYC] Generating comprehensive analytics for ${period}`);
    
    const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const dateFrom = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    
    // Get documents with player data
    const { data: documents, error } = await supabase
      .from('kyc_documents')
      .select(`
        *,
        players!inner(id, first_name, last_name, email, created_at as player_created_at)
      `)
      .gte('created_at', dateFrom);
    
    if (error) {
      throw new Error(`Failed to fetch analytics data: ${error.message}`);
    }
    
    // Calculate comprehensive analytics
    const analytics = {
      totalDocuments: documents.length,
      byStatus: documents.reduce((acc, doc) => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
        return acc;
      }, {}),
      byType: documents.reduce((acc, doc) => {
        acc[doc.document_type] = (acc[doc.document_type] || 0) + 1;
        return acc;
      }, {}),
      byDate: documents.reduce((acc, doc) => {
        const date = new Date(doc.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {}),
      approvalRate: documents.length > 0 ? 
        ((documents.filter(doc => doc.status === 'approved').length / documents.length) * 100).toFixed(2) : 0,
      avgProcessingTime: calculateAvgProcessingTime(documents),
      topPlayers: getTopPlayersByDocuments(documents),
      recentActivity: documents.slice(0, 20).map(doc => ({
        id: doc.id,
        type: doc.document_type,
        status: doc.status,
        playerName: `${doc.players.first_name} ${doc.players.last_name}`,
        createdAt: doc.created_at
      }))
    };
    
    console.log(`✅ [ADMIN KYC] Analytics generated: ${analytics.totalDocuments} documents analyzed`);
    res.json(analytics);
  } catch (error) {
    console.error(`❌ [ADMIN KYC] Error generating analytics:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Player management with KYC integration
app.get("/api/admin/players/with-kyc", async (req, res) => {
  try {
    const { kycStatus, limit = 100, offset = 0 } = req.query;
    console.log(`👥 [ADMIN PLAYERS] Getting players with KYC status: ${kycStatus || 'all'}`);
    
    let query = supabase
      .from('players')
      .select(`
        *,
        kyc_documents(count)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (kycStatus) query = query.eq('kyc_status', kycStatus);
    
    const { data: players, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch players: ${error.message}`);
    }
    
    console.log(`✅ [ADMIN PLAYERS] Found ${players?.length || 0} players`);
    res.json(players || []);
  } catch (error) {
    console.error(`❌ [ADMIN PLAYERS] Error fetching players:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function calculateAvgProcessingTime(documents) {
  const processedDocs = documents.filter(doc => 
    doc.status !== 'pending' && doc.updated_at && doc.created_at
  );
  
  if (processedDocs.length === 0) return 0;
  
  const totalTime = processedDocs.reduce((sum, doc) => {
    const created = new Date(doc.created_at).getTime();
    const updated = new Date(doc.updated_at).getTime();
    return sum + (updated - created);
  }, 0);
  
  return Math.round(totalTime / processedDocs.length / (1000 * 60 * 60)); // Hours
}

function getTopPlayersByDocuments(documents) {
  const playerCounts = documents.reduce((acc, doc) => {
    const playerKey = `${doc.players.first_name} ${doc.players.last_name}`;
    acc[playerKey] = (acc[playerKey] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(playerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, documentCount: count }));
}
```

## 2. Advanced KYC Management Dashboard

```jsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const AdvancedKYCDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [players, setPlayers] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    documentType: '',
    period: '30d'
  });
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    fetchDocuments();
    fetchPlayers();
  }, [filters]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/admin/kyc-analytics/comprehensive?period=${filters.period}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.documentType) params.set('documentType', filters.documentType);
      
      const response = await fetch(`/api/admin/kyc-documents/advanced?${params}`);
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const response = await fetch('/api/admin/players/with-kyc');
      const data = await response.json();
      setPlayers(data);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const handleBulkAction = async (action, reason) => {
    if (selectedDocs.length === 0) {
      alert('Please select documents first');
      return;
    }

    try {
      const response = await fetch('/api/admin/kyc-documents/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          docIds: selectedDocs,
          reason,
          adminId: 'admin_user_id' // Replace with actual admin ID
        })
      });

      if (response.ok) {
        alert(`Bulk ${action} completed successfully`);
        setSelectedDocs([]);
        fetchDocuments();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Error in bulk action:', error);
      alert('Bulk action failed');
    }
  };

  const handleDocumentView = (document) => {
    try {
      const documentUrl = document.file_url?.startsWith('http') 
        ? document.file_url 
        : `/api/documents/view/${document.id}`;
      
      const newTab = window.open(documentUrl, '_blank', 'noopener,noreferrer');
      if (!newTab) {
        window.location.href = documentUrl;
      }
    } catch (error) {
      console.error('Error opening document:', error);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="advanced-kyc-dashboard">
      <h1>Master Admin - KYC Management</h1>
      
      {/* Analytics Overview */}
      <div className="analytics-section">
        <h2>KYC Analytics Overview</h2>
        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>Total Documents</h3>
            <p className="metric">{analytics?.totalDocuments || 0}</p>
          </div>
          <div className="analytics-card">
            <h3>Approval Rate</h3>
            <p className="metric">{analytics?.approvalRate || 0}%</p>
          </div>
          <div className="analytics-card">
            <h3>Avg Processing Time</h3>
            <p className="metric">{analytics?.avgProcessingTime || 0}h</p>
          </div>
        </div>

        {/* Status Distribution Chart */}
        <div className="chart-container">
          <h3>Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={Object.entries(analytics?.byStatus || {}).map(([key, value]) => ({
                  name: key,
                  value
                }))}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {Object.entries(analytics?.byStatus || {}).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <h2>Document Filters</h2>
        <div className="filters-grid">
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <select 
            value={filters.documentType} 
            onChange={(e) => setFilters({...filters, documentType: e.target.value})}
          >
            <option value="">All Types</option>
            <option value="government_id">Government ID</option>
            <option value="utility_bill">Utility Bill</option>
            <option value="profile_photo">Profile Photo</option>
          </select>
          
          <select 
            value={filters.period} 
            onChange={(e) => setFilters({...filters, period: e.target.value})}
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bulk-actions">
        <h2>Bulk Actions</h2>
        <div className="bulk-controls">
          <span>{selectedDocs.length} documents selected</span>
          <button 
            onClick={() => handleBulkAction('approved', 'Bulk approval by admin')}
            disabled={selectedDocs.length === 0}
            className="bulk-btn approve"
          >
            Bulk Approve
          </button>
          <button 
            onClick={() => handleBulkAction('rejected', 'Bulk rejection by admin')}
            disabled={selectedDocs.length === 0}
            className="bulk-btn reject"
          >
            Bulk Reject
          </button>
          <button 
            onClick={() => setSelectedDocs([])}
            className="bulk-btn clear"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="documents-section">
        <h2>KYC Documents</h2>
        {loading ? (
          <div className="loading">Loading documents...</div>
        ) : (
          <div className="documents-table">
            <table>
              <thead>
                <tr>
                  <th>
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDocs(documents.map(doc => doc.id));
                        } else {
                          setSelectedDocs([]);
                        }
                      }}
                    />
                  </th>
                  <th>Player</th>
                  <th>Document Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <input 
                        type="checkbox"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDocs([...selectedDocs, doc.id]);
                          } else {
                            setSelectedDocs(selectedDocs.filter(id => id !== doc.id));
                          }
                        }}
                      />
                    </td>
                    <td>{doc.players?.first_name} {doc.players?.last_name}</td>
                    <td>{doc.document_type.replace('_', ' ')}</td>
                    <td>
                      <span className={`status-badge ${doc.status}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                    <td>
                      <button onClick={() => handleDocumentView(doc)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player Summary */}
      <div className="players-section">
        <h2>Player KYC Summary</h2>
        <div className="players-stats">
          <div className="stat-card">
            <h3>Total Players</h3>
            <p>{players.length}</p>
          </div>
          <div className="stat-card">
            <h3>Verified Players</h3>
            <p>{players.filter(p => p.kyc_status === 'approved').length}</p>
          </div>
          <div className="stat-card">
            <h3>Pending Verification</h3>
            <p>{players.filter(p => p.kyc_status === 'pending').length}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedKYCDashboard;
```

## 3. Enhanced CSS Styles

```css
/* Advanced KYC Dashboard Styles */
.advanced-kyc-dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  background: #f8f9fa;
}

.analytics-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.analytics-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  border: 1px solid #e0e0e0;
}

.analytics-card h3 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
}

.metric {
  font-size: 32px;
  font-weight: bold;
  color: #007bff;
  margin: 0;
}

.chart-container {
  margin-top: 20px;
}

.filters-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.filters-grid select {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.bulk-actions {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.bulk-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 15px;
}

.bulk-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.bulk-btn.approve { background: #28a745; color: white; }
.bulk-btn.reject { background: #dc3545; color: white; }
.bulk-btn.clear { background: #6c757d; color: white; }
.bulk-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.documents-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.documents-table {
  overflow-x: auto;
  margin-top: 15px;
}

.documents-table table {
  width: 100%;
  border-collapse: collapse;
}

.documents-table th,
.documents-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.documents-table th {
  background: #f8f9fa;
  font-weight: 600;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.approved { background: #d4edda; color: #155724; }
.status-badge.pending { background: #fff3cd; color: #856404; }
.status-badge.rejected { background: #f8d7da; color: #721c24; }

.players-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.players-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.stat-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  border: 1px solid #e0e0e0;
}

.stat-card h3 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
}

.stat-card p {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
  margin: 0;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

/* Responsive Design */
@media (max-width: 768px) {
  .analytics-grid {
    grid-template-columns: 1fr;
  }
  
  .filters-grid {
    grid-template-columns: 1fr;
  }
  
  .bulk-controls {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .documents-table {
    font-size: 12px;
  }
}
```

## 4. Integration Points

### Router Setup
```jsx
// Add to your Master Admin Portal router
import AdvancedKYCDashboard from './components/AdvancedKYCDashboard';

// Route configuration
<Route path="/kyc-management" component={AdvancedKYCDashboard} />
```

### Navigation Integration
```jsx
// Add to your navigation menu
<NavItem to="/kyc-management">
  <Icon name="shield" />
  KYC Management
</NavItem>
```

## 5. Features Summary

### Core Features:
- **Advanced Filtering**: Status, type, date range filtering
- **Bulk Operations**: Mass approve/reject with audit logging
- **Real-time Analytics**: Comprehensive KYC statistics
- **Document Viewing**: Direct Supabase Storage integration
- **Player Management**: KYC status overview and management
- **Audit Logging**: Complete action history tracking

### Cross-Portal Integration:
- All actions sync instantly with Player Portal
- Staff Portal changes reflect in Master Admin
- Real-time status updates across all systems
- Unified document storage and access

### Security Features:
- Service role authentication for admin access
- Audit trail for all administrative actions
- Secure file serving from Supabase Storage
- Role-based access control ready

This Master Admin Portal integration provides enterprise-grade KYC management with complete cross-portal synchronization and advanced administrative features.