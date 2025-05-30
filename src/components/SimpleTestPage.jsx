// src/components/SimpleTestPage.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient'; // Ensure path is correct
import { useAuth } from '../contexts/AuthContext'; // Ensure path is correct

const SimpleTestPage = () => {
  const { user: userFromAuthContext } = useAuth(); // User from AuthContext
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('[SimpleTestPage] useEffect triggered. User from AuthContext:', userFromAuthContext?.email);

    const fetchData = async () => {
      if (!userFromAuthContext || !userFromAuthContext.id) {
        console.log('[SimpleTestPage] fetchData: No user or no user.id from AuthContext. Aborting.');
        setLoading(false);
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);
      console.log('[SimpleTestPage] fetchData: User ID from AuthContext:', userFromAuthContext.id);

      try {
        console.log('[SimpleTestPage] fetchData: Attempting supabase.auth.getSession() before data query...');
        const { data: sessionData, error: getSessionError } = await supabase.auth.getSession();

        if (getSessionError) {
          console.error('[SimpleTestPage] fetchData: Error from supabase.auth.getSession():', getSessionError);
          throw new Error(`Failed to get current session: ${getSessionError.message}`);
        }

        if (!sessionData.session || !sessionData.session.user) {
          console.warn('[SimpleTestPage] fetchData: supabase.auth.getSession() returned no session or user. Aborting.');
          setError("Not authenticated to fetch data (session invalid).");
          setData(null);
          setLoading(false);
          return;
        }
        console.log('[SimpleTestPage] fetchData: supabase.auth.getSession() successful. Current session user:', sessionData.session.user.email);
        
        // Now attempt the data query
        console.log('[SimpleTestPage] fetchData: Attempting to fetch a single event...');
        supabase
          .from('events')
          .select('id, title')
          .limit(1)
          .single()
          .then(({ data: eventData, error: fetchError }) => {
            console.log('[SimpleTestPage] fetchData: Events query .then() - Data:', eventData, 'Error:', fetchError);
            if (fetchError) {
              setError(fetchError.message);
              setData(null);
            } else {
              setData(eventData);
            }
          })
          .catch(err => {
            console.error('[SimpleTestPage] fetchData: Events query .catch():', err);
            setError(err.message);
            setData(null);
          })
          .finally(() => {
            console.log('[SimpleTestPage] fetchData: Events query .finally(). Setting loading false.');
            setLoading(false);
          });

      } catch (err) { // Catch errors from getSession or other synchronous parts
        console.error('[SimpleTestPage] fetchData: CATCH block in fetchData. Error:', err.message, err);
        setError(err.message);
        setData(null);
        setLoading(false);
      }
    };

    fetchData(); // Call the async function

  }, [userFromAuthContext]); // Re-run if userFromAuthContext changes

  console.log('[SimpleTestPage] Rendering. Loading:', loading, 'Error:', error, 'Data:', data);

  if (loading) return <p>SimpleTestPage: Loading data...</p>;
  if (error) return <p>SimpleTestPage: Error: {error}</p>;

  return (
    <div>
      <h1>Simple Test Page</h1>
      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : <p>No data fetched or found from events table.</p>}
    </div>
  );
};
export default SimpleTestPage;