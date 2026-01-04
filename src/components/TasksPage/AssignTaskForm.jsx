// src/components/TasksPage/AssignTaskForm.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const AssignTaskForm = ({ task, organizationMusicians, upcomingOrgEvents, onAssignTask, onCancel, isSubmitting }) => {
  const [selectedMusicianIds, setSelectedMusicianIds] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  
  // Load existing assignments
  useEffect(() => {
    const fetchExistingAssignments = async () => {
      if (!task?.id) return;
      setIsLoadingExisting(true);
      try {
        const { data, error } = await supabase
          .from('task_assignments')
          .select('assigned_to_user_id')
          .eq('task_id', task.id);
          
        if (error) throw error;
        
        if (data) {
          const existingIds = data.map(a => a.assigned_to_user_id);
          setSelectedMusicianIds(existingIds);
        }
      } catch (err) {
        console.error("Error loading existing assignments:", err);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    fetchExistingAssignments();
  }, [task]);

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    onAssignTask(selectedMusicianIds, selectedPlanId || null);
  };

  const handleMusicianToggle = (id) => {
    setSelectedMusicianIds(prev => prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]);
  };

  const loadFromPlan = async (planId) => {
      setSelectedPlanId(planId);
      if(!planId) return;
      
      try {
        const { data } = await supabase
            .from('event_assignments')
            .select('user_id')
            .eq('event_id', planId)
            .in('status', ['ACCEPTED','PENDING']);
            
        if(data) {
            const newIds = data.map(d => d.user_id);
            setSelectedMusicianIds(prev => [...new Set([...prev, ...newIds])]);
        }
      } catch(e) { console.error(e); }
  };

  return (
    <form onSubmit={handleAssignSubmit} className="glass-form">
      <h3>Assign Task {task.title}</h3>
      
      {isLoadingExisting && <p style={{color:'#64748b'}}>Loading current assignments...</p>}

      {task.type === 'REHEARSAL_POLL' && (
          <div className="form-group">
            <label>Assign to Plan</label>
            <select value={selectedPlanId} onChange={(e) => loadFromPlan(e.target.value)} disabled={isSubmitting || isLoadingExisting}>
                <option value="">Select</option>
                {upcomingOrgEvents.map(evt => (
                    <option key={evt.id} value={evt.id}>{new Date(evt.date).toLocaleDateString()} - {evt.title}</option>
                ))}
            </select>
            <p style={{fontSize:'0.85rem', color:'#64748b', marginTop:'5px'}}>Selecting a plan will select its assigned musicians.</p>
          </div>
      )}

      <div className="form-group">
          <label>Select Musicians</label>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
             <button type="button" onClick={() => setSelectedMusicianIds(organizationMusicians.map(m=>m.id))} style={{fontSize:'0.8rem', background:'none', border:'none', color:'#3b82f6', cursor:'pointer'}}>Select All</button>
             <button type="button" onClick={() => setSelectedMusicianIds([])} style={{fontSize:'0.8rem', background:'none', border:'none', color:'#64748b', cursor:'pointer'}}>Deselect All</button>
          </div>
          
          <div style={{maxHeight:'200px', overflowY:'auto', border:'1px solid #e2e8f0', padding:'10px', borderRadius:'10px', background:'#f8fafc'}}>
              {organizationMusicians.map(musician => (
                  <label key={musician.id} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', cursor:'pointer', padding:'4px 0'}}>
                      <input 
                        type="checkbox" 
                        checked={selectedMusicianIds.includes(musician.id)} 
                        onChange={() => handleMusicianToggle(musician.id)} 
                        disabled={isSubmitting || isLoadingExisting} 
                      />
                      <span style={{color:'#334155'}}>{musician.first_name} {musician.last_name}</span>
                  </label>
              ))}
          </div>
          <p style={{fontSize:'0.85rem', color:'#64748b', marginTop:'5px', textAlign:'right'}}>{selectedMusicianIds.length} Selected</p>
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" className="submit-btn" disabled={isSubmitting || isLoadingExisting}>{isSubmitting ? 'Saving...' : 'Update Assignments'}</button>
      </div>
    </form>
  );
};

export default AssignTaskForm;