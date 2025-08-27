
-- Create function to sync auth.users to players table
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if player already exists
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE email = NEW.email) THEN
    -- Create new player record
    INSERT INTO public.players (
      email,
      first_name,
      last_name,
      phone,
      password,
      supabase_id,
      kyc_status,
      balance,
      is_active,
      email_verified,
      credit_approved,
      credit_limit,
      current_credit,
      total_deposits,
      total_withdrawals,
      total_winnings,
      total_losses,
      games_played,
      hours_played,
      universal_id,
      created_at
    ) VALUES (
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', ''),
      'supabase_managed',
      NEW.id,
      'pending',
      '0.00',
      true,
      CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
      false,
      '0.00',
      '0.00',
      '0.00',
      '0.00',
      '0.00',
      '0.00',
      0,
      '0.00',
      'unified_' || extract(epoch from now()) || '_' || substring(NEW.id from 1 for 8),
      NOW()
    );
  ELSE
    -- Update existing player with Supabase ID
    UPDATE public.players 
    SET 
      supabase_id = NEW.id,
      email_verified = CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN true ELSE false END,
      updated_at = NOW()
    WHERE email = NEW.email AND supabase_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Also handle email confirmations
CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Update email verification status when confirmed
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.players 
    SET 
      email_verified = true,
      updated_at = NOW()
    WHERE supabase_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auth user updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();
