import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const CreditsContext = createContext(null);

export const useCredits = () => {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error('useCredits must be used within CreditsProvider');
  return ctx;
};

export const CreditsProvider = ({ children }) => {
  const [showModal, setShowModal] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');

  const openCreditsModal = useCallback((detail) => {
    setErrorDetail(detail || 'Недостаточно кредитов для выполнения операции.');
    setShowModal(true);
  }, []);

  const closeCreditsModal = useCallback(() => {
    setShowModal(false);
    setErrorDetail('');
  }, []);

  // Global axios interceptor for 402 responses
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 402) {
          const detail = error.response?.data?.detail;
          openCreditsModal(detail);
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [openCreditsModal]);

  return (
    <CreditsContext.Provider value={{ showModal, errorDetail, openCreditsModal, closeCreditsModal }}>
      {children}
    </CreditsContext.Provider>
  );
};
