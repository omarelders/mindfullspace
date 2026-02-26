import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function InstallPrompt() {
  const { isAvailable, handleInstall } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('pwa_prompt_dismissed') === 'true';
  });

  useEffect(() => {
    if (isAvailable && !isDismissed) {
      // Show prompt after a short delay
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isAvailable, isDismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  const onInstallClick = () => {
    handleInstall();
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="install-prompt-container">
      <div className="install-prompt-card">
        <div className="install-prompt-content">
          <div className="install-prompt-icon">
            <Download size={20} />
          </div>
          <div className="install-prompt-text">
            <h3>Install Mindful Space</h3>
            <p>Get the full experience with our desktop app.</p>
          </div>
        </div>
        <div className="install-prompt-actions">
          <button className="install-button" onClick={onInstallClick}>
            Install
          </button>
          <button className="dismiss-button" onClick={handleDismiss} title="Dismiss">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
