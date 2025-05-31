// src/components/AllPlansPage/AllPlansPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext'; // For user and profile context
import CreatePlanForm from './CreatePlanForm';
import './AllPlansPage.css';
import '../PlanPage/PlanPage.css'; // For modal styles

const DEFAULT_SERVICE_ITEMS = [
  {
    type: 'Generic', title: 'Welcome', duration: '5 min', details: 'Opening remarks, welcome to visitors.',
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Generic', title: 'Announcements', duration: '5 min', details: 'Specific church announcements.',
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Divider', title: 'Worship',
    duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Divider', title: '---', // Empty visual divider
    duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Generic', title: 'Message', duration: '30 min', details: 'Sermon or teaching segment.',
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Divider', title: 'Response',
    duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Divider', title: '---', // Empty visual divider
    duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Generic', title: 'Community Builder', duration: '10 min', details: 'Closing remarks & fellowship.',
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Generic', title: 'Dismissal', duration: '0 min', details: 'Go in Peace. Serve the Lord.',
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  }
];

const AllPlansPage = () => {
  const { user, profile, loading: authIsLoading } = useAuth();
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true); // Page-specific loading
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchPlans = useCallback(async () => {
    if (!user || !user.id || !profile) { // Profile object itself is needed for role
      console.log('[AllPlansPage] fetchPlans: Aborting. User or profile is missing.');
      setPlans([]);
      setPlansLoading(false);
      if (user && !profile && !authIsLoading) { // User loaded, auth done, but profile is missing
          setError("User profile data not fully loaded. Cannot determine plans to display.");
      }
      return;
    }

    console.log(`[AllPlansPage] fetchPlans: Started for User: ${user.id}, Role: ${profile.role}`);
    setPlansLoading(true);
    setError(null);

    try {
      let eventIdsToFetch = [];
      let fetchedPlansData = [];

      if (profile.role === 'ORGANIZER') {
        if (!profile.organization_id) {
          setError("Your organizer profile is not associated with an organization. Cannot load plans.");
          setPlans([]);
          setPlansLoading(false);
          return;
        }
        console.log('[AllPlansPage] fetchPlans (Organizer): Querying events for organization:', profile.organization_id);
        const { data, error: fetchError } = await supabase
          .from('events')
          .select('id, title, date, theme')
          .eq('organization_id', profile.organization_id)
          .order('date', { ascending: false });
        if (fetchError) throw fetchError;
        fetchedPlansData = data || [];

      } else if (profile.role === 'MUSICIAN') {
        console.log('[AllPlansPage] fetchPlans (Musician): Querying event_assignments for user:', user.id);
        const { data: assignments, error: assignmentsError } = await supabase
          .from('event_assignments')
          .select('event_id')
          .eq('user_id', user.id)
          .in('status', ['PENDING', 'ACCEPTED']); // Only show plans they are pending or accepted for

        if (assignmentsError) throw assignmentsError;

        if (assignments && assignments.length > 0) {
          eventIdsToFetch = assignments.map(a => a.event_id);
          console.log('[AllPlansPage] fetchPlans (Musician): Found event_ids:', eventIdsToFetch);
          const { data, error: eventsError } = await supabase
            .from('events')
            .select('id, title, date, theme')
            .in('id', eventIdsToFetch) // Fetch events whose IDs are in the list
            .order('date', { ascending: false });
          if (eventsError) throw eventsError;
          fetchedPlansData = data || [];
        } else {
          console.log('[AllPlansPage] fetchPlans (Musician): No relevant assignments found.');
          fetchedPlansData = []; // Musician has no plans they are actively part of
        }
      } else {
        // Unknown role or role not set yet
        console.warn("[AllPlansPage] fetchPlans: User has an unknown or no role. No plans will be fetched.");
        setError("Your user role is not set up correctly to view plans.");
        fetchedPlansData = [];
      }

      console.log('[AllPlansPage] fetchPlans: Supabase response processed. Plans count:', fetchedPlansData.length);
      setPlans(fetchedPlansData);

    } catch (err) {
      console.error("[AllPlansPage] fetchPlans: CATCH block. Error:", err.message);
      setError(err.message || "Failed to fetch plans.");
      setPlans([]);
    } finally {
      setPlansLoading(false);
      console.log('[AllPlansPage] fetchPlans: FINALLY block. plansLoading false.');
    }
  // This callback now depends on user.id and profile (for role and organization_id)
  // It will be recreated if user or profile object instances change.
  }, [user, profile]);

  useEffect(() => {
    console.log(
      '[AllPlansPage] useEffect triggered. AuthLoading:', authIsLoading,
      'User ID:', user?.id,
      'Profile Role:', profile?.role,
      'Profile Org ID:', profile?.organization_id
    );

    if (!authIsLoading && user && profile) { // Wait for auth AND profile to be loaded
      // Role specific logic for fetching or error message
      if (profile.role === 'ORGANIZER' && !profile.organization_id) {
        console.log('[AllPlansPage] useEffect: Organizer profile missing organization_id.');
        setError("Your organizer profile is not linked to an organization.");
        setPlans([]);
        setPlansLoading(false);
      } else if (profile.role === 'MUSICIAN' || (profile.role === 'ORGANIZER' && profile.organization_id)) {
        // Musicians can always try to fetch (they might have no assignments)
        // Organizers must have an org ID.
        console.log('[AllPlansPage] useEffect: Conditions met for role. Calling fetchPlans.');
        fetchPlans();
      } else if (!profile.role){
          console.log('[AllPlansPage] useEffect: User profile loaded, but no role assigned.');
          setError("Your user profile is incomplete (no role assigned). Cannot load plans.");
          setPlans([]);
          setPlansLoading(false);
      }
    } else if (!authIsLoading && !user) {
      console.log('[AllPlansPage] useEffect: No user after auth loaded. Clearing plans.');
      setPlans([]);
      setPlansLoading(false);
      setError(null);
    } else if (authIsLoading) {
      console.log('[AllPlansPage] useEffect: AuthContext is still loading.');
      setPlansLoading(true);
    }
  // This effect now depends on user, profile, authIsLoading, and the fetchPlans function itself.
  }, [user, profile, authIsLoading, fetchPlans]);

  const toggleCreateModal = () => setIsCreateModalOpen(!isCreateModalOpen);

  const handleCreatePlan = async (newPlanData) => {
    if (!newPlanData.title || !newPlanData.date) {
        alert("Title and Date are required."); throw new Error("Title and Date are required.");
    }
    if (!user || !profile?.organization_id) { // Need org ID from profile to create a plan
        alert("User or organization information is missing. Cannot create plan.");
        throw new Error("User or organization information missing.");
    }
    let newEventId = null;
    try {
      const planToInsert = {
        ...newPlanData,
        checklist_status: {},
        organization_id: profile.organization_id, // Assign to current user's org
      };
      const { data: newEvent, error: insertError } = await supabase.from('events').insert([planToInsert]).select('id').single();
      if (insertError) throw insertError;
      newEventId = newEvent.id;

      const serviceItemsToInsert = DEFAULT_SERVICE_ITEMS.map((item, index) => ({ ...item, event_id: newEventId, sequence_number: index }));
      if (serviceItemsToInsert.length > 0) {
        const { error: itemsInsertError } = await supabase.from('service_items').insert(serviceItemsToInsert);
        if (itemsInsertError) console.error('Error inserting default service items:', itemsInsertError.message);
      }
      setIsCreateModalOpen(false);
      fetchPlans(); 
      if (newEventId) navigate(`/plan/${newEventId}`);
    } catch (err) {
      console.error('Error in handleCreatePlan:', err);
      alert(`An error occurred: ${err.message}`);
      throw err; 
    }
  };

  if (authIsLoading) {
    return <p className="page-status">Initializing authentication...</p>;
  }
  if (plansLoading) {
    return <p className="page-status">Loading plans...</p>;
  }
  if (error) {
    return <p className="page-status error">{error}</p>;
  }

  return (
    <div className="all-plans-container">
      <div className="all-plans-header">
        <h1>All Event Plans</h1>
        {/* Only Organizers can create new plans */}
        {profile?.role === 'ORGANIZER' && (
          <button 
            onClick={toggleCreateModal} 
            className="create-new-plan-btn"
            disabled={!profile?.organization_id || !user}
          >
            + Create New Plan
          </button>
        )}
        {!profile?.organization_id && user && profile?.role === 'ORGANIZER' && !authIsLoading &&
            <p style={{color: 'orange', fontSize: '0.9em', marginTop: '10px'}}>
                Your organizer profile isn't linked to an organization. Please complete your setup.
            </p>
        }
      </div>

      {plans.length === 0 ? (
        <p>
          {profile?.role === 'MUSICIAN' ? "You have not been invited to any plans yet, or your pending invitations are for events that are not current." :
           profile?.role === 'ORGANIZER' && profile.organization_id ? "No plans found for your organization. Click \"Create New Plan\" to get started!" :
           "No plans to display."
          }
        </p>
      ) : (
        <ul className="plans-list">
          {plans.map(plan => (
            <li key={plan.id} className="plan-item-card">
              <div className="plan-card-content">
                <Link to={`/plan/${plan.id}`} className="plan-link">
                  <h2>{plan.title || 'Untitled Plan'}</h2>
                  <p className="plan-date">Date: {plan.date ? new Date(plan.date + 'T00:00:00').toLocaleDateString() : 'Not set'}</p>
                  {plan.theme && <p className="plan-theme">Theme: {plan.theme}</p>}
                </Link>
              </div>
              {/* Removed delete button from here */}
            </li>
          ))}
        </ul>
      )}

      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={toggleCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleCreateModal}>&times;</button>
            <CreatePlanForm onCreatePlan={handleCreatePlan} onCancel={toggleCreateModal} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AllPlansPage;