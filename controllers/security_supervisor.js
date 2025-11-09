import express from 'express';
import { authMiddleware } from './auth.js';
const router = express.Router();

// List supervisors (all roles can view)
router.get('/', authMiddleware(['ADMIN','ACCOUNTANT','HR']), async (req, res) => {
  try {
    const supervisors = await req.prisma.supervisor.findMany({ orderBy: { id: 'asc' }});
    res.json(supervisors);
  } catch (err) {
    console.error('List supervisors error:', err);
    res.status(500).json({ error: 'Failed to list supervisors' });
  }
});

// Create supervisor (ADMIN)
router.post('/', authMiddleware(['ADMIN']), async (req, res) => {
  try {
    const { name, phone, site } = req.body;
    const sup = await req.prisma.supervisor.create({ data: { name, phone: phone || null, site: site || null }});
    res.json(sup);
  } catch (err) {
    console.error('Create supervisor error:', err);
    res.status(500).json({ error: 'Failed to create supervisor' });
  }
});

// Update supervisor (ADMIN)
router.put('/:id', authMiddleware(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, site } = req.body;
    const updated = await req.prisma.supervisor.update({ where: { id }, data: { name, phone, site }});
    res.json(updated);
  } catch (err) {
    console.error('Update supervisor error:', err);
    res.status(500).json({ error: 'Failed to update supervisor' });
  }
});

// Delete supervisor (ADMIN)
router.delete('/:id', authMiddleware(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await req.prisma.supervisor.delete({ where: { id }});
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete supervisor error:', err);
    res.status(500).json({ error: 'Failed to delete supervisor' });
  }
});

export default router;
