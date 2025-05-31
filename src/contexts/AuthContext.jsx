// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient'; // Make sure this path is correct

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const fetchUserProfile = async (currentAuthUser) => {
    if (!currentAuthUser) {
      setProfile(null);
      return null;
    }
    try {
      // console.log("[AuthContext] Fetching profile for ID:", currentAuthUser.id);
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentAuthUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('[AuthContext] Error fetching profile:', profileError.message);
        setProfile(null);
        return null;
      }
      setProfile(userProfile || null);
      // console.log("[AuthContext] Profile state updated to:", userProfile || null);
      return userProfile || null;
    } catch (err) {
      console.error("[AuthContext] Exception during profile fetch:", err);
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    setAuthLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        await fetchUserProfile(currentUser); // Fetch profile after user is set
        setAuthLoading(false); // Set loading false after user and initial profile attempt
        // console.log("[AuthContext] onAuthStateChange: Core auth state & profile attempt done. authLoading set to false.");
      }
    );
    return () => { subscription?.unsubscribe(); };
  }, []);
  
  const refreshProfile = async () => {
    if (user) {
      // console.log("[AuthContext] refreshProfile called for user:", user.id);
      return await fetchUserProfile(user); // Re-fetch and update profile state
    }
    return null;
  };

  const value = {
    user,
    profile,
    loading: authLoading,
    login: async (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signup: async (email, password) => supabase.auth.signUp({ email, password }),
    logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('[AuthContext] Logout Error:', error.message);
        return { error };
    },
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {authLoading ? (
        <div style={{ /* Simple loading spinner or message styles */
            display: 'flex', justifyContent: 'center', alignItems: 'center', 
            height: '100vh', fontSize: '1.2em', fontFamily: 'sans-serif' 
        }}>
          Loading Application...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};