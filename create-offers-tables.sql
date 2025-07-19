-- Staff Portal Offers Tables Creation Script
-- Execute this script manually in the Staff Portal Supabase SQL Editor

-- Create staff_offers table
CREATE TABLE IF NOT EXISTS staff_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  video_url TEXT,
  offer_type VARCHAR(50) CHECK (offer_type IN ('banner', 'carousel', 'popup')),
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create carousel_items table
CREATE TABLE IF NOT EXISTS carousel_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES staff_offers(id) ON DELETE CASCADE,
  position INTEGER,
  image_url TEXT,
  video_url TEXT,
  click_action TEXT,
  action_data TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_views table for analytics
CREATE TABLE IF NOT EXISTS offer_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES staff_offers(id) ON DELETE CASCADE,
  player_id INTEGER,
  view_type VARCHAR(50) DEFAULT 'carousel',
  ip_address INET,
  user_agent TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample offers for testing
INSERT INTO staff_offers (title, description, image_url, offer_type, is_active) VALUES
(
  'Welcome Bonus',
  'Get 100% bonus on your first deposit up to ₹5,000. Join today and double your gaming power with our exclusive welcome package.',
  'http://localhost:5000/api/placeholder-welcome-bonus.jpg',
  'banner',
  true
),
(
  'Weekend Special', 
  'Double loyalty points on all weekend games. Play Friday to Sunday and earn twice the rewards for all your poker sessions.',
  'http://localhost:5000/api/placeholder-weekend-special.jpg',
  'carousel',
  true
),
(
  'Free Tournament Entry',
  'Complimentary entry to our Sunday ₹10,000 guaranteed tournament. No entry fee required for qualified players.',
  'http://localhost:5000/api/placeholder-tournament.jpg',
  'popup',
  true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_offers_active ON staff_offers(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_offers_type ON staff_offers(offer_type);
CREATE INDEX IF NOT EXISTS idx_carousel_items_active ON carousel_items(is_active);
CREATE INDEX IF NOT EXISTS idx_offer_views_offer_id ON offer_views(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_views_viewed_at ON offer_views(viewed_at);

-- Verify tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('staff_offers', 'carousel_items', 'offer_views');