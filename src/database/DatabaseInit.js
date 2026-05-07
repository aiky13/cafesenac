import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('cafeteste.db');

export function DatabaseInit() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      cpf TEXT UNIQUE NOT NULL,
      telefone TEXT,
      senha TEXT NOT NULL,
      pontos REAL DEFAULT 0,
      foto_perfil TEXT
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL NOT NULL,
      categoria TEXT NOT NULL,
      imagem TEXT,
      estoque INTEGER NOT NULL DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS favoritos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      UNIQUE(usuario_id, produto_id)
    );

    CREATE TABLE IF NOT EXISTS enderecos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      apelido TEXT DEFAULT 'Casa',
      cep TEXT,
      rua TEXT,
      numero TEXT,
      complemento TEXT,
      bairro TEXT,
      cidade TEXT,
      estado TEXT,
      principal INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cartoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      bandeira TEXT NOT NULL,
      numero_final TEXT NOT NULL,
      nome_titular TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS carrinho (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 1,
      UNIQUE(usuario_id, produto_id)
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      data TEXT NOT NULL,
      total REAL NOT NULL,
      total_original REAL DEFAULT 0,
      status TEXT NOT NULL,
      forma_pagamento TEXT,
      tipo_entrega TEXT,
      horario_retirada TEXT,
      endereco_entrega TEXT,
      nota_fiscal INTEGER,
      troco REAL DEFAULT 0,
      desconto_pontos REAL DEFAULT 0,
      cupom TEXT,
      desconto_cupom REAL DEFAULT 0,
      pontos_ganhos REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pedido_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      produto_nome TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      preco_unit REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      desconto REAL NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'fixo',
      ativo INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS avaliacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      nota INTEGER NOT NULL CHECK(nota >= 1 AND nota <= 5),
      comentario TEXT,
      data TEXT NOT NULL,
      UNIQUE(usuario_id, produto_id)
    );
  `);

  // ── Migrações seguras ────────────────────────────────────────────
  try { db.execSync(`ALTER TABLE usuarios ADD COLUMN pontos REAL DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE usuarios ADD COLUMN foto_perfil TEXT`); } catch (_) {}
  try { db.execSync(`ALTER TABLE produtos ADD COLUMN estoque INTEGER NOT NULL DEFAULT 10`); } catch (_) {}
  try { db.execSync(`ALTER TABLE produtos ADD COLUMN promocao INTEGER DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE enderecos ADD COLUMN apelido TEXT DEFAULT 'Casa'`); } catch (_) {}
  try { db.execSync(`ALTER TABLE enderecos ADD COLUMN principal INTEGER DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN usuario_id INTEGER`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN troco REAL DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN nota_fiscal INTEGER`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN forma_pagamento TEXT`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN tipo_entrega TEXT`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN horario_retirada TEXT`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN endereco_entrega TEXT`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN desconto_pontos REAL DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN cupom TEXT`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN desconto_cupom REAL DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN pontos_ganhos REAL DEFAULT 0`); } catch (_) {}
  try { db.execSync(`ALTER TABLE pedidos ADD COLUMN total_original REAL DEFAULT 0`); } catch (_) {}
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS avaliacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        produto_id INTEGER NOT NULL,
        nota INTEGER NOT NULL CHECK(nota >= 1 AND nota <= 5),
        comentario TEXT,
        data TEXT NOT NULL,
        UNIQUE(usuario_id, produto_id)
      );
    `);
  } catch (_) {}

  // ── Seed produtos ────────────────────────────────────────────────
  const count = db.getFirstSync('SELECT COUNT(*) as total FROM produtos');
  if (count.total === 0) {
    db.execSync(`
      INSERT INTO produtos (nome, descricao, preco, categoria, imagem, estoque) VALUES
      ('Cafe Espresso','Encorpado e intenso',7.00,'Bebidas','https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?q=80&w=500',15),
      ('Cappuccino','Com espuma cremosa',10.00,'Bebidas','https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=500',12),
      ('Latte','Suave com leite vaporizado',12.00,'Bebidas','https://images.unsplash.com/photo-1561047029-3000c68339ca?q=80&w=500',10),
      ('Mocha','Cafe com chocolate',13.50,'Bebidas','https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?q=80&w=500',8),
      ('Pao de Queijo','Quentinho e crocante',6.00,'Lanches','https://images.unsplash.com/photo-1598103442097-8b74394b95c1?q=80&w=500',20),
      ('Croissant','Folhado e amanteigado',8.50,'Lanches','https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=500',15),
      ('Brownie','Chocolate intenso',9.00,'Sobremesas','https://images.unsplash.com/photo-1564355808539-22fda35bed7e?q=80&w=500',10),
      ('Cheesecake','Cremoso com calda de frutas',14.00,'Sobremesas','https://images.unsplash.com/photo-1533134242443-d4fd215305ad?q=80&w=500',6);
    `);
  }

  // ── Seed cupons ──────────────────────────────────────────────────
  try {
    const cupCount = db.getFirstSync('SELECT COUNT(*) as total FROM cupons');
    if (cupCount.total === 0) {
      db.execSync(`
        INSERT INTO cupons (codigo, desconto, tipo) VALUES
        ('CAFE10', 10.00, 'fixo'),
        ('BEMVINDO', 5.00, 'fixo'),
        ('DESC15', 15.00, 'fixo');
      `);
    }
  } catch (_) {}
}

export default db;