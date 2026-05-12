import React from 'react';

export default function LoadingSpinner({ message = 'Loading…', fullScreen = false }) {
  if (fullScreen) {
    return (
      <div className="spinner-overlay">
        <div className="spinner-box">
          <div className="spinner" />
          <p className="spinner-message">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spinner-inline">
      <div className="spinner spinner--sm" />
      <span>{message}</span>
    </div>
  );
}
