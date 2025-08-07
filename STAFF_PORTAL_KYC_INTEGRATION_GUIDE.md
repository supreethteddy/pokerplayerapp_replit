# Staff Portal KYC Integration Guide

## Overview
This document outlines the complete KYC (Know Your Customer) integration between the Player Portal and Staff Portal, including Clerk authentication, Supabase database integration, and document management workflows.

## 🏗️ System Architecture

### Authentication System
- **Primary**: Supabase Auth for unified player authentication
- **Secondary**: Clerk integration with hybrid support
- **Unified ID**: All players have both `supabase_user_id` and `clerk_user_id` for cross-platform compatibility

### Database Schema (Supabase)

#### Core Tables

##### `players` Table
```sql
- id (UUID) - Primary key
- clerk_user_id (TEXT) - Clerk user identifier
- supabase_user_id (UUID) - Supabase auth.users foreign key
- email (TEXT) - Player email
- first_name (TEXT) - Player first name
- last_name (TEXT) - Player last name
- phone (TEXT) - Player phone number
- pan_card (TEXT) - PAN card number
- kyc_status (TEXT) - 'pending', 'submitted', 'approved', 'rejected'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

##### `kyc_documents` Table
```sql
- id (UUID) - Primary key
- player_id (UUID) - Foreign key to players.id
- document_type (TEXT) - 'government_id', 'utility_bill', 'pan_card'
- file_name (TEXT) - Original filename
- file_url (TEXT) - Document storage URL
- file_size (INTEGER) - File size in bytes
- mime_type (TEXT) - File MIME type
- status (TEXT) - 'pending', 'approved', 'rejected'
- uploaded_at (TIMESTAMP)
- reviewed_at (TIMESTAMP)
- reviewed_by (UUID) - Staff member who reviewed
```

## 🚀 Player Portal KYC Workflow

### Step 1: Personal Details
**Endpoint**: `PUT /api/players/:id`
```json
{
  "firstName": "string",
  "lastName": "string", 
  "phone": "string"
}
```

### Step 2: Document Upload
**Endpoint**: `POST /api/documents/upload`
```json
{
  "playerId": "uuid",
  "documentType": "government_id|utility_bill|pan_card",
  "fileName": "string",
  "fileData": "base64_string",
  "fileSize": "number",
  "mimeType": "string"
}
```

**Required Documents:**
1. **Government ID** - Aadhaar Card, PAN Card, or Passport
2. **Address Proof** - Utility Bill, Bank Statement, or Rental Agreement  
3. **PAN Card** - PAN number input + PAN card document upload

### Step 3: KYC Submission
**Endpoint**: `POST /api/kyc/submit`
```json
{
  "playerId": "uuid",
  "email": "string",
  "firstName": "string", 
  "lastName": "string",
  "panCardNumber": "string"
}
```

**Actions Performed:**
- Updates player KYC status to 'submitted'
- Triggers email notification to player
- Sends notification to staff portal for review

### Step 4: Approval Confirmation
- Player sees "Awaiting Approval" status
- Staff portal receives notification for review

## 📊 Staff Portal Integration Endpoints

### Get All Pending KYC Reviews
```
GET /api/admin/kyc/pending
```
**Response:**
```json
[
  {
    "playerId": "uuid",
    "playerName": "string",
    "email": "string", 
    "phone": "string",
    "panCard": "string",
    "submittedAt": "timestamp",
    "documents": [
      {
        "type": "government_id",
        "fileUrl": "string",
        "fileName": "string",
        "uploadedAt": "timestamp"
      }
    ]
  }
]
```

### Get Player KYC Details
```
GET /api/admin/kyc/player/:playerId
```
**Response:**
```json
{
  "player": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string", 
    "panCard": "string",
    "kycStatus": "string"
  },
  "documents": [
    {
      "id": "uuid",
      "documentType": "string",
      "fileName": "string",
      "fileUrl": "string",
      "status": "string",
      "uploadedAt": "timestamp"
    }
  ]
}
```

### View Document
```
GET /api/documents/view/:documentId
```
**Response:** Binary file content with appropriate headers

### Approve/Reject KYC
```
POST /api/admin/kyc/review
```
**Request:**
```json
{
  "playerId": "uuid",
  "action": "approve|reject",
  "reviewerId": "uuid",
  "comments": "string"
}
```

**Actions Performed:**
- Updates player KYC status
- Updates individual document statuses
- Sends email notification to player
- Logs review activity

## 🔧 Clerk Integration

### Authentication Endpoints
```
POST /api/auth/clerk/signin
POST /api/auth/clerk/signup  
POST /api/auth/clerk/signout
```

### Webhook Integration
```
POST /api/webhooks/clerk
```
**Handles:**
- User creation/update from Clerk
- Automatic player record creation
- Cross-platform ID mapping

## 📧 Email Notification System

### Supabase Email Integration
**Templates:**
1. **Welcome Email** - After successful signup
2. **KYC Submission** - After document submission
3. **KYC Approval** - After staff approval
4. **KYC Rejection** - If documents rejected

**Endpoint**: `POST /api/auth/kyc-submission-email`

## 🛡️ Security & Access Control

### Staff Portal Access Levels
1. **Staff** - View KYC documents, basic approval
2. **Admin** - Full KYC management, player management
3. **Super Admin** - System configuration, audit logs

### Document Security
- All documents stored in Supabase Storage
- Access controlled via RLS (Row Level Security)
- File URLs are signed and expire after access
- Staff access logged for audit trail

## 🔍 Integration Checklist for Staff Portal

### Required Features
- [ ] KYC Dashboard showing pending reviews
- [ ] Document viewer for uploaded files
- [ ] Approval/rejection workflow
- [ ] Player search and filtering
- [ ] Email notification triggers
- [ ] Audit log viewing
- [ ] Bulk approval operations

### Database Queries for Staff Portal

#### Get Pending KYC Count
```sql
SELECT COUNT(*) FROM players WHERE kyc_status = 'submitted';
```

#### Get Documents for Review
```sql
SELECT p.*, d.* 
FROM players p
LEFT JOIN kyc_documents d ON p.id = d.player_id
WHERE p.kyc_status = 'submitted'
ORDER BY d.uploaded_at DESC;
```

#### Approve Player KYC
```sql
UPDATE players 
SET kyc_status = 'approved', updated_at = NOW()
WHERE id = $1;

