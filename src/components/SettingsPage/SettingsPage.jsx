// src/components/SettingsPage/SettingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './SettingsPage.css';

// --- Join Organization Form ---
const JoinOrgForm = ({ onJoin, onCancel, isSubmitting }) => {
  const [orgCode, setOrgCode] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onJoin(orgCode); }} className="glass-form">
      <h3>Join an Organization</h3>
      <p style={{marginBottom: '1rem', color: '#64748b'}}>Enter the Organization ID/Code provided by your leader.</p>
      <div className="form-group">
        <label htmlFor="join-org-code">Organization Code/ID</label>
        <input 
            type="text" 
            id="join-org-code" 
            value={orgCode} 
            onChange={(e) => setOrgCode(e.target.value)} 
            required 
            disabled={isSubmitting} 
            placeholder="e.g. 123-abc-456"
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting || !orgCode.trim()}>
          {isSubmitting ? 'Joining...' : 'Join Organization'}
        </button>
      </div>
    </form>
  );
};

const SettingsPage = () => {
  const { user, profile, loading: authIsLoading, refreshProfile, login } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('user');

  // User Settings State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [userSettingsMessage, setUserSettingsMessage] = useState('');
  const [userSettingsError, setUserSettingsError] = useState('');
  const [isUpdatingUserName, setIsUpdatingUserName] = useState(false);
  const [isUpdatingInstruments, setIsUpdatingInstruments] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Organization Related State
  const [organization, setOrganization] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [orgChecklist, setOrgChecklist] = useState([]);
  const [newChecklistTask, setNewChecklistTask] = useState('');
  const [preApprovedEmails, setPreApprovedEmails] = useState([]);
  const [newPreApprovalEmail, setNewPreApprovalEmail] = useState('');
  const [newPreApprovalRole, setNewPreApprovalRole] = useState('MUSICIAN');
  const [currentOrgMembersList, setCurrentOrgMembersList] = useState([]);
  const [orgInstrumentList, setOrgInstrumentList] = useState([]);
  const [newInstrumentName, setNewInstrumentName] = useState('');
  
  const [orgDetailsLoading, setOrgDetailsLoading] = useState(false);
  const [orgActionStatus, setOrgActionStatus] = useState({ message: '', error: '', loading: false });

  // --- INITIAL DATA LOADING ---
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
      setOrgActionStatus({ message: '', error: '', loading: false });
      try {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, default_checklist, created_by, instrument_list')
          .eq('id', profile.organization_id)
          .single();
        if (orgError) throw new Error(`Organization details: ${orgError.message}`);
        if (!orgData) { setOrganization(null); throw new Error("Your current organization's details could not be found."); }
        
        setOrganization(orgData);
        setOrgName(orgData.name || '');
        setOrgChecklist(orgData.default_checklist || []);
        setOrgInstrumentList(orgData.instrument_list || []);

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
        setOrgActionStatus(prev => ({ ...prev, error: err.message, loading: false }));
        setOrganization(null); setOrgName(''); setOrgChecklist([]); setPreApprovedEmails([]); setCurrentOrgMembersList([]); setOrgInstrumentList([]);
      } finally {
        setOrgDetailsLoading(false);
      }
    } else {
      setOrganization(null); setOrgName(''); setOrgChecklist([]);
      setPreApprovedEmails([]); setCurrentOrgMembersList([]); setOrgInstrumentList([]);
      setOrgDetailsLoading(false);
    }
  }, [profile?.organization_id, profile?.role]);

  useEffect(() => {
    if (!authIsLoading && user) {
        fetchCurrentOrganizationDetails();
    }
  }, [user, authIsLoading, fetchCurrentOrganizationDetails]);

  // --- HANDLERS: USER SETTINGS ---
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
      const { error: signInError } = await login(user.email, currentPassword);
      if (signInError) throw new Error("Your current password is not correct.");
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

  // --- HANDLERS: ORGANIZATION ---
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
  
  const handleAddInstrument = async () => {
    if (!newInstrumentName.trim() || !organization?.id) return;
    const newInstrument = newInstrumentName.trim();
    if (orgInstrumentList.some(inst => inst.toLowerCase() === newInstrument.toLowerCase())) {
        setOrgActionStatus({loading: false, error: `Instrument "${newInstrument}" already exists.`, message: ''});
        return;
    }
    const updatedList = [...orgInstrumentList, newInstrument];
    setOrgActionStatus({loading:true, message:'', error:''});
    try {
      const { error } = await supabase.from('organizations').update({ instrument_list: updatedList }).eq('id', organization.id);
      if (error) throw error;
      setOrgInstrumentList(updatedList);
      setNewInstrumentName('');
      setOrgActionStatus({loading:false, message:`Instrument "${newInstrument}" added.`, error:''});
    } catch (err) { console.error("Error adding instrument:", err); setOrgActionStatus({loading:false, message:'', error:err.message}); }
  };
  
  const handleDeleteInstrument = async (instrumentToDelete) => {
    if (!organization?.id || !window.confirm(`Are you sure you want to delete the instrument "${instrumentToDelete}"? This may affect musicians who have it selected.`)) return;
    const updatedList = orgInstrumentList.filter(inst => inst !== instrumentToDelete);
    setOrgActionStatus({loading:true, message:'', error:''});
    try {
      const { error } = await supabase.from('organizations').update({ instrument_list: updatedList }).eq('id', organization.id);
      if (error) throw error;
      setOrgInstrumentList(updatedList);
      setOrgActionStatus({loading:false, message:`Instrument "${instrumentToDelete}" removed.`, error:''});
    } catch (err) { console.error("Error deleting instrument:", err); setOrgActionStatus({loading:false, message:'', error:err.message}); }
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
    if (!userIdToUnassign || !orgId) return;
    try {
      const { data: eventIdsData } = await supabase.from('events').select('id').eq('organization_id', orgId);
      if (!eventIdsData || eventIdsData.length === 0) return;
      const eventIdsInOrg = eventIdsData.map(e => e.id);
      const { data: allSongsInEvents } = await supabase.from('service_items').select('id, assigned_singer_ids').in('event_id', eventIdsInOrg).eq('type', 'Song').neq('assigned_singer_ids', null);
      const songUpdatePromises = [];
      if (allSongsInEvents) {
        allSongsInEvents.forEach(song => {
          if (song.assigned_singer_ids?.includes(userIdToUnassign)) {
            const updatedSingerIds = song.assigned_singer_ids.filter(id => id !== userIdToUnassign);
            songUpdatePromises.push(supabase.from('service_items').update({ assigned_singer_ids: updatedSingerIds.length > 0 ? updatedSingerIds : null }).eq('id', song.id));
          }
        });
      }
      if (songUpdatePromises.length > 0) await Promise.all(songUpdatePromises);
    } catch (cleanupError) { console.error("Exception in unassignUserFromAllOrgItems:", cleanupError); }
  };

  const handleRemoveMemberFromOrgByOrganizer = async (memberProfileIdToRemove, memberName) => {
    if (!organization?.id || !organization.created_by || !user) { setOrgActionStatus(prev => ({...prev, error:"Org data missing."})); return; }
    if (memberProfileIdToRemove === organization.created_by) { alert("Organization creator cannot be removed."); return; }
    if (memberProfileIdToRemove === user.id) { alert("Use 'Leave Organization' to remove yourself."); return; }
    if (!window.confirm(`Remove ${memberName} from "${organization.name}"?`)) return;
    
    setOrgActionStatus(prev => ({...prev, loading:true, message:'', error:''}));
    try {
      await unassignUserFromAllOrgItems(memberProfileIdToRemove, organization.id);
      const { error: profileUpdateError } = await supabase.from('profiles').update({ organization_id: null, role: null, updated_at: new Date().toISOString() }).eq('id', memberProfileIdToRemove).eq('organization_id', organization.id);
      if (profileUpdateError) throw profileUpdateError;
      setOrgActionStatus(prev => ({...prev, loading:false, message:`${memberName} removed.`}));
      fetchCurrentOrganizationDetails();
    } catch (err) { console.error("Error removing member:", err); setOrgActionStatus(prev => ({...prev, loading:false, error:err.message})); }
  };

  const handleLeaveOrganization = async () => {
    if (!profile?.organization_id || !user?.id || !organization) { alert("Current organization details missing."); return; }
    if (user.id === organization.created_by) {
      if (currentOrgMembersList.filter(m => m.id !== user.id).length > 0) { alert("As org creator, you must transfer ownership or remove others first."); return; }
      if (!window.confirm(`You are the creator. Leaving will make the organization inaccessible. Are you sure?`)) return;
    } else if (!window.confirm(`Leave "${organization.name}"?`)) return;
    
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
    if (!orgCodeToJoin.trim() || !user?.email) { setOrgActionStatus(prev => ({...prev, error:"Org code or user info missing."})); return; }
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
      setOrgActionStatus({loading:false, message:`Successfully joined "${targetOrg.name}"!`, error:''});
      await refreshProfile();
    } catch (err) { console.error("Error joining org:", err); setOrgActionStatus(prev => ({...prev, loading:false, error:err.message})); }
  };

  if (authIsLoading) return <div className="loading-text">Loading settings...</div>;

  return (
    <div className="settings-page-wrapper">
      <div className="settings-content-container">
        
        {/* Header with Tabs embedded */}
        <header className="settings-glass-header">
            <div>
                <h1>Settings</h1>
            </div>
            <div className="settings-tabs-container">
                <button 
                    className={`glass-tab ${activeTab === 'user' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('user')}
                >
                    User Profile
                </button>
                <button 
                    className={`glass-tab ${activeTab === 'organization' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('organization')}
                >
                    Organization
                </button>
            </div>
        </header>

        {/* --- USER TAB --- */}
        {activeTab === 'user' && (
          <>
            {/* Status Messages */}
            {userSettingsMessage && <div className="status-box status-success">{userSettingsMessage}</div>}
            {userSettingsError && <div className="status-box status-error">{userSettingsError}</div>}

            <div className="settings-panel">
                <h2>Profile Details</h2>
                <form onSubmit={handleUpdateNameSubmit} className="glass-form">
                    <div className="form-group">
                        <label>Email Address</label>
                        <input type="text" value={user.email} disabled style={{opacity: 0.7}} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="firstName">First Name</label>
                        <input type="text" id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} disabled={isUpdatingUserName} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="lastName">Last Name</label>
                        <input type="text" id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} disabled={isUpdatingUserName} />
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="submit-btn" disabled={isUpdatingUserName}>Save Profile</button>
                    </div>
                </form>
            </div>

            <div className="settings-panel">
                <h2>Security</h2>
                <form onSubmit={handleUpdatePasswordSubmit} className="glass-form">
                    <h3>Change Password</h3>
                    <div className="form-group">
                        <label>Current Password</label>
                        <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} disabled={isUpdatingPassword} />
                    </div>
                    <div className="form-group">
                        <label>New Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={isUpdatingPassword} />
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isUpdatingPassword} />
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="submit-btn" disabled={isUpdatingPassword}>Update Password</button>
                    </div>
                </form>
            </div>

            {profile.role === 'MUSICIAN' && profile.organization_id && (
                 <div className="settings-panel">
                    <h2>My Instruments</h2>
                    <form onSubmit={handleUpdateInstrumentsSubmit} className="glass-form">
                        <p style={{marginBottom:'1rem'}}>Select the instruments you play from the organization's list.</p>
                        <div className="checkbox-group">
                            {orgInstrumentList.map(inst => (
                                <label key={inst} className="checkbox-label">
                                    <input type="checkbox" checked={selectedInstruments.includes(inst)} onChange={() => handleInstrumentCheckboxChange(inst)} />
                                    {inst}
                                </label>
                            ))}
                            {orgInstrumentList.length === 0 && <p>No instruments defined by organization.</p>}
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="submit-btn" disabled={isUpdatingInstruments}>Save Instruments</button>
                        </div>
                    </form>
                 </div>
            )}
          </>
        )}

        {/* --- ORGANIZATION TAB --- */}
        {activeTab === 'organization' && (
          <>
            {orgActionStatus.message && <div className="status-box status-success">{orgActionStatus.message}</div>}
            {orgActionStatus.error && <div className="status-box status-error">{orgActionStatus.error}</div>}

            {/* Case: Not in Org */}
            {!profile.organization_id && (
                <div className="settings-panel">
                    <JoinOrgForm onJoin={handleJoinOrgSubmit} isSubmitting={orgActionStatus.loading} />
                </div>
            )}

            {/* Case: In Org */}
            {profile.organization_id && organization && (
                <>
                    <div className="settings-panel">
                        {/* REVISED HEADER: Name + Leave Button in one row */}
                        <div className="settings-org-header-row">
                            <h2>{organization.name} <span style={{fontSize:'0.6em', opacity: 0.6, fontWeight:400}}>ID: {organization.id}</span></h2>
                            <button onClick={handleLeaveOrganization} className="btn-danger-outline-small">
                                Leave Organization
                            </button>
                        </div>
                        
                        {profile.role === 'ORGANIZER' ? (
                            <form onSubmit={handleUpdateOrgNameSubmit} className="glass-form">
                                <div className="form-group">
                                    <label>Edit Organization Name</label>
                                    <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} />
                                </div>
                                <div className="form-actions">
                                    <button className="submit-btn">Update Name</button>
                                </div>
                            </form>
                        ) : (
                             <p>You are a member of this organization.</p>
                        )}
                    </div>

                    {profile.role === 'ORGANIZER' && (
                        <>
                            {/* PLAN TEMPLATES */}
                            <div className="settings-panel">
                                <h2>Plan Templates</h2>
                                <p style={{marginBottom: '1rem'}}>Customize the items that appear on every new plan.</p>
                                <button onClick={() => navigate('/settings/default-plan')} className="submit-btn">
                                    Edit Default Plan
                                </button>
                            </div>

                            {/* INSTRUMENTS */}
                            <div className="settings-panel">
                                <h2>Instruments</h2>
                                <ul className="glass-list">
                                    {orgInstrumentList.map(inst => (
                                        <li key={inst} className="glass-list-item">
                                            <span className="item-main-text">{inst}</span>
                                            <button onClick={() => handleDeleteInstrument(inst)} className="icon-btn-danger">&times;</button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="glass-form add-row">
                                    <input type="text" value={newInstrumentName} onChange={e => setNewInstrumentName(e.target.value)} placeholder="New instrument..." />
                                    <button onClick={handleAddInstrument} className="submit-btn" style={{whiteSpace:'nowrap'}}>Add</button>
                                </div>
                            </div>

                            {/* CHECKLIST */}
                            <div className="settings-panel">
                                <h2>Checklist Tasks</h2>
                                <ul className="glass-list">
                                    {orgChecklist.map((task, idx) => (
                                        <li key={idx} className="glass-list-item">
                                            <span className="item-main-text">{task}</span>
                                            <button onClick={() => handleDeleteChecklistTask(idx)} className="icon-btn-danger">&times;</button>
                                        </li>
                                    ))}
                                </ul>
                                <div className="glass-form add-row">
                                    <input type="text" value={newChecklistTask} onChange={e => setNewChecklistTask(e.target.value)} placeholder="New task..." />
                                    <button onClick={handleAddChecklistTask} className="submit-btn" style={{whiteSpace:'nowrap'}}>Add</button>
                                </div>
                            </div>

                            {/* MEMBERS */}
                            <div className="settings-panel">
                                <h2>Members & Invites</h2>
                                
                                <form onSubmit={handleAddPreApprovedEmail} className="glass-form" style={{marginBottom: '2rem'}}>
                                    <h3>Pre-Approve Email</h3>
                                    <div className="add-row">
                                        <input type="email" value={newPreApprovalEmail} onChange={e => setNewPreApprovalEmail(e.target.value)} placeholder="user@email.com" />
                                        <select value={newPreApprovalRole} onChange={e => setNewPreApprovalRole(e.target.value)} style={{width: '140px'}}>
                                            <option value="MUSICIAN">Musician</option>
                                            <option value="ORGANIZER">Organizer</option>
                                        </select>
                                        <button type="submit" className="submit-btn">Approve</button>
                                    </div>
                                </form>
                                {preApprovedEmails.length > 0 && (
                                    <ul className="glass-list" style={{marginBottom: '2rem'}}>
                                        {preApprovedEmails.map(approval => (
                                            <li key={approval.id} className="glass-list-item">
                                                <span className="item-main-text">{approval.email} <em style={{fontSize:'0.8em', color:'#64748b'}}>({approval.role_to_assign})</em></span>
                                                <button onClick={() => handleRemovePreApprovedEmail(approval.id)} className="icon-btn-danger">&times;</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <h3>Current Members</h3>
                                <ul className="glass-list">
                                    {currentOrgMembersList.map(member => (
                                        <li key={member.id} className="glass-list-item">
                                            <div>
                                                <span className="item-main-text"><strong>{member.first_name} {member.last_name}</strong></span>
                                                <span className="item-sub-text">{member.role}</span>
                                                {member.id === user.id && <span className="item-sub-text">(You)</span>}
                                            </div>
                                            {member.id !== user.id && member.id !== organization.created_by && (
                                                <button onClick={() => handleRemoveMemberFromOrgByOrganizer(member.id, member.first_name)} className="icon-btn-danger" title="Remove">&times;</button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </>
                    )}
                </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;