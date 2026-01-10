const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

const authorizeDriver = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'driver' && req.user.role !== 'both') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Driver role required.'
    });
  }

  next();
};

const authorizeSelf = (req, res, next) => {
  const requestedUserId = parseInt(req.params.id || req.params.userId);

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.id !== requestedUserId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources.'
    });
  }

  next();
};

module.exports = {
  authorizeRole,
  authorizeDriver,
  authorizeSelf
};
