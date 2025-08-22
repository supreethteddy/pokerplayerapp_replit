-- Food & Beverage Sample Data for Testing
-- Insert sample menu items

INSERT INTO food_beverage_items (name, description, price, category, image_url, is_available, display_order) VALUES 
('Club Sandwich', 'Triple-layered sandwich with chicken, bacon, lettuce, and tomato', '15.99', 'food', 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=300&h=200&fit=crop', true, 1),
('Caesar Salad', 'Fresh romaine lettuce with parmesan cheese and croutons', '12.50', 'food', 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=300&h=200&fit=crop', true, 2),
('Margherita Pizza', 'Classic pizza with tomato sauce, mozzarella, and fresh basil', '18.99', 'food', 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=300&h=200&fit=crop', true, 3),
('Chicken Wings', 'Spicy buffalo wings served with ranch dipping sauce', '14.99', 'food', 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=300&h=200&fit=crop', true, 4),
('Fish & Chips', 'Beer-battered fish with crispy fries and tartar sauce', '16.99', 'food', 'https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?w=300&h=200&fit=crop', true, 5),
('Coffee', 'Freshly brewed premium coffee', '4.50', 'beverage', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&h=200&fit=crop', true, 6),
('Cappuccino', 'Rich espresso with steamed milk and foam', '5.99', 'beverage', 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=300&h=200&fit=crop', true, 7),
('Fresh Orange Juice', 'Freshly squeezed orange juice', '6.50', 'beverage', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=300&h=200&fit=crop', true, 8),
('Coca Cola', 'Classic refreshing cola drink', '3.50', 'beverage', 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=300&h=200&fit=crop', true, 9),
('Beer', 'Cold draft beer', '7.99', 'beverage', 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=300&h=200&fit=crop', true, 10),
('Nachos', 'Crispy tortilla chips with cheese, jalapeños, and salsa', '11.99', 'food', 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=300&h=200&fit=crop', true, 11),
('Ice Cream Sundae', 'Vanilla ice cream with chocolate sauce and whipped cream', '8.99', 'food', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=300&h=200&fit=crop', true, 12);

-- Insert sample ads/offers
INSERT INTO ads_offers (title, description, image_url, ad_type, target_url, is_active, display_order) VALUES 
('Happy Hour Special', 'Buy 2 drinks, get 1 free! Available weekdays 4-6 PM', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop', 'promotion', null, true, 1),
('Weekend Brunch', 'Special weekend brunch menu with 20% off all breakfast items', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=250&fit=crop', 'promotion', null, true, 2),
('New Menu Items', 'Try our latest gourmet burgers and craft cocktails!', 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=250&fit=crop', 'promotion', null, true, 3),
('Group Dining Discount', 'Tables of 6+ get 15% off food orders', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=250&fit=crop', 'promotion', null, true, 4);

-- Verify data was inserted
SELECT 'Food Items:' as info, count(*) as count FROM food_beverage_items
UNION ALL
SELECT 'Ads/Offers:' as info, count(*) as count FROM ads_offers;