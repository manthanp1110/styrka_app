const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, reason: 'Authentication error: Token is required' });
  }

  const token = authHeader.split(' ')[1];

  // 1. Production Mode: Local JWT signature check
  if (config.SUPABASE_JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, config.SUPABASE_JWT_SECRET);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.app_metadata?.role || decoded.user_metadata?.role || 'employee',
      };
      return next();
    } catch (err) {
      console.warn('[Express Auth] Local JWT check failed. Falling back to Supabase Auth API.');
    }
  }

  // 2. Development Mode: Fallback to Supabase Auth HTTP Request API
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, reason: error ? error.message : 'Invalid session' });
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    req.user = {
      id: user.id,
      email: user.email,
      role: profile?.role || user.app_metadata?.role || 'employee',
    };
    
    return next();
  } catch (authError) {
    console.error('[Express Auth] Authentication rejected:', authError.message);
    return res.status(401).json({ success: false, reason: 'Authentication error: Unauthorized connection' });
  }
};
