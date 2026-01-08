-- Enable Supabase Realtime for offers tables
-- Run this in your Supabase SQL Editor to enable real-time updates for offers

-- Enable real-time subscriptions for offers tables
ALTER PUBLICATION supabase_realtime ADD TABLE staff_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE offer_banners;
ALTER PUBLICATION supabase_realtime ADD TABLE ads_offers;

-- Verify the tables are enabled (optional check)
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('staff_offers', 'offer_banners', 'ads_offers');









