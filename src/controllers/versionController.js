const path = require('path');
const fs = require('fs');

exports.get = (req, res) => {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgRaw);
    return res.json({
      name: pkg.name || null,
      version: pkg.version || null,
      nodeEnv: process.env.NODE_ENV || 'development',
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erro ao ler versão:', err);
    return res.status(500).json({ error: 'Erro ao obter versão' });
  }
};
