module.exports = (req, res) => {
  res.status(200).json({ ok: true, service: 'Kuandev API', time: new Date().toISOString() });
};
