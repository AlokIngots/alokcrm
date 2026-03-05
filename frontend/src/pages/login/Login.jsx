import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, tokenManager } from './api/auth';
import ECodeStep from './ECodeStep';
import OTPStep from './OTPStep';

const Login = () => {
  const [currentStep, setCurrentStep] = useState('ecode'); // 'ecode' or 'otp'
  const [sessionId, setSessionId] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [ecode, setEcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (tokenManager.isAuthenticated()) {
        try {
          // Verify token is still valid
          await authApi.getCurrentUser();
          // If successful, redirect to main app
          navigate('/dashboard');
        } catch (error) {
          // Token is invalid, remove it and continue with login
          tokenManager.removeToken();
        }
      }
    };

    checkAuth();
  }, [navigate]);

  // Clear error when changing steps
  useEffect(() => {
    setError(null);
  }, [currentStep]);

  /**
   * Handle ECode submission and send OTP
   */
  const handleECodeSubmit = async (ecodeValue) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.sendOTP(ecodeValue);
      
      // Extract phone number from message if available
      const phoneMatch = response.message.match(/(\d{4})$/);
      const extractedPhone = phoneMatch ? phoneMatch[1] : null;
      
      setSessionId(response.session_id);
      setPhoneNumber(extractedPhone);
      setEcode(ecodeValue);
      setCurrentStep('otp');
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle OTP verification
   */
  const handleOTPVerify = async (otpValue) => {
    setIsLoading(true);
    setError(null);

    try {
      await authApi.verifyOTP(sessionId, otpValue);
      
      // Authentication successful, redirect to main app
      navigate('/dashboard');
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle going back to ECode step
   */
  const handleBackToECode = () => {
    setCurrentStep('ecode');
    setSessionId(null);
    setPhoneNumber(null);
    setError(null);
  };

  /**
   * Handle OTP resend
   */
  const handleResendOTP = async (ecodeValue) => {
    setError(null);
    
    try {
      const response = await authApi.sendOTP(ecodeValue);
      setSessionId(response.session_id);
      
      // Show success message temporarily
      const originalError = error;
      setError('New OTP sent successfully');
      setTimeout(() => {
        setError(originalError);
      }, 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  // Render appropriate step
  if (currentStep === 'ecode') {
    return (
      <ECodeStep
        onNext={handleECodeSubmit}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  if (currentStep === 'otp') {
    return (
      <OTPStep
        onVerify={handleOTPVerify}
        onBack={handleBackToECode}
        onResendOTP={handleResendOTP}
        isLoading={isLoading}
        error={error}
        phoneNumber={phoneNumber}
        ecode={ecode}
      />
    );
  }

  // This should never happen, but just in case
  return null;
};

export default Login; 
