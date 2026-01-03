import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import OrderOfService from '../PlanPage/OrderOfService';
import DefaultPlanAddItemForm from './DefaultPlanAddItemForm';
import DefaultPlanEditItemForm from './DefaultPlanEditItemForm';
import '../PlanPage/PlanPage.css'; // Reuse plan styles

const DefaultPlanPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddItemVisible, setIsAddItemVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Load existing default plan
  useEffect(() => {
    if (!profile?.organization_id) return;
    
    const fetchDefaultPlan = async () => {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('default_service_items')
          .eq('id', profile.organization_id)
          .single();
        
        if (error) throw error;
        
        // Ensure items have transient IDs for dnd-kit
        const loadedItems = (data.default_service_items || []).map(item => ({
            ...item,
            id: item.id || `temp-${Math.random().toString(36).substr(2, 9)}`
        }));
        setItems(loadedItems);
      } catch (err) {
        console.error("Error loading default plan:", err);
        alert("Failed to load default plan.");
      } finally {
        setLoading(false);
      }
    };

    if (user && profile) fetchDefaultPlan();
  }, [user, profile]);

  const handleSave = async () => {
    if (!profile?.organization_id) return;
    setIsSaving(true);
    
    // Strip temporary IDs before saving to clean up JSON
    const itemsToSave = items.map(({ id, ...rest }) => rest);

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ default_service_items: itemsToSave })
        .eq('id', profile.organization_id);

      if (error) throw error;
      alert("Default plan updated successfully!");
      navigate('/settings');
    } catch (err) {
      console.error("Error saving plan:", err);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOrderChange = (newItems) => setItems(newItems);

  const handleAddItem = (newItem) => {
    const itemWithId = { ...newItem, id: `temp-${Math.random().toString(36).substr(2, 9)}` };
    setItems(prev => [...prev, itemWithId]);
    setIsAddItemVisible(false);
  };

  const handleDeleteItem = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateItem = (updatedItem) => {
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    setEditingItem(null);
  };

  if (authLoading || loading) return <div className="page-status">Loading...</div>;
  if (profile?.role !== 'ORGANIZER') return <div className="page-status error">Access Denied</div>;

  return (
    <div className="plan-page-container">
        <header className="plan-header">
            <div className="plan-header-title-group">
                <h1>Edit Default Plan</h1>
                <p>Define the template used when creating new plans.</p>
            </div>
            <div className="plan-header-actions">
                <button onClick={() => navigate('/settings')} className="cancel-btn">Cancel</button>
                <button onClick={handleSave} className="submit-btn" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Default Plan'}
                </button>
            </div>
        </header>

        <div className="plan-main-content" style={{ display: 'block', maxWidth: '800px', margin: '0 auto' }}>
            <OrderOfService 
                items={items}
                onOrderChange={handleOrderChange}
                onDeleteItem={handleDeleteItem}
                onEditItem={setEditingItem}
                userRole="ORGANIZER"
                showTimes={false} // Hide timestamps
            />
            
            <button 
                onClick={() => setIsAddItemVisible(true)} 
                className="toggle-add-item-form-btn" 
                style={{marginTop: '20px', width: '100%'}}
            >
                + Add Service Item
            </button>
        </div>

        {/* Add Modal */}
        {isAddItemVisible && (
            <div className="modal-overlay" onClick={() => setIsAddItemVisible(false)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setIsAddItemVisible(false)}>&times;</button>
                    <DefaultPlanAddItemForm onAddItem={handleAddItem} />
                </div>
            </div>
        )}

        {/* Edit Modal */}
        {editingItem && (
            <div className="modal-overlay" onClick={() => setEditingItem(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setEditingItem(null)}>&times;</button>
                    <DefaultPlanEditItemForm 
                        itemToEdit={editingItem} 
                        onUpdateItem={handleUpdateItem} 
                        onCancel={() => setEditingItem(null)} 
                    />
                </div>
            </div>
        )}
    </div>
  );
};

export default DefaultPlanPage;