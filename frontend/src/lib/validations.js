// Form validation utilities
export const validators = {
  required: (value) => {
    if (!value || value.toString().trim() === '') {
      return 'This field is required';
    }
    return null;
  },

  email: (value) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  minLength: (min) => (value) => {
    if (!value) return null;
    if (value.toString().length < min) {
      return `Must be at least ${min} characters long`;
    }
    return null;
  },

  maxLength: (max) => (value) => {
    if (!value) return null;
    if (value.toString().length > max) {
      return `Must be no more than ${max} characters long`;
    }
    return null;
  },

  phone: (value) => {
    if (!value) return null;
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return 'Please enter a valid phone number';
    }
    return null;
  },

  licensePlate: (value) => {
    if (!value) return null;
    const plateRegex = /^[A-Z0-9\s]{3,10}$/i;
    if (!plateRegex.test(value.trim())) {
      return 'Please enter a valid license plate (3-10 characters, letters and numbers only)';
    }
    return null;
  },

  year: (value) => {
    if (!value) return null;
    const currentYear = new Date().getFullYear();
    const year = parseInt(value);
    if (isNaN(year) || year < 1900 || year > currentYear + 1) {
      return `Please enter a valid year between 1900 and ${currentYear + 1}`;
    }
    return null;
  },

  positive: (value) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      return 'Must be a positive number';
    }
    return null;
  },

  url: (value) => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return 'Please enter a valid URL';
    }
  },

  match: (matchField) => (value, allValues) => {
    if (!value) return null;
    if (value !== allValues[matchField]) {
      return 'Fields do not match';
    }
    return null;
  },

  password: (value) => {
    if (!value) return null;
    const errors = [];
    
    if (value.length < 8) {
      errors.push('at least 8 characters');
    }
    if (!/[A-Z]/.test(value)) {
      errors.push('one uppercase letter');
    }
    if (!/[a-z]/.test(value)) {
      errors.push('one lowercase letter');
    }
    if (!/\d/.test(value)) {
      errors.push('one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
      errors.push('one special character');
    }
    
    if (errors.length > 0) {
      return `Password must contain ${errors.join(', ')}`;
    }
    return null;
  }
};

// Validation schema system
export class ValidationSchema {
  constructor(rules) {
    this.rules = rules;
  }

  validate(data) {
    const errors = {};
    let isValid = true;

    for (const [field, fieldRules] of Object.entries(this.rules)) {
      const value = data[field];
      const fieldErrors = [];

      for (const rule of fieldRules) {
        const error = typeof rule === 'function' ? rule(value, data) : rule(value);
        if (error) {
          fieldErrors.push(error);
        }
      }

      if (fieldErrors.length > 0) {
        errors[field] = fieldErrors[0]; // Show only first error
        isValid = false;
      }
    }

    return { isValid, errors };
  }

  validateField(field, value, allData = {}) {
    const rules = this.rules[field];
    if (!rules) return null;

    for (const rule of rules) {
      const error = typeof rule === 'function' ? rule(value, allData) : rule(value);
      if (error) return error;
    }

    return null;
  }
}

// Pre-defined schemas for common forms
export const loginSchema = new ValidationSchema({
  email: [validators.required, validators.email],
  password: [validators.required]
});

export const registerSchema = new ValidationSchema({
  name: [validators.required, validators.minLength(2), validators.maxLength(50)],
  email: [validators.required, validators.email],
  password: [validators.required, validators.password],
  confirmPassword: [validators.required, validators.match('password')],
  phone: [validators.phone]
});

export const vehicleSchema = new ValidationSchema({
  make: [validators.required, validators.maxLength(50)],
  model: [validators.required, validators.maxLength(50)],
  year: [validators.required, validators.year],
  licensePlate: [validators.required, validators.licensePlate]
});

export const serviceRequestSchema = new ValidationSchema({
  serviceType: [validators.required],
  vehicleInfo: [validators.required],
  description: [validators.required, validators.minLength(10), validators.maxLength(500)],
  urgency: [validators.required],
  contactNumber: [validators.required, validators.phone]
});

export const settingsSchema = new ValidationSchema({
  name: [validators.required, validators.minLength(2), validators.maxLength(50)],
  email: [validators.required, validators.email],
  phone: [validators.phone]
});

// Sanitization functions
export const sanitizers = {
  trim: (value) => value ? value.toString().trim() : '',
  
  phone: (value) => {
    if (!value) return '';
    return value.replace(/[\s\-\(\)]/g, '');
  },
  
  licensePlate: (value) => {
    if (!value) return '';
    return value.toString().toUpperCase().trim();
  },
  
  name: (value) => {
    if (!value) return '';
    return value.toString().trim().replace(/\s+/g, ' ');
  },
  
  email: (value) => {
    if (!value) return '';
    return value.toString().toLowerCase().trim();
  }
};

// Form validation hook (for use with React)
export const useFormValidation = (schema, initialData = {}) => {
  const [data, setData] = React.useState(initialData);
  const [errors, setErrors] = React.useState({});
  const [touched, setTouched] = React.useState({});

  const validateField = (field, value) => {
    const error = schema.validateField(field, value, data);
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
    return !error;
  };

  const validateAll = () => {
    const result = schema.validate(data);
    setErrors(result.errors);
    return result.isValid;
  };

  const setFieldValue = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const setFieldTouched = (field, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
    if (isTouched) {
      validateField(field, data[field]);
    }
  };

  const reset = (newData = initialData) => {
    setData(newData);
    setErrors({});
    setTouched({});
  };

  return {
    data,
    errors,
    touched,
    setFieldValue,
    setFieldTouched,
    validateField,
    validateAll,
    reset,
    isValid: Object.keys(errors).length === 0
  };
};

export default {
  validators,
  ValidationSchema,
  loginSchema,
  registerSchema,
  vehicleSchema,
  serviceRequestSchema,
  settingsSchema,
  sanitizers,
  useFormValidation
};