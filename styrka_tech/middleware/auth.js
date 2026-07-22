/**
 * Dual-Mode JWT Authentication Handshake Middleware for Socket.IO
 */
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

  if (!token) {
    return next(new Error('Authentication error: Token is required'));
  }

  // 1. Production Mode: Local JWT signature check
  if (config.SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, config.SUPABASE_JWT_SECRET);
      socket.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.app_metadata?.role || decoded.user_metadata?.role || 'employee',
      };
      return next();
    } catch (err) {
      console.warn('[Auth Middleware] Local JWT check failed. Falling back to Supabase Auth API.');
    }
  }

  // 2. Development Mode: Fallback to Supabase Auth HTTP Request API
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      throw new Error(error ? error.message : 'Invalid session');
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    socket.user = {
      id: user.id,
      email: user.email,
      role: profile?.role || user.app_metadata?.role || 'employee',
    };
    
    return next();
  } catch (authError) {
    console.error('[Auth Middleware] Handshake authentication rejected:', authError.message);
    return next(new Error('Authentication error: Unauthorized connection'));
  }
};
