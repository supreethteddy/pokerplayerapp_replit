-- VIP Shop System Tables for Cross-Portal Integration
-- Execute this script in your Supabase SQL editor

-- VIP Shop Categories Table
CREATE TABLE IF NOT EXISTS vip_shop_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- VIP Shop Items Table
CREATE TABLE IF NOT EXISTS vip_shop_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES vip_shop_categories(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    long_description TEXT,
    point_cost INTEGER NOT NULL CHECK (point_cost > 0),
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    stock_quantity INTEGER,
    display_order INTEGER DEFAULT 0,
    terms_conditions TEXT,
    redemption_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- VIP Shop Item Images Table (for multiple images per item)
CREATE TABLE IF NOT EXISTS vip_shop_item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES vip_shop_items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(200),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIP Shop Redemptions Table
CREATE TABLE IF NOT EXISTS vip_shop_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id INTEGER NOT NULL, -- References players table
    item_id UUID REFERENCES vip_shop_items(id),
    points_spent INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    redemption_code VARCHAR(50) UNIQUE,
    delivery_address TEXT,
    delivery_phone VARCHAR(20),
    special_instructions TEXT,
    admin_notes TEXT,
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIP Shop Settings Table
CREATE TABLE IF NOT EXISTS vip_shop_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- VIP Shop Banners Table
CREATE TABLE IF NOT EXISTS vip_shop_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200),
    subtitle VARCHAR(300),
    image_url TEXT,
    link_url TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vip_shop_items_category ON vip_shop_items(category_id);
CREATE INDEX IF NOT EXISTS idx_vip_shop_items_available ON vip_shop_items(is_available, display_order);
CREATE INDEX IF NOT EXISTS idx_vip_shop_redemptions_player ON vip_shop_redemptions(player_id);
CREATE INDEX IF NOT EXISTS idx_vip_shop_redemptions_status ON vip_shop_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_vip_shop_item_images_item ON vip_shop_item_images(item_id, display_order);

-- Insert default categories
INSERT INTO vip_shop_categories (name, description, display_order, is_active) VALUES
('Tournament Tickets', 'Entry tickets for special tournaments and events', 1, true),
('Merchandise', 'Branded items and physical goods', 2, true),
('Bonuses & Credits', 'Gaming bonuses and account credits', 3, true),
('Exclusive Access', 'VIP experiences and exclusive access', 4, true)
ON CONFLICT DO NOTHING;

-- Insert default settings
INSERT INTO vip_shop_settings (setting_key, setting_value, description) VALUES
('shop_enabled', 'true', 'Enable/disable the entire VIP shop'),
('points_conversion_rate', '1', 'Points to currency conversion rate'),
('min_redemption_points', '100', 'Minimum points required for any redemption'),
('shop_welcome_message', 'Welcome to the VIP Shop! Redeem your loyalty points for exclusive rewards.', 'Welcome message displayed on shop homepage'),
('support_email', 'vip@pokerroom.com', 'Support email for VIP shop inquiries'),
('delivery_timeframe', '7-14 business days', 'Standard delivery timeframe message')
ON CONFLICT DO NOTHING;

-- Insert sample VIP shop items
INSERT INTO vip_shop_items (category_id, name, description, long_description, point_cost, is_available, stock_quantity, terms_conditions, redemption_instructions) VALUES
(
    (SELECT id FROM vip_shop_categories WHERE name = 'Tournament Tickets' LIMIT 1),
    'Weekly Tournament Entry',
    'Entry ticket for weekly high-stakes tournament',
    'Gain access to our exclusive weekly tournament with guaranteed prize pools. This tournament features a special format with increased blinds and premium rewards for top finishers.',
    500,
    true,
    100,
    'Valid for 30 days from redemption. Non-transferable. Tournament rules apply.',
    'Your tournament entry will be automatically added to your account within 24 hours.'
),
(
    (SELECT id FROM vip_shop_categories WHERE name = 'Merchandise' LIMIT 1),
    'Premium Poker Chip Set',
    'Professional 500-piece poker chip set with custom case',
    'High-quality clay composite chips in a premium leather case. Includes 500 chips in 5 denominations, 2 decks of cards, and dealer button. Perfect for home games.',
    2000,
    true,
    25,
    'Physical item ships within 7-14 business days. Shipping included.',
    'Provide your complete shipping address during checkout. Items ship via standard courier.'
),
(
    (SELECT id FROM vip_shop_categories WHERE name = 'Bonuses & Credits' LIMIT 1),
    'Account Bonus Credit',
    '₹1,000 bonus credit added to your gaming account',
    'Instant bonus credit that can be used for buy-ins and tournament entries. This bonus comes with standard wagering requirements and must be used within 90 days.',
    1000,
    true,
    null,
    'Subject to standard bonus terms. 5x wagering requirement. Valid for 90 days.',
    'Bonus will be credited to your account immediately upon redemption.'
)
ON CONFLICT DO NOTHING;

-- Create triggers to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vip_shop_categories_updated_at BEFORE UPDATE ON vip_shop_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vip_shop_items_updated_at BEFORE UPDATE ON vip_shop_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vip_shop_redemptions_updated_at BEFORE UPDATE ON vip_shop_redemptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vip_shop_settings_updated_at BEFORE UPDATE ON vip_shop_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vip_shop_banners_updated_at BEFORE UPDATE ON vip_shop_banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE vip_shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_shop_item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_shop_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_shop_banners ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access to active items
CREATE POLICY "Public can view active categories" ON vip_shop_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view available items" ON vip_shop_items FOR SELECT USING (is_available = true);
CREATE POLICY "Public can view item images" ON vip_shop_item_images FOR SELECT USING (true);
CREATE POLICY "Public can view active banners" ON vip_shop_banners FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view shop settings" ON vip_shop_settings FOR SELECT USING (true);

-- Players can view their own redemptions
CREATE POLICY "Players can view own redemptions" ON vip_shop_redemptions FOR SELECT USING (true);
CREATE POLICY "Players can insert redemptions" ON vip_shop_redemptions FOR INSERT WITH CHECK (true);

-- Admin policies (will be refined based on admin role system)
CREATE POLICY "Admins can manage categories" ON vip_shop_categories FOR ALL USING (true);
CREATE POLICY "Admins can manage items" ON vip_shop_items FOR ALL USING (true);
CREATE POLICY "Admins can manage item images" ON vip_shop_item_images FOR ALL USING (true);
CREATE POLICY "Admins can manage redemptions" ON vip_shop_redemptions FOR ALL USING (true);
CREATE POLICY "Admins can manage settings" ON vip_shop_settings FOR ALL USING (true);
CREATE POLICY "Admins can manage banners" ON vip_shop_banners FOR ALL USING (true);