import React, { useState } from 'react';

const DefaultPlanEditItemForm = ({ itemToEdit, onUpdateItem, onCancel }) => {
  const [title, setTitle] = useState(itemToEdit?.title || '');
  const [duration, setDuration] = useState(itemToEdit?.duration || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdateItem({
        ...itemToEdit,
        title: title.trim(),
        duration: itemToEdit.type === 'Divider' ? null : duration.trim()
    });
  };

  if (!itemToEdit) return null;

  const isRestricted = itemToEdit.type === 'Song' || itemToEdit.type === 'Bible Verse';

  return (
    <form onSubmit={handleSubmit} className="add-item-form edit-item-form">
      <h3>Edit Template Item</h3>
      
      {isRestricted ? (
          <p>
              <strong>{itemToEdit.type}</strong> items are placeholders in the default plan and cannot be customized here. 
              They will be editable once a real plan is created.
          </p>
      ) : (
        <>
            <div className="form-group">
                <label>Title:</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            {itemToEdit.type !== 'Divider' && (
                <div className="form-group">
                    <label>Duration:</label>
                    <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
            )}
        </>
      )}

      <div className="form-actions">
        {!isRestricted && <button type="submit" className="submit-btn">Save Changes</button>}
        <button type="button" className="cancel-btn" onClick={onCancel}>
            {isRestricted ? 'Close' : 'Cancel'}
        </button>
      </div>
    </form>
  );
};

export default DefaultPlanEditItemForm;