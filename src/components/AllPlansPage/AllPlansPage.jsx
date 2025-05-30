// src/components/AllPlansPage/AllPlansPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import CreatePlanForm from './CreatePlanForm';
import './AllPlansPage.css';
import '../PlanPage/PlanPage.css'; // For modal styles, consider moving to shared CSS

const DEFAULT_SERVICE_ITEMS = [
  {
    type: 'Generic', // User-facing "Service Item"
    title: 'Welcome',
    duration: '5 min',
    details: 'Opening remarks, welcome to visitors, and general announcements.',
    // Nullify fields not applicable to 'Generic'
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_person_id: null, musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Generic',
    title: 'Announcements',
    duration: '5 min',
    details: 'Specific church announcements and upcoming events.',
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_person_id: null, musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Divider',
    title: 'Worship', // This is the text that will appear on the divider
    // Nullify fields not applicable to 'Divider'
    duration: null, details: null,
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_person_id: null, musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Divider',
    title: '---', // Represents an "empty" visual divider line
    duration: null, details: null,
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_person_id: null, musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Generic',
    title: 'Message',
    duration: '30 min',
    details: 'Sermon or teaching segment.',
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_person_id: null, musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Divider',
    title: 'Response', // Named divider
    duration: null, details: null,
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_person_id: null, musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Divider',
    title: '---', // Another empty visual divider
    duration: null, details: null,
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_person_id: null, musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  },
  {
    type: 'Generic',
    title: 'Community Builder',
    duration: '10 min',
    details: 'Closing remarks, prayer, and fellowship opportunities.',
    artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_person_id: null, musical_key: null,
    bible_book: null, bible_chapter: null, bible_verse_range: null,
  }
];


const AllPlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchPlans = useCallback(async () => {
    // ... (fetchPlans logic remains the same) ...
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('id, title, date, theme')
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;
      setPlans(data || []);
    } catch (err) {
      console.error("Error fetching plans:", err);
      setError(err.message || "Failed to fetch plans.");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const toggleCreateModal = () => {
    setIsCreateModalOpen(!isCreateModalOpen);
  };

  const handleCreatePlan = async (newPlanData) => {
    if (!newPlanData.title || !newPlanData.date) {
        alert("Title and Date are required.");
        throw new Error("Title and Date are required.");
    }

    let newEventId = null; // To store the ID of the newly created event

    try {
      const planToInsert = {
        ...newPlanData,
        checklist_status: {}, // Default empty checklist
      };

      // 1. Create the new event
      const { data: newEvent, error: insertEventError } = await supabase
        .from('events')
        .insert([planToInsert])
        .select('id') // Select the ID of the newly created plan
        .single(); // Expecting a single record back

      if (insertEventError) throw insertEventError;
      if (!newEvent || !newEvent.id) throw new Error("Failed to retrieve new event ID.");

      newEventId = newEvent.id;
      console.log('New plan (event) created with ID:', newEventId);

      // 2. Prepare and insert default service items
      const serviceItemsToInsert = DEFAULT_SERVICE_ITEMS.map((item, index) => ({
        ...item,
        event_id: newEventId,
        sequence_number: index // Assign sequence based on order in default list
      }));

      if (serviceItemsToInsert.length > 0) {
        const { error: itemsInsertError } = await supabase
          .from('service_items')
          .insert(serviceItemsToInsert);

        if (itemsInsertError) {
          // Log the error, alert the user. The event was created, but default items failed.
          // This is a partial success. User can add items manually or you could implement rollback.
          console.error('Error inserting default service items:', itemsInsertError);
          alert(`Plan created (ID: ${newEventId}), but failed to add default service items. Please add them manually. Error: ${itemsInsertError.message}`);
        } else {
          console.log('Default service items added successfully for event ID:', newEventId);
        }
      }

      // 3. Close modal, refresh list, and navigate
      setIsCreateModalOpen(false);
      fetchPlans(); // Refresh the list of plans to show the new one

      if (newEventId) {
        navigate(`/plan/${newEventId}`);
      }

    } catch (err) {
      console.error('Error in handleCreatePlan:', err);
      // Let the form's catch handle alerting the user for specific form errors,
      // or alert for more general errors here.
      alert(`An error occurred: ${err.message}`);
      throw err; // Re-throw so the form's isSubmitting state can be reset
    }
  };


  // ... (rest of the component: loading/error checks, JSX for displaying plans and modal) ...
  if (loading && plans.length === 0) return <p className="page-status">Loading plans...</p>;
  if (error) return <p className="page-status error">Error: {error}</p>;

  return (
    <div className="all-plans-container">
      <div className="all-plans-header">
        <h1>All Event Plans</h1>
        <button onClick={toggleCreateModal} className="create-new-plan-btn">
          + Create New Plan
        </button>
      </div>

      {plans.length === 0 && !loading ? (
        <p>No plans found. Click "Create New Plan" to get started!</p>
      ) : (
        <ul className="plans-list">
          {plans.map(plan => (
            <li key={plan.id} className="plan-item-card">
              <Link to={`/plan/${plan.id}`}>
                <h2>{plan.title || 'Untitled Plan'}</h2>
                <p className="plan-date">Date: {plan.date ? new Date(plan.date + 'T00:00:00').toLocaleDateString() : 'Not set'}</p>
                {plan.theme && <p className="plan-theme">Theme: {plan.theme}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Modal for Creating a New Plan */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={toggleCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleCreateModal}>
              &times;
            </button>
            <CreatePlanForm
              onCreatePlan={handleCreatePlan}
              onCancel={toggleCreateModal}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AllPlansPage;