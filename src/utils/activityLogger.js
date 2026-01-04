import { supabase } from '../supabaseClient';

export const logActivity = async (user, profile, actionType, description) => {
  if (!user || !profile || !profile.organization_id) return;

  try {
    // SPECIAL LOGIC: "Song Spam" Prevention
    // If the action is SONG_ADDED, check if this user already added a song TODAY.
    if (actionType === 'SONG_ADDED') {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingLogs } = await supabase
        .from('activity_logs')
        .select('id, description')
        .eq('organization_id', profile.organization_id)
        .eq('actor_user_id', user.id)
        .eq('action_type', 'SONG_ADDED')
        .gte('created_at', today) // Created today
        .limit(1);

      if (existingLogs && existingLogs.length > 0) {
        // A log exists for today! Let's update it instead of inserting a new one.
        const logId = existingLogs[0].id;
        // Change text to generic "added multiple songs"
        await supabase
          .from('activity_logs')
          .update({ 
            description: `${profile.first_name} added multiple songs to the library.` 
          })
          .eq('id', logId);
        return; // Stop here, don't insert a new one
      }
    }

    // Standard Insert for everything else (or first song of the day)
    await supabase.from('activity_logs').insert({
      organization_id: profile.organization_id,
      actor_user_id: user.id,
      actor_name: `${profile.first_name} ${profile.last_name}`,
      action_type: actionType,
      description: description
    });

  } catch (error) {
    // Fail silently - we don't want to crash the app just because a log failed
    console.error("Activity Log Error:", error);
  }
};