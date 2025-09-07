// src/components/SettingsPage/SettingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import './SettingsPage.css'; // Ensure this CSS file is created and styled accordingly
import { INSTRUMENT_OPTIONS  } from '../../constants';

// --- Join Organization Form (for org-less users) ---
const JoinOrgForm = ({ onJoin, onCancel, isSubmitting }) => {
  const [orgCode, setOrgCode] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onJoin(orgCode); }} className="settings-form" style={{marginTop: '20px'}}>
      <h4>Join an Organization</h4>
      <p>Enter the Organization ID/Code. Your email must be pre-approved by an organizer of that organization.</p>
      {/* Error/Success messages will be handled by orgActionStatus in the parent */}
      <div className="form-group">
        <label htmlFor="join-org-code-settings">Organization Code/ID:</label>
        <input type="text" id="join-org-code-settings" value={orgCode} onChange={(e) => setOrgCode(e.target.value)} required disabled={isSubmitting} />
      </div>
      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting || !orgCode.trim()}>
          {isSubmitting ? 'Attempting to Join...' : 'Join Organization'}
        </button>
        {onCancel && <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>Cancel</button>}
      </div>
    </form>
  );
};


const SettingsPage = () => {
  const { user, profile, loading: authIsLoading, refreshProfile, login } = useAuth();
  const [activeTab, setActiveTab] = useState('user');

  // User Settings State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [userSettingsMessage, setUserSettingsMessage] = useState('');
  const [userSettingsError, setUserSettingsError] = useState('');
  const [isUpdatingUserName, setIsUpdatingUserName] = useState(false);
  const [isUpdatingInstruments, setIsUpdatingInstruments] = useState(false);

  // New state for password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);


  // Organization Related State
  const [organization, setOrganization] = useState(null);
  const [orgName, setOrgName] = useState(''); // For editing current org's name
  const [orgChecklist, setOrgChecklist] = useState([]);
  const [newChecklistTask, setNewChecklistTask] = useState('');
  const [preApprovedEmails, setPreApprovedEmails] = useState([]);
  const [newPreApprovalEmail, setNewPreApprovalEmail] = useState('');
  const [newPreApprovalRole, setNewPreApprovalRole] = useState('MUSICIAN');
  const [currentOrgMembersList, setCurrentOrgMembersList] = useState([]);
  
  const [orgDetailsLoading, setOrgDetailsLoading] = useState(false); // For fetching initial org details
  const [orgActionStatus, setOrgActionStatus] = useState({ message: '', error: '', loading: false }); // For ALL org actions

  // Populate User form fields
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setSelectedInstruments(profile.role === 'MUSICIAN' && profile.organization_id ? (profile.instruments || []) : []);
    } else {
      setFirstName(''); setLastName(''); setSelectedInstruments([]);
    }
  }, [profile]);

  const fetchCurrentOrganizationDetails = useCallback(async () => {
    if (profile?.organization_id) {
      setOrgDetailsLoading(true);
      setOrgActionStatus({ message: '', error: '', loading: false }); // Reset action status
      try {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, default_checklist, created_by')
          .eq('id', profile.organization_id)
          .single();
        if (orgError) throw new Error(`Organization details: ${orgError.message}`);
        if (!orgData) { setOrganization(null); throw new Error("Your current organization's details could not be found."); }
        
        setOrganization(orgData); setOrgName(orgData.name || ''); setOrgChecklist(orgData.default_checklist || []);

        if (profile.role === 'ORGANIZER') {
          const { data: approvalsData, error: approvalsError } = await supabase.from('organization_pre_approvals').select('id, email, role_to_assign, created_at').eq('organization_id', profile.organization_id).order('created_at', { ascending: false });
          if (approvalsError) throw new Error(`Pre-approved emails: ${approvalsError.message}`);
          setPreApprovedEmails(approvalsData || []);

          const { data: membersData, error: membersFetchError } = await supabase.from('profiles').select('id, first_name, last_name, email, role').eq('organization_id', profile.organization_id);
          if (membersFetchError) throw new Error(`Organization members: ${membersFetchError.message}`);
          setCurrentOrgMembersList(membersData || []);
        }
      } catch (err) {
        console.error("Error fetching current organization details:", err);
        setOrgActionStatus(prev => ({ ...prev, error: err.message, loading: false })); // Update specific status
        setOrganization(null); setOrgName(''); setOrgChecklist([]); setPreApprovedEmails([]); setCurrentOrgMembersList([]);
      } finally {
        setOrgDetailsLoading(false);
      }
    } else {
      setOrganization(null); setOrgName(''); setOrgChecklist([]);
      setPreApprovedEmails([]); setCurrentOrgMembersList([]);
      setOrgDetailsLoading(false);
    }
  }, [profile?.organization_id, profile?.role]);

  useEffect(() => {
    if (activeTab === 'organization' && !authIsLoading && user) {
      fetchCurrentOrganizationDetails();
    }
  }, [activeTab, user, authIsLoading, fetchCurrentOrganizationDetails]);

  const handleInstrumentCheckboxChange = (instrument) => setSelectedInstruments(prev => prev.includes(instrument) ? prev.filter(i => i !== instrument) : [...prev, instrument]);

  const handleUpdateNameSubmit = async (e) => {
    e.preventDefault();
    setUserSettingsMessage(''); setUserSettingsError('');
    if (!firstName.trim() || !lastName.trim()) { setUserSettingsError("First and last names cannot be empty."); return; }
    setIsUpdatingUserName(true);
    try {
      const { error } = await supabase.from('profiles').update({ first_name: firstName.trim(), last_name: lastName.trim(), updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
      setUserSettingsMessage('Name updated successfully!'); await refreshProfile();
    } catch (err) { console.error("Error updating name:", err); setUserSettingsError(err.message || "Failed to update name."); }
    finally { setIsUpdatingUserName(false); }
  };
  
  const handleUpdatePasswordSubmit = async (e) => {
    e.preventDefault();
    setUserSettingsMessage('');
    setUserSettingsError('');

    if (!currentPassword) {
        setUserSettingsError('Please enter your current password.');
        return;
    }
    if (password.length < 6) {
      setUserSettingsError('New password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setUserSettingsError('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // 1. Verify current password by attempting to sign in.
      // This is a secure way to do it on the client-side.
      const { error: signInError } = await login(user.email, currentPassword);

      if (signInError) {
        throw new Error("Your current password is not correct.");
      }

      // 2. If verification is successful, update to the new password.
      const { error: updateError } = await supabase.auth.updateUser({ password: password });
      if (updateError) throw updateError;
      
      setUserSettingsMessage('Password updated successfully!');
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error("Error updating password:", err);
      setUserSettingsError(err.message || "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };


  const handleUpdateInstrumentsSubmit = async (e) => {
    e.preventDefault();
    setUserSettingsMessage(''); setUserSettingsError('');
    setIsUpdatingInstruments(true);
    try {
      const { error } = await supabase.from('profiles').update({ instruments: selectedInstruments, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
      setUserSettingsMessage('Instruments updated successfully!'); await refreshProfile();
    } catch (err) { console.error("Error updating instruments:", err); setUserSettingsError(err.message || "Failed to update instruments."); }
    finally { setIsUpdatingInstruments(false); }
  };

  const handleUpdateOrgNameSubmit = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) { setOrgActionStatus({loading: false, error:"Organization name cannot be empty.", message:''}); return; }
    if (!organization?.id) { setOrgActionStatus({loading: false, error:"Organization data not loaded.", message:''}); return; }
    setOrgActionStatus({loading:true, message:'', error:''});
    try {
      const { error } = await supabase.from('organizations').update({ name: orgName.trim() }).eq('id', organization.id);
      if (error) throw error;
      setOrganization(prev => prev ? {...prev, name: orgName.trim()} : null);
      setOrgActionStatus({loading:false, message:'Organization name updated!', error:''});
    } catch (err) { console.error("Error updating org name:", err); setOrgActionStatus({loading:false, message:'', error:err.message}); }
  };

  const handleAddChecklistTask = async () => {
    if (!newChecklistTask.trim() || !organization?.id) return;
    const updatedList = [...orgChecklist, newChecklistTask.trim()];
    setOrgActionStatus({loading:true, message:'', error:''});
    try {
      const { error } = await supabase.from('organizations').update({ default_checklist: updatedList }).eq('id', organization.id);
      if (error) throw error;
      setOrgChecklist(updatedList); setNewChecklistTask('');
      setOrgActionStatus({loading:false, message:'Checklist task added.', error:''});
    } catch (err) { console.error("Error adding checklist task:", err); setOrgActionStatus({loading:false, message:'', error:err.message}); }
  };

  const handleDeleteChecklistTask = async (taskIndex) => {
    if (!organization?.id) return;
    const updatedList = orgChecklist.filter((_, i) => i !== taskIndex);
    setOrgActionStatus({loading:true, message:'', error:''});
    try {
      const { error } = await supabase.from('organizations').update({ default_checklist: updatedList }).eq('id', organization.id);
      if (error) throw error;
      setOrgChecklist(updatedList);
      setOrgActionStatus({loading:false, message:'Checklist task removed.', error:''});
    } catch (err) { console.error("Error deleting checklist task:", err); setOrgActionStatus({loading:false, message:'', error:err.message}); }
  };

  const handleAddPreApprovedEmail = async (e) => {
    e.preventDefault();
    if (!newPreApprovalEmail.trim() || !newPreApprovalRole || !organization?.id || !user) { setOrgActionStatus(prev => ({...prev, error:"Email, role, or org info missing."})); return; }
    setOrgActionStatus(prev => ({...prev, loading:true, message:'', error:''}));
    try {
      await supabase.from('organization_pre_approvals').insert([{ organization_id: organization.id, email: newPreApprovalEmail.trim().toLowerCase(), role_to_assign: newPreApprovalRole, invited_by_user_id: user.id }]);
      setOrgActionStatus(prev => ({...prev, loading:false, message:`${newPreApprovalEmail.trim().toLowerCase()} pre-approved.`}));
      setNewPreApprovalEmail(''); fetchCurrentOrganizationDetails();
    } catch (err) {
      if (err.message.includes('unique constraint')) { setOrgActionStatus(prev => ({...prev, loading:false, error:`Email ${newPreApprovalEmail.trim().toLowerCase()} is already pre-approved.`}));
      } else { console.error("Error pre-approving email:", err); setOrgActionStatus(prev => ({...prev, loading:false, error:err.message})); }
    }
  };

  const handleRemovePreApprovedEmail = async (preApprovalId) => {
    if (!window.confirm("Remove this pre-approved email?")) return;
    setOrgActionStatus(prev => ({...prev, loading:true, message:'', error:''}));
    try {
      const { error } = await supabase.from('organization_pre_approvals').delete().eq('id', preApprovalId);
      if (error) throw error;
      setOrgActionStatus(prev => ({...prev, loading:false, message:"Pre-approval removed."}));
      fetchCurrentOrganizationDetails();
    } catch (err) { console.error("Error removing pre-approval:", err); setOrgActionStatus(prev => ({...prev, loading:false, error:err.message})); }
  };
  
  const unassignUserFromAllOrgItems = async (userIdToUnassign, orgId) => {
    if (!userIdToUnassign || !orgId) {
      console.warn("[SettingsPage] unassignUserFromAllOrgItems: Missing userId or orgId.");
      return;
    }
    console.log(`[SettingsPage] Cleaning up singer assignments for user ${userIdToUnassign} in org ${orgId}`);
    try {
      // 1. Get all event IDs for the organization
      const { data: eventIdsData, error: eventIdsError } = await supabase
        .from('events')
        .select('id')
        .eq('organization_id', orgId);

      if (eventIdsError) {
        console.error("Cleanup Error (fetch events):", eventIdsError.message);
        throw new Error(`Failed to fetch event IDs for cleanup: ${eventIdsError.message}`);
      }

      if (!eventIdsData || eventIdsData.length === 0) {
        console.log("[SettingsPage] No events found for this organization, no singer assignments to clean up.");
        return;
      }
      const eventIdsInOrg = eventIdsData.map(e => e.id);

      // 2. Fetch all 'Song' type service items from these events that have assigned singers
      console.log("[SettingsPage] Fetching all songs with assigned singers for events:", eventIdsInOrg);
      const { data: allSongsInEvents, error: songsFetchError } = await supabase
        .from('service_items')
        .select('id, assigned_singer_ids')
        .in('event_id', eventIdsInOrg)
        .eq('type', 'Song')
        .neq('assigned_singer_ids', null); // Only get songs where assigned_singer_ids is not null

      if (songsFetchError) {
        console.error("Error fetching songs for singer cleanup:", songsFetchError.message);
        return; 
      }

      const songUpdatePromises = [];

      if (allSongsInEvents && allSongsInEvents.length > 0) {
        allSongsInEvents.forEach(song => {
          if (song.assigned_singer_ids && Array.isArray(song.assigned_singer_ids) && song.assigned_singer_ids.includes(userIdToUnassign)) {
            const updatedSingerIds = song.assigned_singer_ids.filter(id => id !== userIdToUnassign);
            console.log(`[SettingsPage] Updating song ${song.id}, removing singer ${userIdToUnassign}. New singers:`, updatedSingerIds);
            songUpdatePromises.push(
              supabase
                .from('service_items')
                .update({ assigned_singer_ids: updatedSingerIds.length > 0 ? updatedSingerIds : null })
                .eq('id', song.id)
            );
          }
        });
      }

      if (songUpdatePromises.length > 0) {
        console.log(`[SettingsPage] Found ${songUpdatePromises.length} songs to update for singer cleanup.`);
        const results = await Promise.all(songUpdatePromises);
        results.forEach(result => {
          if (result.error) {
            console.error("Error updating a song to remove singer:", result.error.message, result);
          }
        });
        console.log(`[SettingsPage] Processed song updates for singer cleanup.`);
      } else {
        console.log(`[SettingsPage] No songs found specifically assigned to user ${userIdToUnassign} in this org's events after client-side check.`);
      }

    } catch (cleanupError) {
      console.error("Exception in unassignUserFromAllOrgItems:", cleanupError);
    }
  };

  const handleRemoveMemberFromOrgByOrganizer = async (memberProfileIdToRemove, memberName) => {
    if (!organization?.id || !organization.created_by || !user) { setOrgActionStatus(prev => ({...prev, error:"Org data missing."})); return; }
    if (memberProfileIdToRemove === organization.created_by) { alert("Organization creator cannot be removed."); return; }
    if (memberProfileIdToRemove === user.id) { alert("Use 'Leave Organization' to remove yourself."); return; }
    if (!window.confirm(`Remove ${memberName} from "${organization.name}"? Their organization affiliation and role will be cleared, and they'll be unassigned from all plans in this org.`)) return;
    
    setOrgActionStatus(prev => ({...prev, loading:true, message:'', error:''}));
    try {
      await unassignUserFromAllOrgItems(memberProfileIdToRemove, organization.id);
      const { error: profileUpdateError } = await supabase.from('profiles').update({ organization_id: null, role: null, updated_at: new Date().toISOString() }).eq('id', memberProfileIdToRemove).eq('organization_id', organization.id);
      if (profileUpdateError) throw profileUpdateError;
      setOrgActionStatus(prev => ({...prev, loading:false, message:`${memberName} removed from organization.`}));
      fetchCurrentOrganizationDetails();
    } catch (err) { console.error("Error removing member:", err); setOrgActionStatus(prev => ({...prev, loading:false, error:err.message})); }
  };

  const handleLeaveOrganization = async () => {
    if (!profile?.organization_id || !user?.id || !organization) { alert("Current organization details missing."); return; }
    if (user.id === organization.created_by) {
        const otherMembers = currentOrgMembersList.filter(m => m.id !== user.id);
        if (otherMembers.length > 0) { alert("As org creator with other members, you must transfer ownership or remove others first (feature not yet implemented)."); return; }
        else if (!window.confirm(`You are the creator and only member. Leaving will make the organization inaccessible. Are you sure you want to leave?`)) return;
    } else { if (!window.confirm(`Leave "${organization.name}"? You will be unassigned from its plans.`)) return; }
    
    setOrgActionStatus(prev => ({...prev, loading:true, message:'', error:''}));
    try {
      await unassignUserFromAllOrgItems(user.id, profile.organization_id);
      const { error: profileUpdateError } = await supabase.from('profiles').update({ organization_id: null, role: null, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (profileUpdateError) throw profileUpdateError;
      setOrgActionStatus({loading:false, message:"You have left the organization.", error:''});
      await refreshProfile();
    } catch (err) { console.error("Error leaving org:", err); setOrgActionStatus(prev => ({...prev, loading:false, error:err.message}));}
  };

  const handleJoinOrgSubmit = async (orgCodeToJoin) => {
    if (!orgCodeToJoin.trim()) { setOrgActionStatus(prev => ({...prev, error:"Org code required."})); return; }
    if (!user || !user.email) { setOrgActionStatus(prev => ({...prev, error:"User info missing."})); return; }
    setOrgActionStatus(prev => ({...prev, loading:true, message:'', error:''}));
    const userEmailToVerify = user.email.toLowerCase();
    try {
      const { data: targetOrg, error: findOrgError } = await supabase.from('organizations').select('id, name').or(`id.eq.${orgCodeToJoin.trim()},join_code.eq.${orgCodeToJoin.trim()}`).maybeSingle();
      if (findOrgError) throw new Error(`Error finding org: ${findOrgError.message}`);
      if (!targetOrg) throw new Error(`Organization with code "${orgCodeToJoin.trim()}" not found.`);

      const { data: preApproval, error: preApprovalError } = await supabase.from('organization_pre_approvals').select('id, role_to_assign').eq('organization_id', targetOrg.id).eq('email', userEmailToVerify).maybeSingle();
      if (preApprovalError) throw new Error(`Error checking pre-approval: ${preApprovalError.message}`);
      if (!preApproval) throw new Error(`Your email (${userEmailToVerify}) is not pre-approved for "${targetOrg.name}".`);

      const { error: profileUpdateError } = await supabase.from('profiles').update({ organization_id: targetOrg.id, role: preApproval.role_to_assign, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (profileUpdateError) throw new Error(`Error updating profile: ${profileUpdateError.message}`);
      
      await supabase.from('organization_pre_approvals').delete().eq('id', preApproval.id);
      setOrgActionStatus({loading:false, message:`Successfully joined "${targetOrg.name}" as ${preApproval.role_to_assign}!`, error:''});
      await refreshProfile();
    } catch (err) { console.error("Error joining org:", err); setOrgActionStatus(prev => ({...prev, loading:false, error:err.message})); }
  };

  // --- RENDER ---
  if (authIsLoading) return <p className="page-status">Loading user data...</p>;
  if (!user || !profile) return <p className="page-status">User data not available. Please log in again.</p>;

  const isOrgActionInProgress = orgActionStatus.loading;

  return (
    <div className="settings-page-container">
      <div className="settings-header"><h1>Settings</h1></div>
      <div className="settings-tabs">
        <button className={`tab-button ${activeTab === 'user' ? 'active' : ''}`} onClick={() => {setActiveTab('user'); setOrgActionStatus({message:'', error:'', loading:false}); }}>User Settings</button>
        <button className={`tab-button ${activeTab === 'organization' ? 'active' : ''}`} onClick={() => {setActiveTab('organization'); setOrgActionStatus({message:'', error:'', loading:false}); }}>Organization</button>
      </div>

      <div className="settings-content">
        {activeTab === 'user' && (
          <div className="settings-section user-settings-section">
            <h2>User Profile</h2>
            {(userSettingsError || userSettingsMessage) && (<p className={userSettingsError ? "form-error" : "form-success"}>{userSettingsError || userSettingsMessage}</p>)}
            <form onSubmit={handleUpdateNameSubmit} className="settings-form">
              <p><strong>Email:</strong> {user.email} <em style={{fontSize: '0.8em'}}>(cannot be changed here)</em></p>
              <p><strong>Current Role:</strong> {profile.role || 'N/A'}{profile.organization_id ? ` (in Org: ${profile.organization_id})` : ' (Not in an organization)'}</p>
              <div className="form-group"><label htmlFor="firstNameS">First Name:</label><input type="text" id="firstNameS" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={isUpdatingUserName} /></div>
              <div className="form-group"><label htmlFor="lastNameS">Last Name:</label><input type="text" id="lastNameS" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={isUpdatingUserName} /></div>
              <button type="submit" className="submit-btn" disabled={isUpdatingUserName}>{isUpdatingUserName ? 'Saving...' : 'Update Name'}</button>
            </form>

            <form onSubmit={handleUpdatePasswordSubmit} className="settings-form password-form">
                <h3>Change Password</h3>
                <div className="form-group">
                    <label htmlFor="current-password">Current Password:</label>
                    <input type="password" id="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required disabled={isUpdatingPassword} />
                </div>
                <div className="form-group">
                    <label htmlFor="new-password">New Password (min. 6 characters):</label>
                    <input type="password" id="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" disabled={isUpdatingPassword} />
                </div>
                <div className="form-group">
                    <label htmlFor="confirm-password">Confirm New Password:</label>
                    <input type="password" id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength="6" disabled={isUpdatingPassword} />
                </div>
                <button type="submit" className="submit-btn" disabled={isUpdatingPassword}>
                    {isUpdatingPassword ? 'Saving...' : 'Update Password'}
                </button>
            </form>

            {profile.role === 'MUSICIAN' && (
              <form onSubmit={handleUpdateInstrumentsSubmit} className="settings-form instrument-form">
                <h3>Your Instruments</h3><div className="form-group"><label>Select all instruments you play:</label><div className="checkbox-group settings-checkbox-group">{INSTRUMENT_OPTIONS.map(inst => (<label key={inst} className="checkbox-label"><input type="checkbox" value={inst} checked={selectedInstruments.includes(inst)} onChange={() => handleInstrumentCheckboxChange(inst)} disabled={isUpdatingInstruments}/>{inst}</label>))}</div></div>
                <button type="submit" className="submit-btn" disabled={isUpdatingInstruments}>{isUpdatingInstruments ? 'Saving...' : 'Update Instruments'}</button>
              </form>
            )}
          </div>
        )}

        {activeTab === 'organization' && (
          <div className="settings-section organization-settings-section">
            {orgActionStatus.error && <p className="form-error">{orgActionStatus.error}</p>}
            {orgActionStatus.message && <p className="form-success">{orgActionStatus.message}</p>}

            {!profile.organization_id && !orgDetailsLoading && !isOrgActionInProgress && (
              <JoinOrgForm 
                onJoin={handleJoinOrgSubmit} 
                isSubmitting={isOrgActionInProgress} 
              />
            )}

            {profile.organization_id && organization && !orgDetailsLoading && (
              <>
                <h2>Organization: {orgName} <span style={{fontSize: '0.7em', color: '#777'}}>({organization.id})</span></h2>
                <button onClick={handleLeaveOrganization} className="submit-btn leave-org-btn" disabled={isOrgActionInProgress} style={{backgroundColor: '#e74c3c', marginBottom:'20px', display:'block'}}>
                    {isOrgActionInProgress ? 'Processing...' : 'Leave This Organization'}
                </button>
                <hr style={{margin: "20px 0"}}/>

                {profile.role === 'ORGANIZER' && (
                  <>
                    <h3>Manage Organization Details</h3>
                    <form onSubmit={handleUpdateOrgNameSubmit} className="settings-form">
                      <div className="form-group"><label htmlFor="orgNameS">Organization Name:</label><input type="text" id="orgNameS" value={orgName} onChange={(e) => setOrgName(e.target.value)} required disabled={isOrgActionInProgress}/></div>
                      <button type="submit" className="submit-btn" disabled={isOrgActionInProgress}>{isOrgActionInProgress ? 'Saving...' : 'Update Name'}</button>
                    </form>

                    <div className="checklist-manager settings-form">
                        <h3>Default Pre-Service Checklist</h3>
                        {orgChecklist.length === 0 && !isOrgActionInProgress && <p>No default checklist tasks defined yet.</p>}
                        <ul className="checklist-display-list">
                        {orgChecklist.map((task, index) => (
                            <li key={index} className="checklist-display-item">
                            <span>{task}</span>
                            <button onClick={() => handleDeleteChecklistTask(index)} className="delete-task-btn" disabled={isOrgActionInProgress} title="Delete Task">&times;</button>
                            </li>
                        ))}
                        </ul>
                        <div className="add-task-form-group">
                        <input type="text" value={newChecklistTask} onChange={(e) => setNewChecklistTask(e.target.value)} placeholder="Enter new checklist task" disabled={isOrgActionInProgress}/>
                        <button type="button" onClick={handleAddChecklistTask} className="add-task-btn" disabled={isOrgActionInProgress || !newChecklistTask.trim()}>+ Add Task</button>
                        </div>
                    </div>
                    
                    <div className="pre-approval-manager settings-form">
                        <h3>Manage Pre-Approved Emails</h3>
                        <p>Add emails to allow users to join your organization ({organization.id}).</p>
                        <form onSubmit={handleAddPreApprovedEmail} className="add-preapproval-form">
                            <div className="form-group"><label htmlFor="preApprovalEmailS">Email to Pre-Approve:</label><input type="email" id="preApprovalEmailS" value={newPreApprovalEmail} onChange={(e) => setNewPreApprovalEmail(e.target.value)} placeholder="user@example.com" required disabled={isOrgActionInProgress}/></div>
                            <div className="form-group"><label htmlFor="preApprovalRoleS">Assign Role:</label><select id="preApprovalRoleS" value={newPreApprovalRole} onChange={(e) => setNewPreApprovalRole(e.target.value)} disabled={isOrgActionInProgress}><option value="MUSICIAN">Musician</option><option value="ORGANIZER">Organizer</option></select></div>
                            <button type="submit" className="submit-btn add-task-btn" disabled={isOrgActionInProgress || !newPreApprovalEmail.trim()}>{isOrgActionInProgress ? 'Adding...' : '+ Add Pre-Approval'}</button>
                        </form>
                        <h4>Currently Pre-Approved:</h4>
                        {preApprovedEmails.length === 0 && !orgDetailsLoading && <p>No emails pre-approved yet.</p>}
                        {orgDetailsLoading && <p>Loading pre-approved list...</p>}
                        {!orgDetailsLoading && preApprovedEmails.length > 0 && (
                          <ul className="preapproval-list checklist-display-list">
                            {preApprovedEmails.map(approval => (
                                <li key={approval.id} className="preapproval-item checklist-display-item">
                                <span><strong>{approval.email}</strong> as <em>{approval.role_to_assign}</em></span>
                                <button onClick={() => handleRemovePreApprovedEmail(approval.id)} className="delete-task-btn" disabled={isOrgActionInProgress} title="Remove Pre-approval">&times;</button>
                                </li>
                            ))}
                          </ul>
                        )}
                    </div>

                    <div className="org-members-manager settings-form">
                        <h3>Organization Members</h3>
                        {orgDetailsLoading && <p>Loading members...</p>}
                        {!orgDetailsLoading && currentOrgMembersList.length === 0 && <p>No other members found in this organization.</p>}
                        {!orgDetailsLoading && currentOrgMembersList.length > 0 && (
                        <ul className="org-members-list checklist-display-list">
                            {currentOrgMembersList.map(member => (
                            <li key={member.id} className="org-member-item checklist-display-item">
                                <div className="member-details">
                                <span className="member-name"><strong>{member.first_name} {member.last_name}</strong> ({member.email})</span>
                                <span className="member-role-org">Role: <em>{member.role}</em></span>
                                </div>
                                {member.id !== organization.created_by && member.id !== user.id && (
                                <button onClick={() => handleRemoveMemberFromOrgByOrganizer(member.id, `${member.first_name} ${member.last_name}`)} className="delete-task-btn remove-member-btn" disabled={isOrgActionInProgress} title="Remove Member from Organization">Remove</button>
                                )}
                                {member.id === organization.created_by && (<span className="creator-tag">(Creator)</span>)}
                                {member.id === user.id && (<span className="creator-tag">(You)</span>)}
                            </li>
                            ))}
                        </ul>
                        )}
                    </div>
                  </>
                )}
                {profile.role === 'MUSICIAN' && (
                    <p>You are a Musician in this organization. Use the button above if you wish to leave.</p>
                )}
              </>
            )}
            {profile.organization_id && !organization && (orgDetailsLoading || isOrgActionInProgress) && <p>Loading your organization details...</p>}
            {profile.organization_id && !organization && !orgDetailsLoading && !isOrgActionInProgress && !orgActionStatus.error && (<p className="form-error">Could not load details for your current organization: {profile.organization_id}</p>)}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;