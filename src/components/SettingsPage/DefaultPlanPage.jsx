// src/components/SettingsPage/DefaultPlanPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import OrderOfService from '../PlanPage/OrderOfService';
import DefaultPlanAddItemForm from './DefaultPlanAddItemForm';
import DefaultPlanEditItemForm from './DefaultPlanEditItemForm';
import '../PlanPage/PlanPage.css'; // Inheriting styles

const DefaultPlanPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddItemVisible, setIsAddItemVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    document.title = 'tabernacle - Settings';
  }, []);

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
      navigate('/settings');
    } catch (err) {
      console.error("Error saving plan:", err);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = (newItem) => {
    const itemWithId = { ...newItem, id: `temp-${Math.random().toString(36).substr(2, 9)}` };
    setItems(prev => [...prev, itemWithId]);
    setIsAddItemVisible(false);
  };

  if (authLoading || loading) return <div className="page-status-message">Loading...</div>;
  if (profile?.role !== 'ORGANIZER') return <div className="page-status-message error-message">Access Denied</div>;

  return (
    <div className="plan-page-wrapper">
        <div className="plan-content-container">
            {/* Glass Header */}
            <header className="plan-glass-header">
                <div className="plan-header-title-group">
                    <h1>Plan Template</h1>
                    <span className="plan-date-subtitle">Items here added to new plans.</span>
                </div>
                <div className="plan-header-actions">
                    <button onClick={() => navigate('/settings')} className="glass-action-btn delete-btn">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="glass-action-btn" disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </header>

            {/* Main Panel */}
            <div className="plan-panel">
                <div className="panel-header-row">
                     <h2>Service Order</h2>
                </div>
                
                <OrderOfService 
                    items={items}
                    onOrderChange={setItems}
                    onDeleteItem={(id) => setItems(prev => prev.filter(i => i.id !== id))}
                    onEditItem={setEditingItem}
                    userRole="ORGANIZER"
                    showTimes={false} 
                />
                
                <button 
                    onClick={() => setIsAddItemVisible(true)} 
                    className="glass-btn-block"
                >
                  Add Service Item
                </button>
            </div>
        </div>

        {/* Modals using App.css global modal styles */}
        {isAddItemVisible && (
            <div className="modal-overlay" onClick={() => setIsAddItemVisible(false)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setIsAddItemVisible(false)}>&times;</button>
                    <DefaultPlanAddItemForm onAddItem={handleAddItem} onCancel={() => setIsAddItemVisible(false)} />
                </div>
            </div>
        )}

        {editingItem && (
            <div className="modal-overlay" onClick={() => setEditingItem(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setEditingItem(null)}>&times;</button>
                    <DefaultPlanEditItemForm 
                        itemToEdit={editingItem} 
                        onUpdateItem={(updated) => {
                            setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
                            setEditingItem(null);
                        }} 
                        onCancel={() => setEditingItem(null)} 
                    />
                </div>
            </div>
        )}
    </div>
  );
};

export default DefaultPlanPage;