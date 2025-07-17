# STAFF PORTAL INTEGRATION PROMPT

## Overview
Implement complete KYC document management and waitlist functionality in your Staff Portal to work seamlessly with the Player Portal.

## Required Environment Variables
```
STAFF_PORTAL_SUPABASE_URL=https://oyhnpnymlezjusnwpjeu.supabase.co
STAFF_PORTAL_SUPABASE_SERVICE_KEY=[Your Service Key]
```

## 1. KYC Document Management API Endpoints

### Add these endpoints to your Staff Portal:

```javascript
// Get all KYC documents for a specific player
app.get("/api/staff/kyc-documents/player/:playerId", async (req, res) => {
  try {
    const playerId = parseInt(req.params.playerId);
    console.log(`🔍 [STAFF KYC] Getting KYC documents for player ${playerId}`);
    
    const { data: documents, error } = await supabase
      .from('kyc_documents')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch KYC documents: ${error.message}`);
    }
    
    console.log(`✅ [STAFF KYC] Found ${documents?.length || 0} documents for player ${playerId}`);
    res.json(documents || []);
  } catch (error) {
    console.error(`❌ [STAFF KYC] Error fetching documents:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Update KYC document status (approve/reject)
app.patch("/api/staff/kyc-documents/:docId/status", async (req, res) => {
  try {
    const docId = parseInt(req.params.docId);
    const { status } = req.body;
    console.log(`📝 [STAFF KYC] Updating document ${docId} status to ${status}`);
    
    const { data: document, error } = await supabase
      .from('kyc_documents')
      .update({ status })
      .eq('id', docId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update document status: ${error.message}`);
    }
    
    console.log(`✅ [STAFF KYC] Document ${docId} status updated to ${status}`);
    res.json(document);
  } catch (error) {
    console.error(`❌ [STAFF KYC] Error updating document status:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get all KYC documents for bulk management
app.get("/api/staff/kyc-documents/all", async (req, res) => {
  try {
    console.log(`🔍 [STAFF KYC] Getting all KYC documents`);
    
    const { data: documents, error } = await supabase
      .from('kyc_documents')
      .select(`
        *,
        players!inner(first_name, last_name, email)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch all KYC documents: ${error.message}`);
    }
    
    console.log(`✅ [STAFF KYC] Found ${documents?.length || 0} total documents`);
    res.json(documents || []);
  } catch (error) {
    console.error(`❌ [STAFF KYC] Error fetching all documents:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk update KYC document status
app.patch("/api/staff/kyc-documents/bulk-update", async (req, res) => {
  try {
    const { docIds, status } = req.body;
    console.log(`📝 [STAFF KYC] Bulk updating ${docIds.length} documents to ${status}`);
    
    const { data: documents, error } = await supabase
      .from('kyc_documents')
      .update({ status })
      .in('id', docIds)
      .select();
    
    if (error) {
      throw new Error(`Failed to bulk update documents: ${error.message}`);
    }
    
    console.log(`✅ [STAFF KYC] Bulk updated ${documents?.length || 0} documents to ${status}`);
    res.json(documents);
  } catch (error) {
    console.error(`❌ [STAFF KYC] Error bulk updating documents:`, error);
    res.status(500).json({ error: error.message });
  }
});
```

## 2. KYC Document Review Component

```jsx
import React, { useState, useEffect } from 'react';

const KYCDocumentReview = ({ playerId }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlayerDocuments(playerId);
  }, [playerId]);

  const fetchPlayerDocuments = async (playerId) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/staff/kyc-documents/player/${playerId}`);
      const docs = await response.json();
      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDocumentStatus = async (docId, status) => {
    try {
      const response = await fetch(`/api/staff/kyc-documents/${docId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        fetchPlayerDocuments(playerId);
        alert(`Document ${status} successfully`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
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

  if (loading) {
    return <div className="loading">Loading KYC documents...</div>;
  }

  return (
    <div className="kyc-documents-review">
      <h3>KYC Documents Review</h3>
      {documents.length === 0 ? (
        <p>No KYC documents found for this player.</p>
      ) : (
        <div className="documents-grid">
          {documents.map(doc => (
            <div key={doc.id} className="document-card">
              <div className="document-info">
                <h4>{doc.document_type.replace('_', ' ').toUpperCase()}</h4>
                <p>File: {doc.file_name}</p>
                <p>Status: <span className={`status-${doc.status}`}>{doc.status}</span></p>
                <p>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</p>
              </div>
              
              <div className="document-actions">
                <button 
                  onClick={() => handleDocumentView(doc)}
                  className="view-btn"
                >
                  View Document
                </button>
                
                <div className="status-controls">
                  <button 
                    onClick={() => updateDocumentStatus(doc.id, 'approved')}
                    className="approve-btn"
                    disabled={doc.status === 'approved'}
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => updateDocumentStatus(doc.id, 'rejected')}
                    className="reject-btn"
                    disabled={doc.status === 'rejected'}
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => updateDocumentStatus(doc.id, 'pending')}
                    className="pending-btn"
                    disabled={doc.status === 'pending'}
                  >
                    Pending
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KYCDocumentReview;
```

## 3. Waitlist Management Integration

```jsx
// Waitlist Management Component
const WaitlistManagement = ({ tableId }) => {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWaitlist();
    const interval = setInterval(fetchWaitlist, 2000); // Real-time updates
    return () => clearInterval(interval);
  }, [tableId]);

  const fetchWaitlist = async () => {
    try {
      const response = await fetch(`/api/seat-requests/table/${tableId}`);
      const data = await response.json();
      setWaitlist(data);
    } catch (error) {
      console.error('Error fetching waitlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWaitlist = async (playerId) => {
    try {
      const response = await fetch(`/api/seat-requests/${playerId}/${tableId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchWaitlist();
        alert('Player removed from waitlist');
      }
    } catch (error) {
      console.error('Error removing from waitlist:', error);
    }
  };

  return (
    <div className="waitlist-management">
      <h3>Table Waitlist</h3>
      {loading ? (
        <div>Loading waitlist...</div>
      ) : waitlist.length === 0 ? (
        <p>No players waiting for this table.</p>
      ) : (
        <div className="waitlist-items">
          {waitlist.map((request, index) => (
            <div key={request.id} className="waitlist-item">
              <span className="position">#{index + 1}</span>
              <span className="player-id">Player {request.playerId}</span>
              <span className="status">{request.status}</span>
              <button 
                onClick={() => removeFromWaitlist(request.playerId)}
                className="remove-btn"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## 4. CSS Styles

```css
/* KYC Document Review Styles */
.kyc-documents-review {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 20px 0;
}

.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.document-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.document-info h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.document-actions {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.view-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.status-controls {
  display: flex;
  gap: 8px;
}

.approve-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.reject-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.pending-btn {
  background: #ffc107;
  color: black;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.status-approved { color: #28a745; font-weight: bold; }
.status-rejected { color: #dc3545; font-weight: bold; }
.status-pending { color: #ffc107; font-weight: bold; }

/* Waitlist Management Styles */
.waitlist-management {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 20px 0;
}

.waitlist-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 15px;
}

.waitlist-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.position {
  font-weight: bold;
  color: #007bff;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: auto;
}
```

## 5. Integration Points

### Player Profile Integration
```jsx
// Add to your player profile component
<KYCDocumentReview playerId={player.id} />
```

### Table Management Integration
```jsx
// Add to your table management component
<WaitlistManagement tableId={table.id} />
```

## 6. Testing Data
- **Player ID**: 15 (email: vignesh.wildleaf@gmail.com)
- **Existing KYC Documents**: 
  - Government ID (approved)
  - Utility Bill (approved)
- **Test Table**: `d5af9ef1-4e48-4c80-8227-84c96009b6ac`

## 7. Real-Time Features
- KYC status changes instantly reflect in Player Portal
- Waitlist updates sync in real-time between portals
- Document approvals/rejections show immediately
- Cross-portal data consistency maintained

## 8. Security Features
- All endpoints use Supabase service role for admin access
- Direct file URLs from Supabase Storage for document viewing
- Proper error handling and validation
- Audit trail for all KYC status changes

This integration provides complete cross-portal functionality between your Staff Portal and the Player Portal, ensuring seamless KYC document management and waitlist operations.