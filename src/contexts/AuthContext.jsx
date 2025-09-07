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
        // Only update state if the user has actually changed
        if (currentUser?.id !== user?.id) {
          setUser(currentUser);
          if (currentUser) {
            await fetchUserProfile(currentUser);
          } else {
            setProfile(null);
          }
        }
        setAuthLoading(false);
      }
    );

    // This handles the session refresh when returning to the tab.
    // It will trigger the onAuthStateChange listener above if needed.
    const handleFocus = () => {
      supabase.auth.getSession();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]); // Add user to dependency array to get its latest value in the closure.
  
  const refreshProfile = async () => {
    if (user) {
      return await fetchUserProfile(user);
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
        <div style={{
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