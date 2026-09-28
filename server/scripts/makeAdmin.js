import { supabase } from '../lib/supabase.js';

async function makeAdmin(userId) {
  if (!userId) {
    console.error('Please provide a User ID (UUID).');
    console.log('Usage: node makeAdmin.js <userId>');
    process.exit(1);
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', userId)
      .select('id, display_name, email, is_admin');

    if (error) throw error;
    if (!data || data.length === 0) {
      console.warn(`No profile found with id: ${userId}. Ensure the user has signed in at least once.`);
      return;
    }
    console.log(`Successfully granted admin privileges in Supabase profiles to:`, data[0]);
  } catch (error) {
    console.error('Error granting admin privileges:', error.message);
  }
}

const userId = process.argv[2];
makeAdmin(userId);
