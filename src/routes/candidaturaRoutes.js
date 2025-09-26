const express = require('express');
const router = express.Router();
const candidaturaController = require('../controllers/candidaturaController');
const { authMiddleware, empresaMiddleware } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

// Candidato se candidata a uma vaga (precisa estar autenticado)
// Aceita múltiplos arquivos: curriculo (opcional), documentoFrente (obrigatório), documentoVerso (obrigatório)
router.post(
  '/',
  authMiddleware,
  upload.fields([
    { name: 'curriculo', maxCount: 1 },
    { name: 'documentoFrente', maxCount: 1 },
    { name: 'documentoVerso', maxCount: 1 },
  ]),
  candidaturaController.criar
);

// Candidato lista suas próprias candidaturas
router.get('/usuario', authMiddleware, candidaturaController.listarPorUsuario);

// Empresa lista candidaturas de uma vaga
router.get('/vaga/:vagaId', authMiddleware, empresaMiddleware, candidaturaController.listarPorVaga);

// Empresa lista candidaturas de todas as suas vagas
router.get('/empresa', authMiddleware, empresaMiddleware, candidaturaController.listarPorEmpresa);

// Ver detalhe de uma candidatura (empresa ou candidato)
router.get('/:id', authMiddleware, candidaturaController.detalhe);

// Empresa atualiza fase da candidatura
router.put('/:id/fase', authMiddleware, empresaMiddleware, candidaturaController.atualizarFase);

// Empresa busca candidaturas com filtros de fase
router.get('/empresa/filtradas', authMiddleware, empresaMiddleware, candidaturaController.candidaturasPorEmpresa);

// Estatísticas de candidaturas por fase para empresa
router.get('/empresa/estatisticas', authMiddleware, empresaMiddleware, candidaturaController.estatisticasEmpresa);

// Obter histórico de fases de uma candidatura
router.get('/:id/historico', authMiddleware, candidaturaController.historicoFases);

// Candidato cancela sua candidatura
router.delete('/:id', authMiddleware, candidaturaController.cancelar);

module.exports = router; 