// src/components/StartPage/StartPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient'; // Adjust path if needed
import './StartPage.css'; // Make sure this CSS file exists and is styled
import { INSTRUMENT_OPTIONS  } from '../../constants';

const StartPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(''); // 'MUSICIAN' or 'ORGANIZER'

  // Step 2 - Musician Details
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [musicianOrgCode, setMusicianOrgCode] = useState('');

  // Step 2 - Organizer Details
  const [organizerAction, setOrganizerAction] = useState('join'); // 'join' or 'create'
  const [organizerOrgCode, setOrganizerOrgCode] = useState('');
  const [newOrgId, setNewOrgId] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [step2Error, setStep2Error] = useState('');

  // Step 3 - Account Information
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step3Error, setStep3Error] = useState('');

  // Submission & Success State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupSuccessMessage, setSignupSuccessMessage] = useState('');

  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setStep2Error(''); // Clear errors from previous step attempt
    setCurrentStep(2);
  };

  const handleInstrumentChange = (instrument) => {
    setSelectedInstruments(prev =>
      prev.includes(instrument)
        ? prev.filter(item => item !== instrument)
        : [...prev, instrument]
    );
  };

  const handleProceedToStepThree = () => {
    setStep2Error(''); // Clear previous step 2 errors
    if (selectedRole === 'MUSICIAN') {
      if (selectedInstruments.length === 0) {
        setStep2Error('Please select at least one instrument.');
        return;
      }
      if (!musicianOrgCode.trim()) {
        setStep2Error('Please enter the organization code.');
        return;
      }
    } else if (selectedRole === 'ORGANIZER') {
      if (organizerAction === 'join' && !organizerOrgCode.trim()) {
        setStep2Error('Please enter the organization code to join.');
        return;
      }
      if (organizerAction === 'create') {
        if (!newOrgId.trim()) {
            setStep2Error('Please enter a unique Organization ID to create.');
            return;
        }
        if (!newOrgName.trim()) {
            setStep2Error('Please enter an Organization Name to create.');
            return;
        }
        if (/\s/.test(newOrgId.trim()) || !/^[a-zA-Z0-9-_]+$/.test(newOrgId.trim())) {
            setStep2Error('Organization ID can only contain letters, numbers, hyphens (-), and underscores (_). No spaces allowed.');
            return;
        }
      }
    }
    setStep3Error(''); // Clear errors for next step
    setCurrentStep(3);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setStep3Error('');
    setSignupSuccessMessage('');
    setIsSubmitting(true);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setStep3Error('All account fields are required.');
      setIsSubmitting(false);
      return;
    }
    if (password !== confirmPassword) {
      setStep3Error('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }
    if (password.length < 6) {
        setStep3Error('Password must be at least 6 characters long.');
        setIsSubmitting(false);
        return;
    }

    let organizationIdToLink = null;
    let finalUserRole = selectedRole;
    let preApprovalRecordId = null;
    let orgStepFailed = false; // Flag to prevent proceeding if org step has issues

    try {
      const userEnteredEmail = email.trim().toLowerCase();

      if (selectedRole === 'ORGANIZER' && organizerAction === 'create') {
        const orgIdInput = newOrgId.trim();
        const orgNameInput = newOrgName.trim();
        const { data: existingOrg, error: checkOrgError } = await supabase.from('organizations').select('id').eq('id', orgIdInput).maybeSingle();
        if (checkOrgError) throw new Error(`DB Error (Org Check): ${checkOrgError.message}`);
        if (existingOrg) {
          setStep2Error(`Organization ID "${orgIdInput}" already exists. Please choose another.`); setCurrentStep(2); orgStepFailed = true;
          throw new Error("Org ID exists.");
        }
        const { data: createdOrg, error: createOrgError } = await supabase.from('organizations').insert([{ id: orgIdInput, name: orgNameInput, join_code: orgIdInput, created_by: null }]).select('id').single();
        if (createOrgError) throw new Error(`Failed to create organization: ${createOrgError.message}`);
        if (!createdOrg?.id) throw new Error("Organization created, but ID not returned.");
        organizationIdToLink = createdOrg.id;
      } else {
        const codeToVerify = selectedRole === 'MUSICIAN' ? musicianOrgCode.trim() : organizerOrgCode.trim();
        const { data: foundOrg, error: findOrgError } = await supabase.from('organizations').select('id').or(`id.eq.${codeToVerify},join_code.eq.${codeToVerify}`).maybeSingle();
        if (findOrgError) throw new Error(`DB Error (Org Find): ${findOrgError.message}`);
        if (!foundOrg) {
          setStep2Error(`Organization with code "${codeToVerify}" not found.`); setCurrentStep(2); orgStepFailed = true;
          throw new Error("Org code not found.");
        }
        organizationIdToLink = foundOrg.id;

        const { data: preApproval, error: preApprovalError } = await supabase.from('organization_pre_approvals').select('id, role_to_assign').eq('organization_id', organizationIdToLink).eq('email', userEnteredEmail).maybeSingle();
        if (preApprovalError) throw new Error(`Error checking pre-approval: ${preApprovalError.message}`);
        if (!preApproval) {
          setStep3Error(`Your email (${userEnteredEmail}) has not been pre-approved to join this organization. Please contact an administrator.`);
          throw new Error("Email not pre-approved for this organization.");
        }
        finalUserRole = preApproval.role_to_assign;
        preApprovalRecordId = preApproval.id;
        if (selectedRole !== finalUserRole) {
            console.warn(`User selected role '${selectedRole}' but was pre-approved as '${finalUserRole}'. Using pre-approved role.`);
        }
      }

      if (orgStepFailed) { setIsSubmitting(false); return; } // Stop if organization step failed and redirected

      const { data: authData, error: signUpError } = await supabase.auth.signUp({ email: userEnteredEmail, password: password });
      if (signUpError) throw new Error(`Sign up failed: ${signUpError.message}`);
      if (!authData.user || !authData.user.id) throw new Error("User auth creation successful, but no user data returned.");
      const userId = authData.user.id;

      if (selectedRole === 'ORGANIZER' && organizerAction === 'create' && organizationIdToLink) {
          await supabase.from('organizations').update({ created_by: userId }).eq('id', organizationIdToLink);
      }

      let profileDataToUpdate = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: finalUserRole,
        organization_id: organizationIdToLink,
        updated_at: new Date().toISOString(),
        email: userEnteredEmail // Also update email in profile, trigger handles initial insert with email
      };
      if (finalUserRole === 'MUSICIAN') {
        profileDataToUpdate.instruments = selectedInstruments;
      } else {
        profileDataToUpdate.instruments = null;
      }

      const { error: profileUpdateError } = await supabase.from('profiles').update(profileDataToUpdate).eq('id', userId);
      if (profileUpdateError) {
        console.error("Auth user created, but profile update failed:", profileUpdateError);
        throw new Error(`Account created, but saving all details failed: ${profileUpdateError.message}. Check email for confirmation, then login to complete profile or contact support.`);
      }

      if (preApprovalRecordId) {
        await supabase.from('organization_pre_approvals').delete().eq('id', preApprovalRecordId);
      }

      setSignupSuccessMessage(`Signup complete! We've sent a confirmation link to ${userEnteredEmail}. Please click the link in that email to activate your account and log in.`);
      setCurrentStep(4); // Show success/confirmation message

    } catch (err) {
      console.error("[StartPage] Final submission process error:", err);
      if (!orgStepFailed) { // Don't overwrite step2Error if that was the cause
        setStep3Error(err.message || "An unexpected error occurred during signup.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepOne = () => (
    <div className="role-selection-container">
      <h2>First, tell us who you are:</h2>
      <div className="role-buttons">
        <button onClick={() => handleRoleSelect('MUSICIAN')} className="role-button musician-btn">I'm a Musician</button>
        <button onClick={() => handleRoleSelect('ORGANIZER')} className="role-button organizer-btn">I'm an Organizer</button>
      </div>
      <p className="role-description">
        <strong>Musicians</strong> get invited to plans and manage their assignments.<br />
        <strong>Organizers</strong> create plans and manage teams.
      </p>
    </div>
  );

  const renderStepTwoMusician = () => (
    <div className="role-specific-form">
      <h3>Musician Details</h3>
      <p>Please select the instruments you play and enter your organization's code.</p>
      <div className="form-group">
        <label>Instruments you play (select all that apply):</label>
        <div className="checkbox-group settings-checkbox-group"> {/* Reused class from settings for consistency */}
          {INSTRUMENT_OPTIONS.map(instrument => (
            <label key={instrument} className="checkbox-label">
              <input type="checkbox" value={instrument} checked={selectedInstruments.includes(instrument)} onChange={() => handleInstrumentChange(instrument)} />
              {instrument}
            </label>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="musician-org-code">Organization Code:</label>
        <input type="text" id="musician-org-code" value={musicianOrgCode} onChange={(e) => setMusicianOrgCode(e.target.value)} placeholder="Enter code from your organizer" />
      </div>
    </div>
  );

  const renderStepTwoOrganizer = () => (
    <div className="role-specific-form">
      <h3>Organizer Details</h3>
      <div className="form-group radio-group">
        <label><input type="radio" name="organizerAction" value="join" checked={organizerAction === 'join'} onChange={(e) => setOrganizerAction(e.target.value)} /> Join an Existing Organization</label>
        <label><input type="radio" name="organizerAction" value="create" checked={organizerAction === 'create'} onChange={(e) => setOrganizerAction(e.target.value)} /> Create a New Organization</label>
      </div>
      {organizerAction === 'join' && (
        <div className="form-group">
          <label htmlFor="organizer-org-code">Organization Code:</label>
          <input type="text" id="organizer-org-code" value={organizerOrgCode} onChange={(e) => setOrganizerOrgCode(e.target.value)} placeholder="Enter code to join" />
        </div>
      )}
      {organizerAction === 'create' && (
        <>
          <div className="form-group">
            <label htmlFor="new-org-id">New Organization ID:</label>
            <input type="text" id="new-org-id" value={newOrgId} onChange={(e) => setNewOrgId(e.target.value)} placeholder="e.g., gracechurch (no spaces, unique)" />
            <small>This will also be your organization's join code. Letters, numbers, hyphens (-), underscores (_) only. No spaces.</small>
          </div>
          <div className="form-group">
            <label htmlFor="new-org-name">New Organization Name:</label>
            <input type="text" id="new-org-name" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} placeholder="e.g., Grace Church Downtown" />
          </div>
        </>
      )}
    </div>
  );

  const renderStepTwo = () => (
    <div className="details-step-container">
      <h2>You selected: {selectedRole}</h2>
      {selectedRole === 'MUSICIAN' && renderStepTwoMusician()}
      {selectedRole === 'ORGANIZER' && renderStepTwoOrganizer()}
      {step2Error && <p className="form-error">{step2Error}</p>}
      <div className="step-actions">
          <button onClick={() => {setCurrentStep(1); setSelectedRole(''); setStep2Error('');}} className="back-btn">Back</button>
          <button onClick={handleProceedToStepThree} className="next-btn">Next: Account Info</button>
      </div>
    </div>
  );

  const renderStepThree = () => (
    <div className="account-info-form">
      <h3>Finally, Your Account Details</h3>
      <form onSubmit={handleFinalSubmit}>
        {step3Error && <p className="form-error">{step3Error}</p>}
        <div className="form-group">
          <label htmlFor="firstName">First Name:</label>
          <input type="text" id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={isSubmitting} />
        </div>
        <div className="form-group">
          <label htmlFor="lastName">Last Name:</label>
          <input type="text" id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={isSubmitting} />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password (min. 6 characters):</label>
          <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" disabled={isSubmitting} />
        </div>
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isSubmitting} />
        </div>
        <div className="step-actions">
          <button type="button" onClick={() => {setCurrentStep(2); setStep3Error('');}} className="back-btn" disabled={isSubmitting}>Back</button>
          <button type="submit" className="submit-btn main-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Account...' : 'Finish Signup'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderStepFour_Success = () => (
      <div className="signup-success-message">
        <h3>Account Creation Initiated!</h3>
        <p>{signupSuccessMessage}</p>
        <Link to="/" className="back-to-home-btn-success">Go to Homepage</Link>
      </div>
  );

  return (
    <div className="start-page-container">
      <div className="start-page-card">
        <Link to="/" className="back-to-home-link">&larr; Back to Home</Link>
        <h1>Create Your Account</h1>
        <div className="progress-steps">
            <span className={currentStep === 1 ? 'active-step' : ''}>1. Role</span> &rarr;
            <span className={currentStep === 2 ? 'active-step' : ''}>2. Details</span> &rarr;
            <span className={currentStep === 3 && !signupSuccessMessage ? 'active-step' : ''}>3. Account</span>
            {signupSuccessMessage && <span className="active-step">&rarr; 4. Confirm Email</span>}
        </div>

        {currentStep === 1 && renderStepOne()}
        {currentStep === 2 && renderStepTwo()}
        {currentStep === 3 && renderStepThree()}
        {currentStep === 4 && signupSuccessMessage && renderStepFour_Success()}
      </div>
    </div>
  );
};

export default StartPage;