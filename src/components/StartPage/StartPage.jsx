// src/components/StartPage/StartPage.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient'; // Adjust path if needed
import { useAuth } from '../../contexts/AuthContext'; // For the signup function
import './StartPage.css';

const INSTRUMENT_OPTIONS = ["Vocals", "Piano", "Acoustic Guitar", "Electric Guitar", "Bass", "Drums/Cajon", "Other"];

const StartPage = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState('');

  // Step 2 - Musician
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [musicianOrgCode, setMusicianOrgCode] = useState('');

  // Step 2 - Organizer
  const [organizerAction, setOrganizerAction] = useState('join');
  const [organizerOrgCode, setOrganizerOrgCode] = useState('');
  const [newOrgId, setNewOrgId] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [step2Error, setStep2Error] = useState('');

  // Step 3 - Account Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step3Error, setStep3Error] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupSuccessMessage, setSignupSuccessMessage] = useState(''); // New state for success message

  const navigate = useNavigate();
  const { signup } = useAuth(); // Using the basic signup from AuthContext for now. We'll call it.

  const handleRoleSelect = (role) => { /* ... (same as before) ... */ setSelectedRole(role); setStep2Error(''); setCurrentStep(2); };
  const handleInstrumentChange = (instrument) => { /* ... (same as before) ... */ setSelectedInstruments(prev => prev.includes(instrument) ? prev.filter(item => item !== instrument) : [...prev, instrument]);};

  const handleProceedToStepThree = () => { /* ... (same validation as before) ... */
    setStep2Error('');
    if (selectedRole === 'MUSICIAN') {
      if (selectedInstruments.length === 0) { setStep2Error('Please select at least one instrument.'); return; }
      if (!musicianOrgCode.trim()) { setStep2Error('Please enter the organization code.'); return; }
    } else if (selectedRole === 'ORGANIZER') {
      if (organizerAction === 'join' && !organizerOrgCode.trim()) { setStep2Error('Please enter the organization code to join.'); return; }
      if (organizerAction === 'create') {
        if (!newOrgId.trim()) { setStep2Error('Please enter a unique Organization ID.'); return; }
        if (!newOrgName.trim()) { setStep2Error('Please enter an Organization Name.'); return; }
        if (/\s/.test(newOrgId) || !/^[a-zA-Z0-9-_]+$/.test(newOrgId)) { setStep2Error('Org ID: letters, numbers, hyphens, underscores only. No spaces.'); return; }
      }
    }
    setStep3Error(''); // Clear errors for next step
    setCurrentStep(3);
  };


   const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setStep3Error('');
    setSignupSuccessMessage(''); // Clear previous success message
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
    let orgStepFailed = false;

    try {
      // --- Step 1: Handle Organization Logic ---
      if (selectedRole === 'ORGANIZER' && organizerAction === 'create') {
        const { data: existingOrg, error: checkOrgError } = await supabase.from('organizations').select('id').eq('id', newOrgId.trim()).maybeSingle();
        if (checkOrgError) throw new Error(`DB Error (Org Check): ${checkOrgError.message}`);
        if (existingOrg) {
          setStep2Error(`Organization ID "${newOrgId.trim()}" already exists.`); setCurrentStep(2); orgStepFailed = true;
          throw new Error("Org ID exists."); // Internal throw to stop submission
        }
        const { data: createdOrg, error: createOrgError } = await supabase.from('organizations').insert([{ id: newOrgId.trim(), name: newOrgName.trim(), join_code: newOrgId.trim() }]).select('id').single();
        if (createOrgError) throw new Error(`DB Error (Org Create): ${createOrgError.message}`);
        organizationIdToLink = createdOrg.id;
      } else {
        const codeToVerify = selectedRole === 'MUSICIAN' ? musicianOrgCode.trim() : organizerOrgCode.trim();
        const { data: foundOrg, error: findOrgError } = await supabase.from('organizations').select('id').or(`id.eq.${codeToVerify},join_code.eq.${codeToVerify}`).maybeSingle();
        if (findOrgError) throw new Error(`DB Error (Org Find): ${findOrgError.message}`);
        if (!foundOrg) {
          setStep2Error(`Organization with code "${codeToVerify}" not found.`); setCurrentStep(2); orgStepFailed = true;
          throw new Error("Org code not found."); // Internal throw
        }
        organizationIdToLink = foundOrg.id;
      }
       if (orgStepFailed) { setIsSubmitting(false); return; }


      // --- Step 2: Create Supabase Auth User ---
      // We pass data to be stored in auth.users.user_metadata
      // And also data that our trigger public.handle_new_user might use if we adapted it,
      // but the trigger currently only uses new.id and new.email.
      // The profile data will be added in an update step.
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        // options: {
        //   data: { // This data is stored in auth.users.user_metadata
        //     first_name: firstName.trim(),
        //     last_name: lastName.trim(),
        //     // Role & org info will be in 'profiles' table
        //   }
        // }
      });
      if (signUpError) throw new Error(`Sign up failed: ${signUpError.message}`);
      if (!authData.user || !authData.user.id) throw new Error("User creation successful, but no user data returned from auth.");
      const userId = authData.user.id;

      // --- Step 3: Update User Profile in 'profiles' Table ---
      // The handle_new_user trigger has already created a basic profile row. We update it.
      let profileDataToUpdate = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: selectedRole,
        organization_id: organizationIdToLink,
        updated_at: new Date().toISOString(),
        // email: email.trim() // email is already set by the trigger
      };
      if (selectedRole === 'MUSICIAN') {
        profileDataToUpdate.instruments = selectedInstruments;
      }

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update(profileDataToUpdate)
        .eq('id', userId);

      if (profileUpdateError) {
        console.error("Auth user created, but profile update failed:", profileUpdateError);
        // This is a partial failure. The user exists in auth but their profile isn't fully set up.
        // They will get the confirmation email. If they confirm, they might have an incomplete profile.
        throw new Error(`Account created, but saving all details failed: ${profileUpdateError.message}. Please check your email to confirm your account.`);
      }

      // --- Step 4: Success ---
      console.log('User signed up and profile updated successfully!');
      setSignupSuccessMessage(`Great! We've sent a confirmation link to ${email}. Please click the link in that email to activate your account and log in.`);
      // Do NOT navigate yet. User needs to confirm email.
      // Clear form fields (optional, as they'll see a message now)
      // setFirstName(''); setLastName(''); setEmail(''); setPassword(''); setConfirmPassword('');


    } catch (err) {
      console.error("Final submission error:", err);
      // Only set step3Error if it's not an org error that already redirected to step 2
      if (!orgStepFailed) { // Avoid overwriting step2Error if that was the cause
        setStep3Error(err.message || "An unexpected error occurred during signup.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepOne = () => {
    return (
      <div className="role-selection-container">
        <h2>First, tell us who you are:</h2>
        <div className="role-buttons">
          <button onClick={() => handleRoleSelect('MUSICIAN')} className="role-button musician-btn">
            I'm a Musician
          </button>
          <button onClick={() => handleRoleSelect('ORGANIZER')} className="role-button organizer-btn">
            I'm an Organizer
          </button>
        </div>
        <p className="role-description">
          <strong>Musicians</strong> get invited to plans and manage their assignments.
          <br />
          <strong>Organizers</strong> create plans and manage teams.
        </p>
      </div>
    );
  };

  const renderStepTwoMusician = () => {
    return (
      <div className="role-specific-form">
        <h3>Musician Details</h3>
        <p>Please select the instruments you play and enter your organization's code.</p>
        <div className="form-group">
          <label>Instruments you play (select all that apply):</label>
          <div className="checkbox-group">
            {INSTRUMENT_OPTIONS.map(instrument => (
              <label key={instrument} className="checkbox-label">
                <input
                  type="checkbox"
                  value={instrument}
                  checked={selectedInstruments.includes(instrument)}
                  onChange={() => handleInstrumentChange(instrument)}
                />
                {instrument}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="musician-org-code">Organization Code:</label>
          <input
            type="text"
            id="musician-org-code"
            value={musicianOrgCode}
            onChange={(e) => setMusicianOrgCode(e.target.value)}
            placeholder="Enter code from your organizer"
          />
        </div>
      </div>
    );
  };

  const renderStepTwoOrganizer = () => {
    return (
      <div className="role-specific-form">
        <h3>Organizer Details</h3>
        <div className="form-group radio-group">
          <label>
            <input
              type="radio"
              name="organizerAction"
              value="join"
              checked={organizerAction === 'join'}
              onChange={(e) => setOrganizerAction(e.target.value)}
            />
            Join an Existing Organization
          </label>
          <label>
            <input
              type="radio"
              name="organizerAction"
              value="create"
              checked={organizerAction === 'create'}
              onChange={(e) => setOrganizerAction(e.target.value)}
            />
            Create a New Organization
          </label>
        </div>

        {organizerAction === 'join' && (
          <div className="form-group">
            <label htmlFor="organizer-org-code">Organization Code:</label>
            <input
              type="text"
              id="organizer-org-code"
              value={organizerOrgCode}
              onChange={(e) => setOrganizerOrgCode(e.target.value)}
              placeholder="Enter code to join"
            />
          </div>
        )}

        {organizerAction === 'create' && (
          <>
            <div className="form-group">
              <label htmlFor="new-org-id">New Organization ID:</label>
              <input
                type="text"
                id="new-org-id"
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                placeholder="e.g., gracechurch (no spaces, unique)"
              />
               <small>This will also be your organization's join code. No spaces or special characters other than '-' or '_'.</small>
            </div>
            <div className="form-group">
              <label htmlFor="new-org-name">New Organization Name:</label>
              <input
                type="text"
                id="new-org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g., Grace Church Downtown"
              />
            </div>
          </>
        )}
      </div>
    );
  };


  const renderStepTwo = () => {
    return (
      <div className="details-step-container">
        <h2>You selected: {selectedRole}</h2>
        {selectedRole === 'MUSICIAN' && renderStepTwoMusician()}
        {selectedRole === 'ORGANIZER' && renderStepTwoOrganizer()}
        {step2Error && <p className="form-error">{step2Error}</p>}
        <div className="step-actions">
            <button onClick={() => {setCurrentStep(1); setSelectedRole(''); setStep2Error('');}} className="back-btn">
                Back
            </button>
            <button onClick={handleProceedToStepThree} className="next-btn">
                Next: Account Info
            </button>
        </div>
      </div>
    );
  };

  const renderStepThree = () => {
    // If signupSuccessMessage is present, show it instead of the form
    if (signupSuccessMessage) {
      return (
        <div className="signup-success-message">
          <h3>Account Creation Initiated!</h3>
          <p>{signupSuccessMessage}</p>
          <Link to="/" className="back-to-home-btn-success">Go to Homepage</Link>
        </div>
      );
    }

    return (
      <div className="account-info-form">
        <h3>Finally, Your Account Details</h3>
        <form onSubmit={handleFinalSubmit}>
          {/* ... (form fields for firstName, lastName, email, password, confirmPassword as before) ... */}
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
            <label htmlFor="password">Password:</label>
            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password:</label>
            <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isSubmitting} />
          </div>
          <div className="step-actions">
            <button type="button" onClick={() => {setCurrentStep(2); setStep3Error('');}} className="back-btn" disabled={isSubmitting}>
                Back
            </button>
            <button type="submit" className="submit-btn main-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Account...' : 'Finish Signup'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="start-page-container">
      <div className="start-page-card">
        {/* ... (Back to Home Link & Progress Steps remain the same) ... */}
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
      </div>
    </div>
  );
};

export default StartPage;