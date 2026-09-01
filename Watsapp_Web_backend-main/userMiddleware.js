const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123!';

/**
 * Resolve tenant user id for multi-tenant data isolation.
 * Priority: verified JWT > x-user-id header > body/query (only when no JWT).
 * Never defaults to user 1 — missing auth leaves req.userId unset.
 */
const extractUserId = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const customHeader = req.headers['x-user-id'];
  const bodyId = req.body?.userId || req.body?.user_id;
  const queryId = req.query?.userId || req.query?.user_id;

  const applyUserId = (id) => {
    const parsed = parseInt(id, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      req.userId = parsed;
    }
  };

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err && user && user.id) {
        req.user = user;
        req.userId = parseInt(user.id, 10);
      } else if (customHeader) {
        applyUserId(customHeader);
      } else if (bodyId) {
        applyUserId(bodyId);
      } else if (queryId) {
        applyUserId(queryId);
      }
      next();
    });
    return;
  }

  if (customHeader) {
    applyUserId(customHeader);
  } else if (bodyId) {
    applyUserId(bodyId);
  } else if (queryId) {
    applyUserId(queryId);
  }
  next();
};

/** Require a resolved tenant id (use after authenticateToken or extractUserId). */
const requireUserId = (req, res, next) => {
  const userId = req.user?.id || req.userId;
  if (!userId) {
    return res.status(401).json({
      error: true,
      message: 'Authentication required',
      data: null,
    });
  }
  req.userId = parseInt(userId, 10);
  next();
};

module.exports = {
  extractUserId,
  requireUserId,
};
