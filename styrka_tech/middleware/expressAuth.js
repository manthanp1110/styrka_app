module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : 'emp_1';

  req.user = {
    id: token || 'emp_1',
    email: 'employee@styrka.com',
    role: 'employee',
  };

  return next();
};