UPDATE kyc_documents 
SET status = 'approved', reviewed_at = NOW(), reviewed_by = $2
WHERE player_id = $1;
```

## 🚨 Error Handling

### Common Issues
1. **Missing Documents** - Validate all 3 documents uploaded
2. **Invalid File Types** - Only allow images and PDFs
3. **Large File Sizes** - Implement size limits (10MB per file)
4. **Supabase Connection** - Proper error handling for database failures

### Monitoring
- Document upload success rates
- KYC approval times
- Staff portal response times
- Email delivery status

## 📈 Analytics & Reporting

### KYC Metrics for Staff Portal
- Total submissions per day/week/month
- Average approval time
- Rejection reasons
- Document type success rates
- Staff member performance metrics

### Player Portal Metrics
- Signup to KYC completion rate
- Document upload success rate
- Step abandonment analysis

---

## 🔗 API Endpoint Summary

| Endpoint | Method | Purpose | Access Level |
|----------|--------|---------|--------------|
| `/api/players/:id` | PUT | Update player details | Player |
| `/api/documents/upload` | POST | Upload KYC documents | Player |
| `/api/kyc/submit` | POST | Submit KYC for review | Player |
| `/api/admin/kyc/pending` | GET | Get pending reviews | Staff+ |
| `/api/admin/kyc/player/:id` | GET | Get player KYC details | Staff+ |
| `/api/documents/view/:id` | GET | View document | Staff+ |
| `/api/admin/kyc/review` | POST | Approve/reject KYC | Admin+ |
| `/api/auth/kyc-submission-email` | POST | Send notification emails | System |

This integration ensures seamless KYC workflow between Player Portal and Staff Portal with complete audit trail and security controls.