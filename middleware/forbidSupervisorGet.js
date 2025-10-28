export function forbidSupervisorGet(req, res, next) {
  if (req.session?.user?.role === 'security_supervisor' && req.method === 'GET') {
    return res.status(403).json({ error: 'Forbidden: supervisors cannot view this data' });
  }
  next();
}