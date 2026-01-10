const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

const validateRegistration = (data) => {
  const errors = [];

  if (!data.full_name || data.full_name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }

  if (!data.email || !validateEmail(data.email)) {
    errors.push('Valid email is required');
  }

  if (!data.phone || !validatePhone(data.phone)) {
    errors.push('Valid phone number is required');
  }

  if (!data.password || data.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (data.role && !['driver', 'passenger', 'both'].includes(data.role)) {
    errors.push('Invalid role. Must be driver, passenger, or both');
  }

  return errors;
};

const validateLogin = (data) => {
  const errors = [];

  if (!data.email || !validateEmail(data.email)) {
    errors.push('Valid email is required');
  }

  if (!data.password) {
    errors.push('Password is required');
  }

  return errors;
};

module.exports = {
  validateEmail,
  validatePhone,
  validateRegistration,
  validateLogin
};
