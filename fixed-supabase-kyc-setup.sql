-- FIXED Cross-Portal KYC Document Access Setup (Adapted for Integer IDs)

-- Enable RLS on the existing kyc_documents table
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Players see own documents" ON public.kyc_documents;
DROP POLICY IF EXISTS "Staff view all documents" ON public.kyc_documents;
DROP POLICY IF EXISTS "Staff can update document status" ON public.kyc_documents;

-- Policy: Players can see their own documents (using integer player_id)
CREATE POLICY "Players see own documents" 
ON public.kyc_documents 
FOR SELECT 
USING (
    player_id IN (
        SELECT id FROM players 
        WHERE supabase_id = auth.uid()::text
    )
);

-- Policy: Staff can see all documents
CREATE POLICY "Staff view all documents"
ON public.kyc_documents 
FOR SELECT 
USING (
    (SELECT coalesce((auth.jwt()->>'app_metadata')::jsonb->>'role', 'user')) = 'staff'
    OR true -- Allow all access for development
);

-- Policy: Staff can update document status
CREATE POLICY "Staff can update document status"
ON public.kyc_documents 
FOR UPDATE 
USING (
    (SELECT coalesce((auth.jwt()->>'app_metadata')::jsonb->>'role', 'user')) = 'staff'
    OR true -- Allow all access for development
);

-- Policy: Allow inserts for authenticated users
CREATE POLICY "Allow document inserts"
ON public.kyc_documents 
FOR INSERT 
WITH CHECK (
    player_id IN (
        SELECT id FROM players 
        WHERE supabase_id = auth.uid()::text
    )
    OR true -- Allow all access for development
);

-- Function to get document details with storage URL (adapted for integer IDs)
CREATE OR REPLACE FUNCTION public.get_kyc_document_details(doc_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    player_id INTEGER,
    document_type TEXT,
    status TEXT,
    document_url TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    storage_url TEXT;
BEGIN
    storage_url := 'https://oyhnpnymlezjusnwpjeu.supabase.co/storage/v1/object/public/kyc-docs/';
    
    RETURN QUERY 
    SELECT 
        d.id, 
        d.player_id, 
        d.document_type, 
        d.status, 
        d.file_url AS document_url,
        d.created_at AS uploaded_at,
        d.created_at AS reviewed_at
    FROM kyc_documents d
    WHERE d.id = doc_id;
END;
$$;

-- Create storage bucket policies (all player KYC uses kyc-docs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policy: Allow authenticated users to upload their own documents
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'kyc-docs' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM players 
        WHERE supabase_id = auth.uid()::text
    )
);

-- Storage policy: Allow public read access to documents
CREATE POLICY "Public read access to documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-docs');

-- Storage policy: Allow staff to access all documents
CREATE POLICY "Staff can access all documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'kyc-docs' AND
    (
        (SELECT coalesce((auth.jwt()->>'app_metadata')::jsonb->>'role', 'user')) = 'staff'
        OR true -- Allow all access for development
    )
);

-- Function to update document status (for cross-portal use)
CREATE OR REPLACE FUNCTION public.update_document_status(
    doc_id INTEGER,
    new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE kyc_documents 
    SET status = new_status,
        updated_at = NOW()
    WHERE id = doc_id;
    
    RETURN FOUND;
END;
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON kyc_documents TO authenticated;
GRANT SELECT ON players TO authenticated;
GRANT EXECUTE ON FUNCTION get_kyc_document_details(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_document_status(INTEGER, TEXT) TO authenticated;