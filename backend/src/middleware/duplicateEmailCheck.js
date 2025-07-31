import User from '../models/User.js';

/**
 * Middleware to check for duplicate email registration
 * Returns user-friendly message when email already exists
 */
export const checkDuplicateEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next();
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      console.log('Duplicate registration attempt for email:', email);
      
      // Determine if it's an admin or regular user
      const isAdminEmail = User.isAdminEmail(email);
      
      let message;
      if (isAdminEmail) {
        message = 'This admin email has already been registered. Please try signing in instead.';
      } else {
        message = 'You have already been signed up with this email. Try signing in instead.';
      }
      
      return res.status(409).json({
        success: false,
        message: message,
        code: 'EMAIL_ALREADY_EXISTS',
        action: 'redirect_to_login',
        userType: isAdminEmail ? 'admin' : 'user',
        loginUrl: '/login'
      });
    }
    
    // Email is available, continue with registration
    next();
    
  } catch (error) {
    console.error('Error checking duplicate email:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking email availability'
    });
  }
};

/**
 * Utility function to check if email exists
 * Can be used in other parts of the application
 */
export const emailExists = async (email) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    return !!user;
  } catch (error) {
    console.error('Error checking email existence:', error);
    return false;
  }
};

/**
 * API endpoint to check email availability
 * Can be called from frontend for real-time validation
 */
export const checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email parameter is required'
      });
    }

    const exists = await emailExists(email);
    const isAdminEmail = User.isAdminEmail(email);
    
    return res.json({
      success: true,
      available: !exists,
      exists: exists,
      isAdminEmail: isAdminEmail,
      message: exists ? 
        (isAdminEmail ? 
          'This admin email is already registered' : 
          'This email is already registered'
        ) : 
        'Email is available'
    });
    
  } catch (error) {
    console.error('Error checking email availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking email availability'
    });
  }
};