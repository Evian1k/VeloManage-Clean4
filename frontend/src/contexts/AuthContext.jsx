import React, { createContext, useContext, useState, useEffect } from 'react';
import { ADMIN_CONFIG } from '@/lib/constants';
import { apiService } from '@/services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

  const ADMIN_USERS = ADMIN_CONFIG.EMAILS;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('autocare_token');
      const savedUser = localStorage.getItem('autocare_user');
      
      console.log('🔄 Initializing auth...', { hasToken: !!savedToken, hasUser: !!savedUser });
      
      if (savedToken && savedUser) {
        try {
          // First, load from saved data immediately for better UX
          const parsedUser = JSON.parse(savedUser);
          if (parsedUser && parsedUser.id) {
            console.log('📦 Loading user from localStorage:', parsedUser.email);
            setUser(parsedUser);
            apiService.setAuthToken(savedToken);
          }

          // Then verify token and get fresh data from backend
          const verifyResponse = await apiService.verifyToken();
          
          if (verifyResponse.success) {
            console.log('✅ Token verified, loading fresh profile...');
            
            try {
              // Get complete profile with messages and requests
              const profileResponse = await apiService.getProfile();
              
              if (profileResponse.success) {
                console.log('📊 Profile loaded:', {
                  user: profileResponse.data.user.email,
                  messages: profileResponse.data.messages?.length || 0,
                  bookings: profileResponse.data.bookings?.length || 0
                });
                
                const userData = {
                  ...profileResponse.data.user,
                  token: savedToken,
                  messages: profileResponse.data.messages || [],
                  bookings: profileResponse.data.bookings || [],
                  statistics: profileResponse.data.statistics || {}
                };
                
                setUser(userData);
                localStorage.setItem('autocare_user', JSON.stringify(userData));
                console.log('💾 User data updated successfully');
              } else {
                console.warn('⚠️ Profile loading failed, using basic user data');
                const userData = {
                  ...verifyResponse.user,
                  token: savedToken,
                  messages: parsedUser?.messages || [],
                  bookings: parsedUser?.bookings || [],
                  statistics: parsedUser?.statistics || {}
                };
                setUser(userData);
                localStorage.setItem('autocare_user', JSON.stringify(userData));
              }
            } catch (profileError) {
              console.warn('⚠️ Profile request failed, keeping saved data:', profileError.message);
              // Keep existing saved user data if profile loading fails
              if (parsedUser && parsedUser.id) {
                setUser(parsedUser);
              }
            }
          } else {
            console.warn('❌ Token verification failed');
            localStorage.removeItem('autocare_token');
            localStorage.removeItem('autocare_user');
            setUser(null);
          }
        } catch (error) {
          console.error('🚨 Auth initialization error:', error);
          
          // Fallback to saved user data if backend is unavailable
          try {
            const userData = JSON.parse(savedUser);
            if (userData && userData.id) {
              console.log('🔄 Using saved user data as fallback:', userData.email);
              setUser(userData);
              apiService.setAuthToken(savedToken);
            } else {
              console.warn('❌ Invalid saved data, clearing storage');
              localStorage.removeItem('autocare_token');
              localStorage.removeItem('autocare_user');
              setUser(null);
            }
          } catch (parseError) {
            console.error('🚨 Failed to parse saved user data:', parseError);
            localStorage.removeItem('autocare_token');
            localStorage.removeItem('autocare_user');
            setUser(null);
          }
        }
      } else {
        console.log('ℹ️ No saved auth data found');
        setUser(null);
      }
      
      setLoading(false);
      console.log('✅ Auth initialization complete');
    };
    
    initializeAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      
      // Use backend API for login
      const response = await apiService.login(email, password);
      
      if (response.success) {
        // Set auth token for future requests
        apiService.setAuthToken(response.token);
        
        // Get complete profile data after login
        try {
          const profileResponse = await apiService.getProfile();
          
          if (profileResponse.success) {
            console.log('📊 Login: Profile loaded successfully:', {
              user: profileResponse.data.user.email,
              messages: profileResponse.data.messages?.length || 0,
              bookings: profileResponse.data.bookings?.length || 0
            });
            
            const userData = {
              ...profileResponse.data.user,
              token: response.token,
              messages: profileResponse.data.messages || [],
              bookings: profileResponse.data.bookings || [],
              statistics: profileResponse.data.statistics || {}
            };
            
            setUser(userData);
            localStorage.setItem('autocare_token', response.token);
            localStorage.setItem('autocare_user', JSON.stringify(userData));
            console.log('💾 Login: Complete user data saved');
            
            return userData;
          }
        } catch (profileError) {
          console.warn('⚠️ Could not load profile data after login:', profileError);
        }
        
        // Fallback to basic user data
        const userData = {
          ...response.user,
          token: response.token
        };
        
        setUser(userData);
        localStorage.setItem('autocare_token', response.token);
        localStorage.setItem('autocare_user', JSON.stringify(userData));
        
        return userData;
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      
      // Use backend API for registration
      const response = await apiService.register(userData);
      
      if (response.success) {
        const newUserData = {
          ...response.user,
          token: response.token
        };
        
        // Set auth token for future requests
        apiService.setAuthToken(response.token);
        
        // Save to state and localStorage
        setUser(newUserData);
        localStorage.setItem('autocare_token', response.token);
        localStorage.setItem('autocare_user', JSON.stringify(newUserData));
        
        return newUserData;
      } else {
        // Enhanced error handling for duplicate emails
        const error = new Error(response.message || 'Registration failed');
        error.code = response.code;
        error.action = response.action;
        error.userType = response.userType;
        throw error;
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      // Enhanced error handling for better user experience
      if (error.message && error.message.includes('already been signed up')) {
        const enhancedError = new Error(error.message);
        enhancedError.code = 'EMAIL_ALREADY_EXISTS';
        enhancedError.action = 'redirect_to_login';
        throw enhancedError;
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkEmailAvailability = async (email) => {
    try {
      const response = await apiService.checkEmailAvailability(email);
      return response;
    } catch (error) {
      console.error('Error checking email availability:', error);
      return { success: false, available: true, message: 'Could not check email availability' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('autocare_user');
    localStorage.removeItem('autocare_token');
    apiService.setAuthToken(null);
  };

  const updateUser = async (updatedData) => {
    if (user) {
      try {
        // Update user data on backend
        const response = await apiService.updateProfile(updatedData);
        
        if (response.success) {
          const newUserData = { ...user, ...response.user };
          setUser(newUserData);
          localStorage.setItem('autocare_user', JSON.stringify(newUserData));
          return newUserData;
        } else {
          throw new Error(response.message || 'Update failed');
        }
      } catch (error) {
        console.error('Update user error:', error);
        // Fallback to local update
        const newUserData = { ...user, ...updatedData };
        setUser(newUserData);
        localStorage.setItem('autocare_user', JSON.stringify(newUserData));
        return newUserData;
      }
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    updateUser,
    checkEmailAvailability
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};