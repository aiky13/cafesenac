import db from '../database/DatabaseInit';

// ── Regras de pontos ──────────────────────────────────────────────
// 10% do valor da compra vira pontos (1 ponto = R$ 0,01)
// Ex: compra de R$ 20,00 → 200 pontos ganhos
// Resgate mínimo: 500 pontos = R$ 5,00 de desconto
// Múltiplos de 500 pontos podem ser usados (500 = R$5, 1000 = R$10, etc.)

export const PONTOS_POR_REAL = 10;           // 10 pontos por R$1 gasto (= 10% em pontos)
export const PONTOS_PARA_RESGATAR = 500;     // mínimo para resgatar
export const VALOR_RESGATE = 5.00;           // R$ 5,00 a cada 500 pontos

const DataService = {
  // ── Produtos / Favoritos ────────────────────────────────────────
  getFavoritos: (userId) => {
    try {
      return db.getAllSync(
        `SELECT p.* FROM produtos p 
         INNER JOIN favoritos f ON p.id = f.produto_id 
         WHERE f.usuario_id = ?`,
        [userId]
      ) || [];
    } catch (error) {
      console.error("Erro getFavoritos:", error);
      return [];
    }
  },

  getContadorFavoritos: (userId) => {
    try {
      const row = db.getFirstSync(
        'SELECT COUNT(*) as total FROM favoritos WHERE usuario_id = ?',
        [userId]
      );
      return row?.total || 0;
    } catch (error) {
      return 0;
    }
  },

  getProdutos: (categoria = 'Todas') => {
    try {
      let query = 'SELECT * FROM produtos';
      let params = [];
      if (categoria !== 'Todas') {
        query += ' WHERE categoria = ?';
        params.push(categoria);
      }
      const data = db.getAllSync(query, params);
      return data || [];
    } catch (error) {
      console.error("Erro DataService:", error);
      return [];
    }
  },

  toggleFavorito: (userId, pId) => {
    try {
      const existe = db.getFirstSync('SELECT * FROM favoritos WHERE usuario_id = ? AND produto_id = ?', [userId, pId]);
      if (existe) {
        db.runSync('DELETE FROM favoritos WHERE usuario_id = ? AND produto_id = ?', [userId, pId]);
      } else {
        db.runSync('INSERT INTO favoritos (usuario_id, produto_id) VALUES (?, ?)', [userId, pId]);
      }
    } catch (error) {
      console.error("Erro Toggle:", error);
    }
  },

  // ── Pedidos ─────────────────────────────────────────────────────
  getContadorPedidos: (userId) => {
    try {
      const row = db.getFirstSync(
        'SELECT COUNT(*) as total FROM pedidos WHERE usuario_id = ?',
        [userId]
      );
      return row?.total || 0;
    } catch (error) {
      return 0;
    }
  },

  // ── Pontos ──────────────────────────────────────────────────────
  getSaldoPontos: (userId) => {
    try {
      const row = db.getFirstSync('SELECT saldo FROM pontos WHERE usuario_id = ?', [userId]);
      return row?.saldo || 0;
    } catch (error) {
      return 0;
    }
  },

  // Quantos "blocos de resgate" o usuário pode usar e o desconto total
  calcularResgate: (saldo) => {
    const blocos = Math.floor(saldo / PONTOS_PARA_RESGATAR);
    const desconto = blocos * VALOR_RESGATE;
    const pontosUsados = blocos * PONTOS_PARA_RESGATAR;
    return { blocos, desconto, pontosUsados };
  },

  // Calcula quantos pontos uma compra vai gerar
  calcularPontosGanhos: (valorCompra) => {
    return Math.floor(valorCompra * PONTOS_POR_REAL);
  },

  // Adiciona pontos ao saldo (upsert)
  adicionarPontos: (userId, quantidade) => {
    try {
      const existe = db.getFirstSync('SELECT id FROM pontos WHERE usuario_id = ?', [userId]);
      if (existe) {
        db.runSync('UPDATE pontos SET saldo = saldo + ? WHERE usuario_id = ?', [quantidade, userId]);
      } else {
        db.runSync('INSERT INTO pontos (usuario_id, saldo) VALUES (?, ?)', [userId, quantidade]);
      }
    } catch (error) {
      console.error("Erro adicionarPontos:", error);
    }
  },

  // Debita pontos do saldo
  debitarPontos: (userId, quantidade) => {
    try {
      db.runSync(
        'UPDATE pontos SET saldo = MAX(0, saldo - ?) WHERE usuario_id = ?',
        [quantidade, userId]
      );
    } catch (error) {
      console.error("Erro debitarPontos:", error);
    }
  },

  // ── Cupons ──────────────────────────────────────────────────────
  validarCupom: (codigo) => {
    try {
      const cupom = db.getFirstSync(
        'SELECT * FROM cupons WHERE codigo = ? AND ativo = 1',
        [codigo.trim().toUpperCase()]
      );
      return cupom || null;
    } catch (error) {
      console.error("Erro validarCupom:", error);
      return null;
    }
  },

  calcularDescontoCupom: (cupom, total) => {
    if (!cupom) return 0;
    if (cupom.tipo === 'percentual') {
      return parseFloat(((cupom.desconto / 100) * total).toFixed(2));
    }
    // fixo
    return Math.min(cupom.desconto, total);
  },

  // ── Usuário ─────────────────────────────────────────────────────
  excluirUsuario: (userId) => {
    try {
      db.runSync('DELETE FROM favoritos WHERE usuario_id = ?', [userId]);
      db.runSync('DELETE FROM pontos WHERE usuario_id = ?', [userId]);
      db.runSync('DELETE FROM usuarios WHERE id = ?', [userId]);
    } catch (error) {
      console.error("Erro excluirUsuario:", error);
    }
  }
};

export default DataService;