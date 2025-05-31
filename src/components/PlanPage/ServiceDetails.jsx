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
      <p><strong>Date:</strong> {new Date(details.date).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}</p>

      <p><strong>Time:</strong> {new Date(`1970-01-01T${details.time}Z`).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })}</p>
      {details.theme && (<p><strong>Theme:</strong> {details.theme}</p>)}
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