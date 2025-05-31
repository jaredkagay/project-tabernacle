// src/components/SettingsPage/SettingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import './SettingsPage.css'; // Ensure this CSS file has all necessary styles

const INSTRUMENT_OPTIONS = ["Vocals", "Piano", "Acoustic", "Electric", "Bass", "Cajon", "Other"];

const SettingsPage = () => {
  const { user, profile, loading: authIsLoading, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('user');

  // User Settings State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [userSettingsMessage, setUserSettingsMessage] = useState('');
  const [userSettingsError, setUserSettingsError] = useState('');
  const [isUpdatingUserName, setIsUpdatingUserName] = useState(false);
  const [isUpdatingInstruments, setIsUpdatingInstruments] = useState(false);

  // Organization Settings State
  const [organization, setOrganization] = useState(null); // Full organization object {id, name, default_checklist, created_by}
  const [orgName, setOrgName] = useState('');
  const [orgChecklist, setOrgChecklist] = useState([]);
  const [newChecklistTask, setNewChecklistTask] = useState('');
  const [orgSettingsMessage, setOrgSettingsMessage] = useState('');
  const [orgSettingsError, setOrgSettingsError] = useState('');
  const [isUpdatingOrgName, setIsUpdatingOrgName] = useState(false);
  const [isUpdatingOrgChecklist, setIsUpdatingOrgChecklist] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false); // For fetching organization details

  // Pre-Approved Emails State
  const [preApprovedEmails, setPreApprovedEmails] = useState([]);
  const [newPreApprovalEmail, setNewPreApprovalEmail] = useState('');
  const [newPreApprovalRole, setNewPreApprovalRole] = useState('MUSICIAN');
  const [isManagingPreApprovals, setIsManagingPreApprovals] = useState(false);
  const [preApprovalMessage, setPreApprovalMessage] = useState('');
  const [preApprovalError, setPreApprovalError] = useState('');

  // Organization Members State
  const [currentOrgMembersList, setCurrentOrgMembersList] = useState([]);
  const [orgMembersLoading, setOrgMembersLoading] = useState(false);
  const [isManagingMembers, setIsManagingMembers] = useState(false); // Specific for member removal action


  // Populate User form fields when profile data is loaded/changed
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      if (profile.role === 'MUSICIAN') {
        setSelectedInstruments(profile.instruments || []);
      }
    } else {
      // Reset if profile becomes null (e.g., after removing self from org and profile refreshes)
      setFirstName('');
      setLastName('');
      setSelectedInstruments([]);
    }
  }, [profile]);

  const fetchOrganizationData = useCallback(async () => {
    if (profile?.role === 'ORGANIZER' && profile.organization_id) {
      setOrgLoading(true);
      setOrgMembersLoading(true); // Also set this when fetching all org data
      setOrgSettingsError('');
      setOrgSettingsMessage('');
      setPreApprovalError('');
      setPreApprovalMessage('');

      try {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, default_checklist, created_by')
          .eq('id', profile.organization_id)
          .single();

        if (orgError) throw new Error(`Organization details: ${orgError.message}`);
        if (orgData) {
          setOrganization(orgData);
          setOrgName(orgData.name || '');
          setOrgChecklist(orgData.default_checklist || []);
        } else {
          setOrgSettingsError("Your organization's details could not be found.");
          setOrganization(null); // Clear organization data
        }

        const { data: approvalsData, error: approvalsError } = await supabase
          .from('organization_pre_approvals')
          .select('id, email, role_to_assign, created_at')
          .eq('organization_id', profile.organization_id)
          .order('created_at', { ascending: false });
        if (approvalsError) throw new Error(`Pre-approved emails: ${approvalsError.message}`);
        setPreApprovedEmails(approvalsData || []);

        const { data: membersData, error: membersFetchError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role')
          .eq('organization_id', profile.organization_id);
        if (membersFetchError) throw new Error(`Organization members: ${membersFetchError.message}`);
        setCurrentOrgMembersList(membersData || []);

      } catch (err) {
        console.error("Error fetching organization data for settings:", err);
        setOrgSettingsError(err.message || "Failed to fetch organization data.");
        setOrganization(null); setOrgChecklist([]); setPreApprovedEmails([]); setCurrentOrgMembersList([]);
      } finally {
        setOrgLoading(false);
        setOrgMembersLoading(false);
      }
    } else {
      // Not an organizer or not in an org, clear org specific states
      setOrganization(null); setOrgName(''); setOrgChecklist([]);
      setPreApprovedEmails([]); setCurrentOrgMembersList([]);
      setOrgLoading(false); setOrgMembersLoading(false);
    }
  }, [profile?.organization_id, profile?.role]);

  useEffect(() => {
    if (activeTab === 'organization' && profile?.role === 'ORGANIZER') {
      fetchOrganizationData();
    }
  }, [activeTab, profile?.role, fetchOrganizationData]);


  // --- User Settings Handlers ---
  const handleInstrumentCheckboxChange = (instrument) => {
    setSelectedInstruments(prev =>
      prev.includes(instrument)
        ? prev.filter(item => item !== instrument)
        : [...prev, instrument]
    );
  };

  const handleUpdateNameSubmit = async (e) => {
    e.preventDefault();
    setUserSettingsMessage(''); setUserSettingsError('');
    if (!firstName.trim() || !lastName.trim()) {
      setUserSettingsError("First and last names cannot be empty."); return;
    }
    setIsUpdatingUserName(true);
    try {
      const { error } = await supabase.from('profiles').update({ 
        first_name: firstName.trim(), last_name: lastName.trim(), updated_at: new Date().toISOString() 
      }).eq('id', user.id);
      if (error) throw error;
      setUserSettingsMessage('Name updated successfully!');
      await refreshProfile();
    } catch (error) {
      console.error("Error updating name:", error);
      setUserSettingsError(error.message || "Failed to update name.");
    } finally {
      setIsUpdatingUserName(false);
    }
  };

  const handleUpdateInstrumentsSubmit = async (e) => {
    e.preventDefault();
    setUserSettingsMessage(''); setUserSettingsError('');
    setIsUpdatingInstruments(true);
    try {
      const { error } = await supabase.from('profiles').update({ 
        instruments: selectedInstruments, updated_at: new Date().toISOString() 
      }).eq('id', user.id);
      if (error) throw error;
      setUserSettingsMessage('Instruments updated successfully!');
      await refreshProfile();
    } catch (error) {
      console.error("Error updating instruments:", error);
      setUserSettingsError(error.message || "Failed to update instruments.");
    } finally {
      setIsUpdatingInstruments(false);
    }
  };

  // --- Organization Settings Handlers ---
  const handleUpdateOrgNameSubmit = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) { setOrgSettingsError("Organization name cannot be empty."); return; }
    if (!organization?.id) { setOrgSettingsError("Organization data not loaded."); return; }
    setIsUpdatingOrgName(true); setOrgSettingsMessage(''); setOrgSettingsError('');
    try {
      const { error } = await supabase.from('organizations').update({ name: orgName.trim() }).eq('id', organization.id);
      if (error) throw error;
      setOrgSettingsMessage('Organization name updated!');
      setOrganization(prev => prev ? {...prev, name: orgName.trim()} : null);
    } catch (error) { console.error("Error updating org name:", error); setOrgSettingsError(error.message); }
    finally { setIsUpdatingOrgName(false); }
  };

  const handleAddChecklistTask = async () => {
    if (!newChecklistTask.trim()) return;
    if (!organization?.id) { setOrgSettingsError("Organization data not loaded."); return; }
    const updatedChecklist = [...orgChecklist, newChecklistTask.trim()];
    setIsUpdatingOrgChecklist(true); setOrgSettingsMessage(''); setOrgSettingsError('');
    try {
      const { error } = await supabase.from('organizations').update({ default_checklist: updatedChecklist }).eq('id', organization.id);
      if (error) throw error;
      setOrgChecklist(updatedChecklist); setNewChecklistTask('');
      setOrgSettingsMessage('Checklist task added!');
    } catch (error) { console.error("Error adding checklist task:", error); setOrgSettingsError(error.message); }
    finally { setIsUpdatingOrgChecklist(false); }
  };

  const handleDeleteChecklistTask = async (taskIndex) => {
    if (!organization?.id) { setOrgSettingsError("Organization data not loaded."); return; }
    const updatedChecklist = orgChecklist.filter((_, index) => index !== taskIndex);
    setIsUpdatingOrgChecklist(true); setOrgSettingsMessage(''); setOrgSettingsError('');
    try {
      const { error } = await supabase.from('organizations').update({ default_checklist: updatedChecklist }).eq('id', organization.id);
      if (error) throw error;
      setOrgChecklist(updatedChecklist);
      setOrgSettingsMessage('Checklist task removed!');
    } catch (error) { console.error("Error deleting checklist task:", error); setOrgSettingsError(error.message); }
    finally { setIsUpdatingOrgChecklist(false); }
  };

  const handleAddPreApprovedEmail = async (e) => {
    e.preventDefault();
    if (!newPreApprovalEmail.trim() || !newPreApprovalRole) { setPreApprovalError("Email and role are required."); return; }
    if (!organization?.id || !user) { setPreApprovalError("Organization data or user session missing."); return; }
    setIsManagingPreApprovals(true); setPreApprovalMessage(''); setPreApprovalError('');
    try {
      const { error } = await supabase.from('organization_pre_approvals').insert([{
        organization_id: organization.id, email: newPreApprovalEmail.trim().toLowerCase(),
        role_to_assign: newPreApprovalRole, invited_by_user_id: user.id
      }]).select();
      if (error) { if (error.code === '23505') throw new Error(`Email ${newPreApprovalEmail.trim().toLowerCase()} is already pre-approved.`); throw error; }
      setPreApprovalMessage(`Email ${newPreApprovalEmail.trim().toLowerCase()} pre-approved as ${newPreApprovalRole}.`);
      setNewPreApprovalEmail(''); fetchOrganizationData(); // Refresh list
    } catch (error) { console.error("Error pre-approving email:", error); setPreApprovalError(error.message); }
    finally { setIsManagingPreApprovals(false); }
  };

  const handleRemovePreApprovedEmail = async (preApprovalId) => {
    if (!window.confirm("Remove this pre-approved email?")) return;
    setIsManagingPreApprovals(true); setPreApprovalMessage(''); setPreApprovalError('');
    try {
      const { error } = await supabase.from('organization_pre_approvals').delete().eq('id', preApprovalId);
      if (error) throw error;
      setPreApprovalMessage("Pre-approved email removed."); fetchOrganizationData();
    } catch (error) { console.error("Error removing pre-approval:", error); setPreApprovalError(error.message); }
    finally { setIsManagingPreApprovals(false); }
  };

  const handleRemoveMemberFromOrg = async (memberProfileIdToRemove, memberName) => {
    if (!organization?.id || !organization.created_by) { setOrgSettingsError("Org data missing."); return; }
    if (memberProfileIdToRemove === organization.created_by) { alert("Organization creator cannot be removed."); setOrgSettingsError("Creator cannot be removed."); return; }
    if (memberProfileIdToRemove === user?.id && profile?.role === 'ORGANIZER') {
        const otherOrganizers = currentOrgMembersList.filter(m => m.role === 'ORGANIZER' && m.id !== user.id);
        if (otherOrganizers.length === 0 && user.id !== organization.created_by) {
            alert("You cannot remove yourself as the only organizer (and not creator). Assign another organizer first."); return;
        }
    }
    if (!window.confirm(`Remove ${memberName} from "${organization.name}"? They will be unassigned from all plans and their organization affiliation will be removed.`)) return;
    
    setIsManagingMembers(true); setOrgSettingsMessage(''); setOrgSettingsError('');
    try {
      const { error: profileUpdateError } = await supabase.from('profiles').update({ organization_id: null, role: null }).eq('id', memberProfileIdToRemove).eq('organization_id', organization.id);
      if (profileUpdateError) throw new Error(`Profile update failed: ${profileUpdateError.message}`);

      const { data: eventIdsData, error: eventIdsError } = await supabase.from('events').select('id').eq('organization_id', organization.id);
      if (eventIdsError) throw new Error(`Event ID fetch failed: ${eventIdsError.message}`);
      if (eventIdsData && eventIdsData.length > 0) {
        const eventIdsInOrg = eventIdsData.map(e => e.id);
        const { error: assignmentsError } = await supabase.from('event_assignments').delete().eq('user_id', memberProfileIdToRemove).in('event_id', eventIdsInOrg);
        if (assignmentsError) console.warn("Warning: removing event assignments failed:", assignmentsError.message);

        const { data: songs, error: songsError } = await supabase.from('service_items').select('id, assigned_singer_ids').in('event_id', eventIdsInOrg).eq('type', 'Song').contains('assigned_singer_ids', [memberProfileIdToRemove]);
        if (songsError) console.warn("Warning: fetching songs for singer cleanup failed:", songsError.message);
        else if (songs && songs.length > 0) {
          const songUpdates = songs.map(s => supabase.from('service_items').update({ assigned_singer_ids: (s.assigned_singer_ids || []).filter(id => id !== memberProfileIdToRemove) }).eq('id', s.id));
          await Promise.all(songUpdates.map(p => p.catch(e => console.warn("Song singer cleanup sub-update failed", e))));
        }
      }
      setOrgSettingsMessage(`${memberName} removed from organization.`);
      fetchOrganizationData(); // Refresh member list
      if (memberProfileIdToRemove === user?.id) { await refreshProfile(); alert("You have been removed from the organization."); } // Update context if self
    } catch (error) { console.error("Error removing member:", error); setOrgSettingsError(error.message); }
    finally { setIsManagingMembers(false); }
  };

  // --- RENDER LOGIC ---
  if (authIsLoading) return <p className="page-status">Loading user data...</p>;
  if (!user || !profile) return <p className="page-status">User data not available. Please log in again.</p>;

  return (
    <div className="settings-page-container">
      <div className="settings-header"><h1>Settings</h1></div>
      <div className="settings-tabs">
        <button className={`tab-button ${activeTab === 'user' ? 'active' : ''}`} onClick={() => setActiveTab('user')}>User Settings</button>
        {profile.role === 'ORGANIZER' && profile.organization_id && ( // Org settings only if in an org
          <button className={`tab-button ${activeTab === 'organization' ? 'active' : ''}`} onClick={() => setActiveTab('organization')}>Organization Settings</button>
        )}
      </div>

      <div className="settings-content">
        {activeTab === 'user' && (
          <div className="settings-section user-settings-section">
            <h2>User Profile</h2>
            {(userSettingsError || userSettingsMessage) && (<p className={userSettingsError ? "form-error" : "form-success"}>{userSettingsError || userSettingsMessage}</p>)}
            <form onSubmit={handleUpdateNameSubmit} className="settings-form">
              <p><strong>Email:</strong> {user.email} <em style={{fontSize: '0.8em'}}>(cannot be changed here)</em></p>
              <p><strong>Current Role:</strong> {profile.role || 'N/A'}</p>
              {profile.organization_id && <p><strong>Organization ID:</strong> {profile.organization_id}</p>}
              {!profile.organization_id && <p><em>You are not currently part of an organization.</em></p>}
              <div className="form-group">
                <label htmlFor="firstName">First Name:</label>
                <input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={isUpdatingUserName} />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name:</label>
                <input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={isUpdatingUserName} />
              </div>
              <button type="submit" className="submit-btn" disabled={isUpdatingUserName}>{isUpdatingUserName ? 'Saving...' : 'Update Name'}</button>
            </form>
            {profile.role === 'MUSICIAN' && (
              <form onSubmit={handleUpdateInstrumentsSubmit} className="settings-form instrument-form">
                <h3>Your Instruments</h3>
                <div className="form-group">
                  <label>Select all instruments you play:</label>
                  <div className="checkbox-group settings-checkbox-group">
                    {INSTRUMENT_OPTIONS.map(instrument => (
                      <label key={instrument} className="checkbox-label">
                        <input type="checkbox" value={instrument} checked={selectedInstruments.includes(instrument)} onChange={() => handleInstrumentCheckboxChange(instrument)} disabled={isUpdatingInstruments}/>
                        {instrument}
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="submit-btn" disabled={isUpdatingInstruments}>{isUpdatingInstruments ? 'Saving...' : 'Update Instruments'}</button>
              </form>
            )}
          </div>
        )}

        {activeTab === 'organization' && profile.role === 'ORGANIZER' && profile.organization_id && (
          <div className="settings-section organization-settings-section">
            <h2>Organization: {organization?.name || 'Details'}</h2>
            {orgLoading && <p>Loading organization details...</p>}
            {(orgSettingsError || orgSettingsMessage) && !orgLoading && (<p className={orgSettingsError ? "form-error" : "form-success"}>{orgSettingsError || orgSettingsMessage}</p>)}
            
            {organization && !orgLoading && (
              <>
                <form onSubmit={handleUpdateOrgNameSubmit} className="settings-form">
                  <div className="form-group">
                    <label htmlFor="orgName">Organization Name:</label>
                    <input type="text" id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} required disabled={isUpdatingOrgName}/>
                  </div>
                  <button type="submit" className="submit-btn" disabled={isUpdatingOrgName}>{isUpdatingOrgName ? 'Saving...' : 'Update Name'}</button>
                </form>

                <div className="checklist-manager settings-form">
                  <h3>Default Pre-Service Checklist</h3>
                  {orgChecklist.length === 0 && <p>No default checklist tasks defined yet.</p>}
                  <ul className="checklist-display-list">
                    {orgChecklist.map((task, index) => (
                      <li key={index} className="checklist-display-item">
                        <span>{task}</span>
                        <button onClick={() => handleDeleteChecklistTask(index)} className="delete-task-btn" disabled={isUpdatingOrgChecklist} title="Delete Task">&times;</button>
                      </li>
                    ))}
                  </ul>
                  <div className="add-task-form-group">
                    <input type="text" value={newChecklistTask} onChange={(e) => setNewChecklistTask(e.target.value)} placeholder="Enter new checklist task" disabled={isUpdatingOrgChecklist}/>
                    <button type="button" onClick={handleAddChecklistTask} className="add-task-btn" disabled={isUpdatingOrgChecklist || !newChecklistTask.trim()}>+ Add Task</button>
                  </div>
                </div>
                
                <div className="pre-approval-manager settings-form">
                  <h3>Manage Pre-Approved Emails</h3>
                  <p>Add emails of users to allow them to join your organization. They will need your Organization ID/Code ({organization.id}) to complete their signup.</p>
                  {(preApprovalError || preApprovalMessage) && (<p className={preApprovalError ? "form-error" : "form-success"}>{preApprovalError || preApprovalMessage}</p>)}
                  <form onSubmit={handleAddPreApprovedEmail} className="add-preapproval-form">
                    <div className="form-group"><label htmlFor="preApprovalEmail">Email to Pre-Approve:</label><input type="email" id="preApprovalEmail" value={newPreApprovalEmail} onChange={(e) => setNewPreApprovalEmail(e.target.value)} placeholder="user@example.com" required disabled={isManagingPreApprovals}/></div>
                    <div className="form-group"><label htmlFor="preApprovalRole">Assign Role:</label><select id="preApprovalRole" value={newPreApprovalRole} onChange={(e) => setNewPreApprovalRole(e.target.value)} disabled={isManagingPreApprovals}><option value="MUSICIAN">Musician</option><option value="ORGANIZER">Organizer</option></select></div>
                    <button type="submit" className="submit-btn add-task-btn" disabled={isManagingPreApprovals || !newPreApprovalEmail.trim()}>{isManagingPreApprovals ? 'Adding...' : '+ Add Pre-Approval'}</button>
                  </form>
                  <h4>Currently Pre-Approved:</h4>
                  {preApprovedEmails.length === 0 && <p>No emails pre-approved yet.</p>}
                  <ul className="preapproval-list checklist-display-list">
                    {preApprovedEmails.map(approval => (
                      <li key={approval.id} className="preapproval-item checklist-display-item">
                        <span><strong>{approval.email}</strong> as <em>{approval.role_to_assign}</em></span>
                        <button onClick={() => handleRemovePreApprovedEmail(approval.id)} className="delete-task-btn" disabled={isManagingPreApprovals} title="Remove Pre-approval">&times;</button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="org-members-manager settings-form">
                  <h3>Organization Members</h3>
                  {orgMembersLoading && <p>Loading members...</p>}
                  {!orgMembersLoading && currentOrgMembersList.length === 0 && <p>No other members found.</p>}
                  {!orgMembersLoading && currentOrgMembersList.length > 0 && (
                    <ul className="org-members-list checklist-display-list">
                      {currentOrgMembersList.map(member => (
                        <li key={member.id} className="org-member-item checklist-display-item">
                          <div className="member-details">
                            <span className="member-name"><strong>{member.first_name} {member.last_name}</strong> ({member.email})</span>
                            <span className="member-role-org">Role: <em>{member.role}</em></span>
                          </div>
                          {member.id !== organization.created_by && member.id !== user.id && (
                            <button onClick={() => handleRemoveMemberFromOrg(member.id, `${member.first_name} ${member.last_name}`)} className="delete-task-btn remove-member-btn" disabled={isManagingMembers} title="Remove Member from Organization">Remove</button>
                          )}
                          {member.id === organization.created_by && (<span className="creator-tag">(Creator)</span>)}
                          {member.id === user.id && member.id !== organization.created_by && (<span className="creator-tag">(You)</span>)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
            {!organization && !orgLoading && !orgSettingsError && profile.organization_id && (<p>Could not load details for organization ID: {profile.organization_id}</p>)}
          </div>
        )}
        {/* Message for users not in an org or not organizers trying to see org settings */}
        {activeTab === 'organization' && (!profile.organization_id || profile.role !== 'ORGANIZER') && (
            <div className="settings-section">
                <h2>Organization Settings</h2>
                <p>
                    {profile.role !== 'ORGANIZER' 
                        ? "Only Organizers can manage organization settings." 
                        : "You are not currently associated with an organization. Organization settings are unavailable."
                    }
                </p>
                {/* Add "Join/Create Org" UI here for org-less users if desired */}
            </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;