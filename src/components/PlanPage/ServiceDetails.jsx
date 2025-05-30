// src/components/PlanPage/ServiceDetails.js
import React from 'react';
import './ServiceDetails.css';

const ServiceDetails = ({ details }) => {
  if (!details) {
    return <p>Loading service details...</p>;
  }

  return (
    <div className="service-details-card">
      <h2>Event Information</h2>
      <p><strong>Date:</strong> {details.date}</p>
      <p><strong>Time:</strong> {details.time}</p>
      <p><strong>Theme:</strong> {details.theme || 'N/A'}</p>
      {details.notes && (
        <div className="service-notes">
          <strong>Notes:</strong>
          <p>{details.notes}</p>
        </div>
      )}
    </div>
  );
};

export default ServiceDetails;