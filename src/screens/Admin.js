import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Platform, FlatList, TextInput, Alert, Modal, RefreshControl, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import db from '../database/DatabaseInit';
import { C, S } from '../theme';

const SENHA_ADMIN = 'admin123';

const STATUS_LISTA = ['Em Preparo', 'Pronto', 'Saiu para Entrega', 'Entregue', 'Cancelado'];
const STATUS_COR = {
  'Em Preparo':        '#F39C12',
  'Pronto':            '#27ae60',
  'Saiu para Entrega': '#2980b9',
  'Entregue':          '#6F4E37',
  'Cancelado':         '#E74C3C',
};
const CATEGORIAS = ['Bebidas', 'Lanches', 'Sobremesas'];

// ── Produto vazio para novo cadastro ─────────────────────────────
const PROD_VAZIO = { nome: '', descricao: '', preco: '', categoria: 'Bebidas', imagem: '', estoque: '' };

export default function Admin({ navigation, route }) {
  const [autenticado, setAutenticado] = useState(route.params?.autenticado === true);
  const [senha, setSenha]             = useState('');
  const [aba, setAba]                 = useState('pedidos');
  const [pedidos, setPedidos]         = useState([]);
  const [produtos, setProdutos]       = useState([]);
  const [stats, setStats]             = useState({});
  const [refreshing, setRefreshing]   = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('Todos');

  // Notas fiscais
  const [notas, setNotas]               = useState([]);
  const [buscaNF, setBuscaNF]           = useState('');
  const [filtroNota, setFiltroNota]     = useState('Todos');
  const [modalNF, setModalNF]           = useState(false);
  const [notaSel, setNotaSel]           = useState(null);
  const [itensPedidoNF, setItensPedidoNF] = useState([]);

  // Modais
  const [modalStatus, setModalStatus] = useState(false);
  const [pedidoSel, setPedidoSel]     = useState(null);

  const [modalProd, setModalProd]     = useState(false);
  const [prodSel, setProdSel]         = useState(null);   // null = novo; objeto = editar

  const [modalAval, setModalAval]     = useState(false);
  const [avaliacoes, setAvaliacoes]   = useState([]);
  const [prodAvalNome, setProdAvalNome] = useState('');

  // ── Carga ──────────────────────────────────────────────────────
  const carregar = useCallback(() => {
    try {
      const peds = db.getAllSync(`
        SELECT p.*, u.nome as cliente_nome, u.email as cliente_email, u.telefone as cliente_tel
        FROM pedidos p LEFT JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.id DESC`);
      setPedidos(peds || []);

      const prods = db.getAllSync('SELECT * FROM produtos ORDER BY categoria, nome');
      setProdutos(prods || []);

      // Notas fiscais — todos os pedidos com nota_fiscal preenchida
      const nfs = db.getAllSync(`
        SELECT p.*, u.nome as cliente_nome, u.email as cliente_email, u.telefone as cliente_tel
        FROM pedidos p
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        WHERE p.nota_fiscal IS NOT NULL
        ORDER BY p.nota_fiscal DESC`);
      setNotas(nfs || []);

      const totalPedidos  = db.getFirstSync('SELECT COUNT(*) as c FROM pedidos')?.c || 0;
      const totalReceita  = db.getFirstSync('SELECT SUM(total) as s FROM pedidos WHERE status != "Cancelado"')?.s || 0;
      const totalCancelado = db.getFirstSync('SELECT COUNT(*) as c, SUM(total) as s FROM pedidos WHERE status = "Cancelado"') || {};
      const totalUsuarios = db.getFirstSync('SELECT COUNT(*) as c FROM usuarios')?.c || 0;
      const emPreparo     = db.getFirstSync("SELECT COUNT(*) as c FROM pedidos WHERE status = 'Em Preparo'")?.c || 0;
      const maisVendido   = db.getFirstSync(`
        SELECT produto_nome, SUM(quantidade) as qtd
        FROM pedido_itens GROUP BY produto_nome ORDER BY qtd DESC LIMIT 1`);
      setStats({ totalPedidos, totalReceita, totalUsuarios, emPreparo, maisVendido, totalCancelado });
    } catch (e) { console.error('Admin carregar:', e); }
  }, []);

  useEffect(() => { if (autenticado) carregar(); }, [autenticado]);

  const onRefresh = () => { setRefreshing(true); carregar(); setRefreshing(false); };

  // ── Login ──────────────────────────────────────────────────────
  if (!autenticado) {
    return (
      <SafeAreaView style={styles.loginSafe}>
        <View style={styles.loginBox}>
          <View style={styles.loginIconBox}>
            <Ionicons name="shield-checkmark" size={48} color="#6F4E37" />
          </View>
          <Text style={styles.loginTitulo}>Área Administrativa</Text>
          <Text style={styles.loginSub}>CaféSenac</Text>
          <TextInput
            style={styles.loginInput}
            placeholder="Senha de acesso"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
            onSubmitEditing={() => {
              if (senha === SENHA_ADMIN) setAutenticado(true);
              else Alert.alert('Acesso negado', 'Senha incorreta.');
            }}
          />
          <TouchableOpacity style={styles.loginBtn} onPress={() => {
            if (senha === SENHA_ADMIN) setAutenticado(true);
            else Alert.alert('Acesso negado', 'Senha incorreta.');
          }}>
            <Ionicons name="log-in-outline" size={20} color="#FFF" />
            <Text style={styles.loginBtnTxt}>ENTRAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 20 }} onPress={() => navigation.goBack()}>
            <Text style={{ color: C.textMuted, fontSize: 13 }}>← Voltar ao app</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Atualizar status pedido ────────────────────────────────────
  const atualizarStatus = (novoStatus) => {
    try {
      db.runSync('UPDATE pedidos SET status = ? WHERE id = ?', [novoStatus, pedidoSel.id]);
      setModalStatus(false); setPedidoSel(null); carregar();
      Alert.alert('✓ Status atualizado!', `Pedido #${pedidoSel.id} → ${novoStatus}`);
    } catch (e) { Alert.alert('Erro', 'Não foi possível atualizar.'); }
  };

  // ── Salvar produto (novo ou editar) ───────────────────────────
  const salvarProduto = () => {
    const { nome, descricao, preco, categoria, imagem, estoque } = prodSel;
    const precoNum = parseFloat(String(preco).replace(',', '.'));
    const estNum   = parseInt(estoque);
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome do produto.');
    if (isNaN(precoNum) || precoNum <= 0) return Alert.alert('Atenção', 'Preço inválido.');
    if (isNaN(estNum) || estNum < 0) return Alert.alert('Atenção', 'Estoque inválido.');

    try {
      if (prodSel.id) {
        // Editar existente
        db.runSync(
          'UPDATE produtos SET nome=?, descricao=?, preco=?, categoria=?, imagem=?, estoque=?, promocao=? WHERE id=?',
          [nome.trim(), descricao.trim(), precoNum, categoria, imagem.trim(), estNum, prodSel.promocao ? 1 : 0, prodSel.id]
        );
        Alert.alert('✓ Produto atualizado!');
      } else {
        // Novo produto
        db.runSync(
          'INSERT INTO produtos (nome, descricao, preco, categoria, imagem, estoque, promocao) VALUES (?,?,?,?,?,?,0)',
          [nome.trim(), descricao.trim(), precoNum, categoria, imagem.trim(), estNum]
        );
        Alert.alert('✓ Produto criado!');
      }
      setModalProd(false); setProdSel(null); carregar();
    } catch (e) { Alert.alert('Erro', 'Não foi possível salvar.'); }
  };

  // ── Excluir produto ────────────────────────────────────────────
  const excluirProduto = () => {
    Alert.alert('Excluir produto', `Deseja excluir "${prodSel.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: () => {
          try {
            db.runSync('DELETE FROM produtos WHERE id = ?', [prodSel.id]);
            setModalProd(false); setProdSel(null); carregar();
          } catch { Alert.alert('Erro', 'Não foi possível excluir.'); }
        }
      }
    ]);
  };

  // ── Ver avaliações de um produto ──────────────────────────────
  const verAvaliacoes = (prod) => {
    try {
      // Migração segura: garante coluna promocao
      try { db.execSync('ALTER TABLE produtos ADD COLUMN promocao INTEGER DEFAULT 0'); } catch (_) {}

      const avs = db.getAllSync(`
        SELECT a.*, u.nome as usuario_nome
        FROM avaliacoes a
        LEFT JOIN usuarios u ON a.usuario_id = u.id
        WHERE a.produto_id = ?
        ORDER BY a.data DESC`, [prod.id]);
      setAvaliacoes(avs || []);
      setProdAvalNome(prod.nome);
      setModalAval(true);
    } catch (e) { Alert.alert('Erro', 'Não foi possível carregar avaliações.'); }
  };

  // ── Helpers ────────────────────────────────────────────────────
  const abrirEditar = (item) => {
    // Migração segura para coluna promocao
    try { db.execSync('ALTER TABLE produtos ADD COLUMN promocao INTEGER DEFAULT 0'); } catch (_) {}
    setProdSel({
      ...item,
      preco: String(item.preco ?? ''),
      estoque: String(item.estoque ?? ''),
      promocao: item.promocao === 1,
    });
    setModalProd(true);
  };

  const abrirNovo = () => {
    try { db.execSync('ALTER TABLE produtos ADD COLUMN promocao INTEGER DEFAULT 0'); } catch (_) {}
    setProdSel({ ...PROD_VAZIO, promocao: false });
    setModalProd(true);
  };

  // ── Abrir nota fiscal ──────────────────────────────────────────
  const abrirNota = (nota) => {
    try {
      const itens = db.getAllSync(
        'SELECT * FROM pedido_itens WHERE pedido_id = ?', [nota.id]
      );
      setItensPedidoNF(itens || []);
      setNotaSel(nota);
      setModalNF(true);
    } catch (e) { Alert.alert('Erro', 'Não foi possível carregar a nota.'); }
  };

  // ── Filtro de busca das notas ──────────────────────────────────
  const notasFiltradas = notas.filter(n => {
    // Filtro de status
    if (filtroNota !== 'Todos' && n.status !== filtroNota) return false;
    // Filtro de busca
    if (!buscaNF.trim()) return true;
    const q = buscaNF.toLowerCase();
    const nfStr = String(n.nota_fiscal || '').padStart(5, '0');
    return (
      nfStr.includes(q) ||
      (n.cliente_nome || '').toLowerCase().includes(q) ||
      (n.cliente_email || '').toLowerCase().includes(q) ||
      String(n.id).includes(q)
    );
  });

  // ── Helpers de formatação ──────────────────────────────────────
  const fmtNF   = (n) => `NF-${String(n || 0).padStart(5, '0')}`;
  const fmtMoeda = (v) => `R$ ${Number(v || 0).toFixed(2)}`;

  const pedidosFiltrados = filtroStatus === 'Todos'
    ? pedidos
    : pedidos.filter(p => p.status === filtroStatus);

  // ── Estrelas ────────────────────────────────────────────────────
  const Estrelas = ({ nota }) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons key={i} name={i <= nota ? 'star' : 'star-outline'} size={14} color="#F39C12" />
      ))}
    </View>
  );

  // ════════════════════════════════════════════════════════════════
  // MODAL STATUS PEDIDO
  // ════════════════════════════════════════════════════════════════
  const ModalStatus = () => (
    <Modal visible={modalStatus} transparent animationType="slide">
      <View style={styles.overlay}>
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={styles.modalTitulo}>Pedido #{pedidoSel?.id}</Text>
          <Text style={styles.modalSub}>Cliente: {pedidoSel?.cliente_nome || '—'}</Text>
          <Text style={styles.modalSub}>Total: R$ {pedidoSel?.total?.toFixed(2)}</Text>
          <Text style={styles.modalSub}>Pagamento: {pedidoSel?.forma_pagamento}</Text>
          <Text style={styles.modalSub}>
            {pedidoSel?.tipo_entrega === 'retirada'
              ? `Retirada: ${pedidoSel?.horario_retirada}`
              : `Entrega: ${pedidoSel?.endereco_entrega}`}
          </Text>
          <Text style={[styles.modalSub, { fontWeight: 'bold', marginTop: 10 }]}>Itens:</Text>
          {(() => {
            try {
              const itens = db.getAllSync('SELECT * FROM pedido_itens WHERE pedido_id = ?', [pedidoSel?.id]);
              return itens.map((it, i) => (
                <Text key={i} style={styles.modalSub}>
                  • {it.quantidade}x {it.produto_nome} — R$ {(it.quantidade * it.preco_unit).toFixed(2)}
                </Text>
              ));
            } catch { return null; }
          })()}
          <Text style={[styles.modalSub, { fontWeight: 'bold', marginTop: 14 }]}>
            Status atual: <Text style={{ color: STATUS_COR[pedidoSel?.status] }}>{pedidoSel?.status}</Text>
          </Text>
          <Text style={[styles.modalSub, { marginBottom: 10 }]}>Alterar para:</Text>
          {STATUS_LISTA.map(s => (
            <TouchableOpacity key={s}
              style={[styles.statusBtn, { borderColor: STATUS_COR[s] },
                pedidoSel?.status === s && { backgroundColor: STATUS_COR[s] }]}
              onPress={() => atualizarStatus(s)}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COR[s] }]} />
              <Text style={[styles.statusBtnTxt, pedidoSel?.status === s && { color: C.white, fontWeight: 'bold' }]}>{s}</Text>
              {pedidoSel?.status === s && <Ionicons name="checkmark" size={16} color="#FFF" />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.modalFechar} onPress={() => setModalStatus(false)}>
            <Text style={{ color: C.textMuted, fontWeight: '600' }}>Fechar</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );

  // ════════════════════════════════════════════════════════════════
  // MODAL PRODUTO (criar / editar)
  // ════════════════════════════════════════════════════════════════
  const ModalProduto = () => {
    if (!prodSel) return null;
    const isNovo = !prodSel.id;

    // estados locais controlados para evitar re-renders no campo de unidades
    const [localEstoque, setLocalEstoque] = useState(String(prodSel.estoque ?? ''));
    const [localPreco,   setLocalPreco]   = useState(String(prodSel.preco ?? ''));
    const [localNome,    setLocalNome]     = useState(prodSel.nome ?? '');
    const [localDesc,    setLocalDesc]     = useState(prodSel.descricao ?? '');
    const [localImg,     setLocalImg]      = useState(prodSel.imagem ?? '');
    const [localCat,     setLocalCat]      = useState(prodSel.categoria ?? 'Bebidas');
    const [localPromo,   setLocalPromo]    = useState(!!prodSel.promocao);

    const handleSalvar = () => {
      const payload = {
        ...prodSel,
        nome: localNome,
        descricao: localDesc,
        preco: localPreco,
        categoria: localCat,
        imagem: localImg,
        estoque: localEstoque,
        promocao: localPromo,
      };
      // valida e salva
      const precoNum = parseFloat(String(localPreco).replace(',', '.'));
      const estNum   = parseInt(localEstoque);
      if (!localNome.trim()) return Alert.alert('Atenção', 'Informe o nome do produto.');
      if (isNaN(precoNum) || precoNum <= 0) return Alert.alert('Atenção', 'Preço inválido.');
      if (isNaN(estNum) || estNum < 0) return Alert.alert('Atenção', 'Estoque inválido.');

      try {
        if (prodSel.id) {
          db.runSync(
            'UPDATE produtos SET nome=?, descricao=?, preco=?, categoria=?, imagem=?, estoque=?, promocao=? WHERE id=?',
            [localNome.trim(), localDesc.trim(), precoNum, localCat, localImg.trim(), estNum, localPromo ? 1 : 0, prodSel.id]
          );
          Alert.alert('✓ Produto atualizado!');
        } else {
          db.runSync(
            'INSERT INTO produtos (nome, descricao, preco, categoria, imagem, estoque, promocao) VALUES (?,?,?,?,?,?,?)',
            [localNome.trim(), localDesc.trim(), precoNum, localCat, localImg.trim(), estNum, localPromo ? 1 : 0]
          );
          Alert.alert('✓ Produto criado!');
        }
        setModalProd(false); setProdSel(null); carregar();
      } catch (e) { Alert.alert('Erro', 'Não foi possível salvar.'); }
    };

    const handleExcluir = () => {
      Alert.alert('Excluir produto', `Deseja excluir "${localNome}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir', style: 'destructive', onPress: () => {
            try {
              db.runSync('DELETE FROM produtos WHERE id = ?', [prodSel.id]);
              setModalProd(false); setProdSel(null); carregar();
            } catch { Alert.alert('Erro', 'Não foi possível excluir.'); }
          }
        }
      ]);
    };

    return (
      <Modal visible={modalProd} transparent animationType="slide">
        <View style={styles.overlay}>
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled">

            <Text style={styles.modalTitulo}>{isNovo ? '➕ Novo Produto' : '✏️ Editar Produto'}</Text>

            {/* Preview imagem */}
            {!!localImg && (
              <Image source={{ uri: localImg }} style={styles.imgPreview}
                onError={() => {}} resizeMode="cover" />
            )}

            <Text style={styles.inputLabel}>Nome *</Text>
            <TextInput style={styles.input} value={localNome} onChangeText={setLocalNome}
              placeholder="Ex: Café Espresso" returnKeyType="next" />

            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={localDesc} onChangeText={setLocalDesc}
              placeholder="Descrição do produto" multiline />

            <Text style={styles.inputLabel}>URL da Imagem</Text>
            <TextInput style={styles.input} value={localImg} onChangeText={setLocalImg}
              placeholder="https://..." autoCapitalize="none" keyboardType="url" />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Preço (R$) *</Text>
                {/* keyboardType="decimal-pad" evita o bug de sumirwhen re-render */}
                <TextInput
                  style={styles.input}
                  value={localPreco}
                  onChangeText={setLocalPreco}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Estoque (un) *</Text>
                <TextInput
                  style={styles.input}
                  value={localEstoque}
                  onChangeText={setLocalEstoque}
                  keyboardType="number-pad"
                  placeholder="0"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Categoria</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {CATEGORIAS.map(c => (
                <TouchableOpacity key={c}
                  style={[styles.catPill, localCat === c && styles.catPillAtiva]}
                  onPress={() => setLocalCat(c)}>
                  <Text style={[styles.catPillTxt, localCat === c && { color: C.white }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Toggle Promoção */}
            <TouchableOpacity style={styles.promoRow} onPress={() => setLocalPromo(v => !v)}>
              <View style={[styles.promoToggle, localPromo && { backgroundColor: C.vermelho }]}>
                <Ionicons name={localPromo ? 'pricetag' : 'pricetag-outline'} size={18}
                  color={localPromo ? '#FFF' : '#999'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.promoLabel}>Produto em promoção</Text>
                <Text style={styles.promoSub}>
                  {localPromo ? '🔥 Marcado como promoção' : 'Toque para marcar como promoção'}
                </Text>
              </View>
              <Ionicons name={localPromo ? 'checkbox' : 'square-outline'} size={24}
                color={localPromo ? '#E74C3C' : '#CCC'} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.loginBtn, { marginTop: 16 }]} onPress={handleSalvar}>
              <Ionicons name="save-outline" size={18} color="#FFF" />
              <Text style={styles.loginBtnTxt}>{isNovo ? 'CRIAR PRODUTO' : 'SALVAR ALTERAÇÕES'}</Text>
            </TouchableOpacity>

            {!isNovo && (
              <TouchableOpacity style={styles.btnExcluir} onPress={handleExcluir}>
                <Ionicons name="trash-outline" size={16} color="#E74C3C" />
                <Text style={{ color: C.vermelho, fontWeight: '600', fontSize: 13 }}>Excluir produto</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalFechar} onPress={() => { setModalProd(false); setProdSel(null); }}>
              <Text style={{ color: C.textMuted, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // ════════════════════════════════════════════════════════════════
  // MODAL AVALIAÇÕES
  // ════════════════════════════════════════════════════════════════
  const ModalAvaliacoes = () => (
    <Modal visible={modalAval} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.modal, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitulo}>⭐ Avaliações</Text>
          <Text style={styles.modalSub}>{prodAvalNome}</Text>

          {avaliacoes.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Ionicons name="chatbubble-outline" size={50} color="#EEE" />
              <Text style={{ color: '#CCC', marginTop: 10 }}>Nenhuma avaliação ainda</Text>
            </View>
          ) : (
            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {avaliacoes.map((av, i) => (
                <View key={i} style={styles.avalCard}>
                  <View style={styles.avalHeader}>
                    <View style={styles.avalAvatar}>
                      <Ionicons name="person" size={14} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.avalNome}>{av.usuario_nome || 'Usuário'}</Text>
                      <Text style={styles.avalData}>{av.data}</Text>
                    </View>
                    <Estrelas nota={av.nota} />
                  </View>
                  {!!av.comentario && (
                    <Text style={styles.avalComentario}>"{av.comentario}"</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.modalFechar} onPress={() => setModalAval(false)}>
            <Text style={{ color: C.textMuted, fontWeight: '600' }}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.safe}>
      <ModalStatus />
      <ModalProduto />
      <ModalAvaliacoes />

      {/* ══ MODAL NOTA FISCAL ════════════════════════════════════ */}
      <Modal visible={modalNF} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { maxHeight: '92%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

              {/* Cabeçalho da nota */}
              <View style={styles.nfCabecalho}>
                <View style={styles.nfIconBox}>
                  <Ionicons name="document-text" size={28} color="#6F4E37" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nfNumero}>{fmtNF(notaSel?.nota_fiscal)}</Text>
                  <Text style={styles.nfData}>Emitida em {notaSel?.data}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COR[notaSel?.status] || '#999' }]}>
                  <Text style={styles.statusBadgeTxt}>{notaSel?.status}</Text>
                </View>
              </View>

              <View style={styles.nfDivider} />

              {/* Dados do pedido */}
              <Text style={styles.nfSecaoTitulo}>DADOS DO PEDIDO</Text>
              <View style={styles.nfBloco}>
                <LinhaInfo icon="receipt-outline"     label="Pedido"     valor={`#${notaSel?.id}`} />
                <LinhaInfo icon="calendar-outline"    label="Data"       valor={notaSel?.data} />
                <LinhaInfo icon={notaSel?.tipo_entrega === 'retirada' ? 'storefront-outline' : 'bicycle-outline'}
                           label="Tipo"
                           valor={notaSel?.tipo_entrega === 'retirada' ? 'Retirada na loja' : 'Entrega'} />
                {notaSel?.tipo_entrega === 'retirada'
                  ? <LinhaInfo icon="time-outline" label="Horário retirada" valor={notaSel?.horario_retirada || '—'} />
                  : <LinhaInfo icon="location-outline" label="Endereço" valor={notaSel?.endereco_entrega || '—'} />
                }
                <LinhaInfo icon="card-outline" label="Pagamento" valor={notaSel?.forma_pagamento || '—'} />
                {Number(notaSel?.troco) > 0 && (
                  <LinhaInfo icon="cash-outline" label="Troco" valor={fmtMoeda(notaSel?.troco)} destaque="#27ae60" />
                )}
              </View>

              {/* Dados do cliente */}
              <Text style={styles.nfSecaoTitulo}>CLIENTE</Text>
              <View style={styles.nfBloco}>
                <LinhaInfo icon="person-outline" label="Nome"     valor={notaSel?.cliente_nome   || 'Não identificado'} />
                <LinhaInfo icon="mail-outline"   label="E-mail"   valor={notaSel?.cliente_email  || '—'} />
                <LinhaInfo icon="call-outline"   label="Telefone" valor={notaSel?.cliente_tel    || '—'} />
              </View>

              {/* Itens */}
              <Text style={styles.nfSecaoTitulo}>ITENS DO PEDIDO</Text>
              <View style={styles.nfBloco}>
                {itensPedidoNF.length === 0
                  ? <Text style={{ color: '#CCC', textAlign: 'center', paddingVertical: 10 }}>Sem itens registrados</Text>
                  : itensPedidoNF.map((it, i) => (
                    <View key={i} style={styles.nfItemRow}>
                      <View style={styles.nfItemQtdBox}>
                        <Text style={styles.nfItemQtd}>{it.quantidade}x</Text>
                      </View>
                      <Text style={styles.nfItemNome} numberOfLines={2}>{it.produto_nome}</Text>
                      <Text style={styles.nfItemPreco}>{fmtMoeda(it.preco_unit * it.quantidade)}</Text>
                    </View>
                  ))
                }
              </View>

              {/* Totais */}
              <Text style={styles.nfSecaoTitulo}>VALORES</Text>
              <View style={styles.nfBloco}>
                {Number(notaSel?.desconto_pontos) > 0 && (
                  <View style={styles.nfLinhaDesconto}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="star" size={13} color="#F39C12" />
                      <Text style={styles.nfDescontoLabel}>Desconto pontos</Text>
                    </View>
                    <Text style={styles.nfDescontoVal}>- {fmtMoeda(notaSel?.desconto_pontos)}</Text>
                  </View>
                )}
                {Number(notaSel?.desconto_cupom) > 0 && (
                  <View style={styles.nfLinhaDesconto}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="pricetag" size={13} color="#9B59B6" />
                      <Text style={styles.nfDescontoLabel}>
                        Cupom {notaSel?.cupom_usado || notaSel?.cupom}
                      </Text>
                    </View>
                    <Text style={styles.nfDescontoVal}>- {fmtMoeda(notaSel?.desconto_cupom)}</Text>
                  </View>
                )}
                <View style={styles.nfTotalRow}>
                  <Text style={styles.nfTotalLabel}>TOTAL PAGO</Text>
                  <Text style={styles.nfTotalValor}>{fmtMoeda(notaSel?.total)}</Text>
                </View>
                {Number(notaSel?.pontos_ganhos) > 0 && (
                  <View style={styles.nfPontosRow}>
                    <Ionicons name="star-outline" size={14} color="#F39C12" />
                    <Text style={styles.nfPontosTxt}>
                      +{notaSel?.pontos_ganhos} pontos creditados ao cliente
                    </Text>
                  </View>
                )}
              </View>

            </ScrollView>

            <TouchableOpacity style={styles.modalFechar} onPress={() => setModalNF(false)}>
              <Text style={{ color: C.textMuted, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="shield-checkmark" size={16} color="rgba(255,255,255,0.7)" />
          <Text style={styles.headerTitulo}>Painel Admin</Text>
        </View>
        {/* Espaço vazio para centralizar o título */}
        <View style={{ width: 36 }} />
      </View>

      {/* Abas */}
      <View style={styles.abas}>
        {[
          { key: 'pedidos',  icon: 'receipt-outline',       label: 'Pedidos' },
          { key: 'produtos', icon: 'cube-outline',           label: 'Produtos' },
          { key: 'notas',    icon: 'document-text-outline',  label: 'Notas' },
          { key: 'stats',    icon: 'bar-chart-outline',      label: 'Resumo' },
        ].map(a => (
          <TouchableOpacity key={a.key} style={[styles.aba, aba === a.key && styles.abaAtiva]}
            onPress={() => setAba(a.key)}>
            <Ionicons name={a.icon} size={18} color={aba === a.key ? '#6F4E37' : '#999'} />
            <Text style={[styles.abaTxt, aba === a.key && styles.abaTxtAtivo]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── ABA PEDIDOS ──────────────────────────────────────────── */}
      {aba === 'pedidos' && (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={styles.filtroScroll}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
            {['Todos', ...STATUS_LISTA].map(s => (
              <TouchableOpacity key={s}
                style={[styles.filtroPill, filtroStatus === s && { backgroundColor: STATUS_COR[s] || '#6F4E37' }]}
                onPress={() => setFiltroStatus(s)}>
                <Text style={[styles.filtroPillTxt, filtroStatus === s && { color: C.white }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={pedidosFiltrados}
            keyExtractor={i => String(i.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6F4E37']} />}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={styles.vazio}>
                <Ionicons name="receipt-outline" size={60} color="#EEE" />
                <Text style={styles.vazioTxt}>Nenhum pedido encontrado</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pedCard}
                onPress={() => { setPedidoSel(item); setModalStatus(true); }}>
                <View style={styles.pedTop}>
                  <View>
                    <Text style={styles.pedNum}>Pedido #{item.id}</Text>
                    <Text style={styles.pedData}>{item.data} • NF {String(item.nota_fiscal || 0).padStart(5, '0')}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COR[item.status] || '#999' }]}>
                    <Text style={styles.statusBadgeTxt}>{item.status}</Text>
                  </View>
                </View>
                <View style={styles.pedDivider} />
                <View style={styles.pedInfo}>
                  <Ionicons name="person-outline" size={14} color="#999" />
                  <Text style={styles.pedInfoTxt}>{item.cliente_nome || 'Usuário removido'}</Text>
                </View>
                <View style={styles.pedInfo}>
                  <Ionicons name={item.tipo_entrega === 'retirada' ? 'storefront-outline' : 'bicycle-outline'} size={14} color="#999" />
                  <Text style={styles.pedInfoTxt}>
                    {item.tipo_entrega === 'retirada' ? `Retirada ${item.horario_retirada}` : 'Entrega'}
                  </Text>
                </View>
                <View style={styles.pedInfo}>
                  <Ionicons name="card-outline" size={14} color="#999" />
                  <Text style={styles.pedInfoTxt}>{item.forma_pagamento}</Text>
                </View>
                <View style={styles.pedFooter}>
                  <Text style={styles.pedTotal}>R$ {item.total?.toFixed(2)}</Text>
                  <View style={styles.pedEditBtn}>
                    <Ionicons name="create-outline" size={14} color="#6F4E37" />
                    <Text style={styles.pedEditTxt}>Alterar status</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* ── ABA PRODUTOS ─────────────────────────────────────────── */}
      {aba === 'produtos' && (
        <View style={{ flex: 1 }}>
          {/* Botão novo produto */}
          <TouchableOpacity style={styles.btnNovoProd} onPress={abrirNovo}>
            <Ionicons name="add-circle-outline" size={20} color="#FFF" />
            <Text style={styles.btnNovoProdTxt}>Novo Produto</Text>
          </TouchableOpacity>

          <FlatList
            data={produtos}
            keyExtractor={i => String(i.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6F4E37']} />}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
            renderItem={({ item }) => (
              <View style={styles.prodCard}>
                {/* Miniatura */}
                {!!item.imagem && (
                  <Image source={{ uri: item.imagem }} style={styles.prodThumb}
                    onError={() => {}} resizeMode="cover" />
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.prodNome}>{item.nome}</Text>
                    {item.promocao === 1 && (
                      <View style={styles.promoBadge}>
                        <Text style={styles.promoBadgeTxt}>PROMO</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.prodCat}>{item.categoria}</Text>
                  <Text style={styles.prodPreco}>R$ {item.preco?.toFixed(2)}</Text>
                </View>
                {/* Badge estoque */}
                <View style={[styles.estoqueBadge,
                  { backgroundColor: item.estoque <= 3 ? '#FFF0F0' : item.estoque <= 8 ? '#FFF8E1' : '#F0FFF4' }]}>
                  <Text style={[styles.estoqueBadgeTxt,
                    { color: item.estoque <= 3 ? '#E74C3C' : item.estoque <= 8 ? '#F39C12' : '#27ae60' }]}>
                    {item.estoque} un
                  </Text>
                  {item.estoque <= 3 && <Ionicons name="warning-outline" size={12} color="#E74C3C" />}
                </View>
                {/* Botão avaliações */}
                <TouchableOpacity onPress={() => verAvaliacoes(item)} style={styles.avalBtn}>
                  <Ionicons name="star-outline" size={18} color="#F39C12" />
                </TouchableOpacity>
                {/* Botão editar */}
                <TouchableOpacity onPress={() => abrirEditar(item)} style={{ marginLeft: 6 }}>
                  <Ionicons name="pencil-outline" size={18} color="#6F4E37" />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      )}

      {/* ── ABA NOTAS FISCAIS ─────────────────────────────────────── */}
      {aba === 'notas' && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={notasFiltradas}
            keyExtractor={i => String(i.id)}
            ListHeaderComponent={
              <View>
                {/* Busca */}
                <View style={styles.nfBuscaRow}>
                  <Ionicons name="search-outline" size={18} color="#999" />
                  <TextInput
                    style={styles.nfBuscaInput}
                    placeholder="Buscar por NF, cliente ou pedido..."
                    placeholderTextColor="#BBB"
                    value={buscaNF}
                    onChangeText={setBuscaNF}
                    returnKeyType="search"
                  />
                  {buscaNF.length > 0 && (
                    <TouchableOpacity onPress={() => setBuscaNF('')}>
                      <Ionicons name="close-circle" size={18} color="#CCC" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filtro de status */}
                <View style={styles.nfFiltroWrap}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}
                  >
                    {['Todos', ...STATUS_LISTA].map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.filtroPill,
                          filtroNota === s && { backgroundColor: s === 'Todos' ? '#6F4E37' : (STATUS_COR[s] || '#6F4E37') }
                        ]}
                        onPress={() => setFiltroNota(s)}
                      >
                        <Text style={[styles.filtroPillTxt, filtroNota === s && { color: C.white }]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Contador */}
                <View style={styles.nfContadorRow}>
                  <Text style={styles.nfContadorTxt}>
                    {notasFiltradas.length} nota{notasFiltradas.length !== 1 ? 's' : ''} fiscal{notasFiltradas.length !== 1 ? 'is' : ''}
                  </Text>
                  <Text style={styles.nfContadorTotal}>
                    Total: {fmtMoeda(notasFiltradas.filter(n => n.status !== 'Cancelado').reduce((acc, n) => acc + Number(n.total || 0), 0))}
                  </Text>
                </View>
              </View>
            }
            nestedScrollEnabled
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6F4E37']} tintColor="#6F4E37" progressBackgroundColor="#FFF" />}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={styles.vazio}>
                <Ionicons name="document-text-outline" size={60} color="#EEE" />
                <Text style={styles.vazioTxt}>
                  {buscaNF ? 'Nenhuma nota encontrada' : 'Nenhuma nota emitida'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.nfCard} onPress={() => abrirNota(item)}>
                {/* Linha topo */}
                <View style={styles.nfCardTop}>
                  <View style={styles.nfCardIconBox}>
                    <Ionicons name="document-text" size={20} color="#6F4E37" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nfCardNumero}>{fmtNF(item.nota_fiscal)}</Text>
                    <Text style={styles.nfCardPedido}>Pedido #{item.id} · {item.data}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COR[item.status] || '#999' }]}>
                    <Text style={styles.statusBadgeTxt}>{item.status}</Text>
                  </View>
                </View>

                <View style={styles.pedDivider} />

                {/* Dados do cliente */}
                <View style={styles.pedInfo}>
                  <Ionicons
                    name={item.cliente_nome ? 'person-outline' : 'person-remove-outline'}
                    size={13}
                    color={item.cliente_nome ? '#999' : '#E74C3C'}
                  />
                  <Text style={[styles.pedInfoTxt, !item.cliente_nome && { color: C.vermelho, fontStyle: 'italic' }]}>
                    {item.cliente_nome || 'Conta removida / pedido sem cadastro'}
                  </Text>
                </View>
                {!!item.cliente_email && (
                  <View style={styles.pedInfo}>
                    <Ionicons name="mail-outline" size={13} color="#999" />
                    <Text style={styles.pedInfoTxt}>{item.cliente_email}</Text>
                  </View>
                )}
                <View style={styles.pedInfo}>
                  <Ionicons name="card-outline" size={13} color="#999" />
                  <Text style={styles.pedInfoTxt} numberOfLines={1}>{item.forma_pagamento || '—'}</Text>
                </View>

                {/* Descontos e total */}
                {(Number(item.desconto_pontos) > 0 || Number(item.desconto_cupom) > 0) && (
                  <View style={styles.nfCardDescontoRow}>
                    {Number(item.desconto_pontos) > 0 && (
                      <View style={styles.nfCardDescBadge}>
                        <Ionicons name="star" size={10} color="#F39C12" />
                        <Text style={styles.nfCardDescTxt}>- {fmtMoeda(item.desconto_pontos)}</Text>
                      </View>
                    )}
                    {Number(item.desconto_cupom) > 0 && (
                      <View style={[styles.nfCardDescBadge, { backgroundColor: '#F5EEFF' }]}>
                        <Ionicons name="pricetag" size={10} color="#9B59B6" />
                        <Text style={[styles.nfCardDescTxt, { color: '#9B59B6' }]}>- {fmtMoeda(item.desconto_cupom)}</Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.pedFooter}>
                  <Text style={styles.pedTotal}>{fmtMoeda(item.total)}</Text>
                  <View style={styles.pedEditBtn}>
                    <Ionicons name="eye-outline" size={14} color="#6F4E37" />
                    <Text style={styles.pedEditTxt}>Ver nota completa</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* ── ABA RESUMO ───────────────────────────────────────────── */}
      {aba === 'stats' && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6F4E37']} />}>
          {[
            { icon: 'receipt-outline', label: 'Total de Pedidos',      valor: stats.totalPedidos,                                  cor: '#6F4E37' },
            { icon: 'cash-outline',    label: 'Receita Total (sem cancel.)', valor: `R$ ${(stats.totalReceita || 0).toFixed(2)}`, cor: '#27ae60' },
            { icon: 'close-circle-outline', label: 'Pedidos Cancelados', valor: `${stats.totalCancelado?.c || 0} (R$ ${Number(stats.totalCancelado?.s || 0).toFixed(2)})`, cor: '#E74C3C' },
            { icon: 'people-outline',  label: 'Clientes Cadastrados',   valor: stats.totalUsuarios,                                 cor: '#2980b9' },
            { icon: 'time-outline',    label: 'Em Preparo Agora',       valor: stats.emPreparo,                                     cor: '#F39C12' },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: s.cor + '18' }]}>
                <Ionicons name={s.icon} size={28} color={s.cor} />
              </View>
              <View>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={[styles.statValor, { color: s.cor }]}>{s.valor}</Text>
              </View>
            </View>
          ))}

          {stats.maisVendido && (
            <View style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: '#6F4E3718' }]}>
                <Ionicons name="trophy-outline" size={28} color="#6F4E37" />
              </View>
              <View>
                <Text style={styles.statLabel}>Produto Mais Vendido</Text>
                <Text style={[styles.statValor, { color: C.cafe }]}>{stats.maisVendido.produto_nome}</Text>
                <Text style={{ fontSize: 12, color: C.textMuted }}>{stats.maisVendido.qtd} unidades vendidas</Text>
              </View>
            </View>
          )}

          <Text style={styles.statsSecaoTitulo}>PEDIDOS POR STATUS</Text>
          {STATUS_LISTA.map(s => {
            const qtd = pedidos.filter(p => p.status === s).length;
            return (
              <View key={s} style={styles.statusLinha}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COR[s] }]} />
                <Text style={styles.statusLinhaLabel}>{s}</Text>
                <Text style={[styles.statusLinhaQtd, { color: STATUS_COR[s] }]}>{qtd}</Text>
              </View>
            );
          })}

          {/* ── Sessão / Sair ──────────────────────────────────── */}
          <Text style={styles.statsSecaoTitulo}>SESSÃO ADMINISTRATIVA</Text>
          <View style={styles.sessaoCard}>
            <View style={styles.sessaoInfo}>
              <View style={styles.sessaoAvatar}>
                <Ionicons name="shield-checkmark" size={22} color="#6F4E37" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessaoNome}>Administrador</Text>
                <Text style={styles.sessaoSub}>Sessão ativa · acesso total</Text>
              </View>
              <View style={styles.sessaoAtivoBadge}>
                <View style={styles.sessaoAtivoPoint} />
                <Text style={styles.sessaoAtivoTxt}>Online</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.btnSairSessao}
            onPress={() =>
              Alert.alert(
                'Encerrar sessão',
                'Deseja sair do painel administrativo?',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Sair', style: 'destructive',
                    onPress: () => { setAutenticado(false); setSenha(''); }
                  },
                ]
              )
            }
          >
            <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
            <Text style={styles.btnSairSessaoTxt}>Encerrar sessão administrativa</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Linha de info da nota fiscal ─────────────────────────────────
function LinhaInfo({ icon, label, valor, destaque }) {
  return (
    <View style={styles.nfLinhaInfo}>
      <Ionicons name={icon} size={15} color="#999" style={{ marginTop: 1 }} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.nfLinhaLabel}>{label}</Text>
        <Text style={[styles.nfLinhaValor, destaque && { color: destaque, fontWeight: 'bold' }]}>
          {valor || '—'}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.foam },

  // Login
  loginSafe: { flex: 1, backgroundColor: C.milk, justifyContent: 'center', alignItems: 'center' },
  loginBox: { width: '85%', backgroundColor: C.white, borderRadius: 24, padding: 32, alignItems: 'center', elevation: 6 },
  loginIconBox: { width: 80, height: 80, borderRadius: 24, backgroundColor: C.milk, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  loginTitulo: { fontSize: 20, fontWeight: 'bold', color: C.textDark, marginBottom: 4 },
  loginSub: { fontSize: 13, color: C.textMuted, marginBottom: 24 },
  loginInput: { width: '100%', borderWidth: 1.5, borderColor: C.foam, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 14 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cafe, padding: 15, borderRadius: 14, width: '100%', justifyContent: 'center' },
  loginBtnTxt: { color: C.white, fontWeight: 'bold', fontSize: 15 },

  // Header
  header: {
    backgroundColor: C.cafe,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 44 : 16,
    paddingBottom: 14,
  },
  headerBackBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  headerTitulo: { color: C.white, fontSize: 17, fontWeight: 'bold' },

  // Sessão / Sair
  sessaoCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16, elevation: 2,
  },
  sessaoInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessaoAvatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: C.milk,
    justifyContent: 'center', alignItems: 'center',
  },
  sessaoNome: { fontSize: 15, fontWeight: 'bold', color: C.textDark },
  sessaoSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  sessaoAtivoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F0FFF4', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 20,
  },
  sessaoAtivoPoint: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: C.verde,
  },
  sessaoAtivoTxt: { fontSize: 11, color: C.verde, fontWeight: 'bold' },
  btnSairSessao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: C.white,
    borderWidth: 1.5, borderColor: '#E74C3C',
    padding: 15, borderRadius: 16,
  },
  btnSairSessaoTxt: { color: C.vermelho, fontWeight: 'bold', fontSize: 14 },

  // Abas
  abas: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderColor: C.foam },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  abaAtiva: { borderBottomWidth: 2, borderColor: C.cafe },
  abaTxt: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  abaTxtAtivo: { color: C.cafe, fontWeight: 'bold' },

  // Filtro
  filtroScroll: { maxHeight: 52, backgroundColor: C.white },
  filtroPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.milk },
  filtroPillTxt: { fontSize: 12, color: C.cafe, fontWeight: '600' },

  // Pedido card
  pedCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, elevation: 2 },
  pedTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pedNum: { fontSize: 15, fontWeight: 'bold', color: C.textDark },
  pedData: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeTxt: { color: C.white, fontSize: 11, fontWeight: 'bold' },
  pedDivider: { height: 1, backgroundColor: C.foam, marginVertical: 10 },
  pedInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  pedInfoTxt: { fontSize: 13, color: '#555', flex: 1 },
  pedFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  pedTotal: { fontSize: 18, fontWeight: 'bold', color: C.verde },
  pedEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.milk, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  pedEditTxt: { color: C.cafe, fontWeight: '600', fontSize: 12 },

  // Produto card
  prodCard: { backgroundColor: C.white, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', elevation: 1, gap: 8 },
  prodThumb: { width: 50, height: 50, borderRadius: 10 },
  prodNome: { fontWeight: 'bold', color: C.textDark, fontSize: 14 },
  prodCat: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  prodPreco: { fontSize: 13, color: C.verde, fontWeight: 'bold', marginTop: 4 },
  estoqueBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
  estoqueBadgeTxt: { fontSize: 12, fontWeight: 'bold' },

  // Botão avaliações na lista
  avalBtn: { padding: 4, marginLeft: 4 },

  // Botão novo produto
  btnNovoProd: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.verde, margin: 16, marginBottom: 0, padding: 13, borderRadius: 14, justifyContent: 'center' },
  btnNovoProdTxt: { color: C.white, fontWeight: 'bold', fontSize: 14 },

  // Promoção badge na lista
  promoBadge: { backgroundColor: C.vermelho, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  promoBadgeTxt: { color: C.white, fontSize: 9, fontWeight: 'bold' },

  // Modal produto - campos
  inputLabel: { fontSize: 12, fontWeight: '600', color: C.textMid, marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: C.foam, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, backgroundColor: C.cream, color: C.textDark },
  imgPreview: { width: '100%', height: 150, borderRadius: 14, marginBottom: 8, backgroundColor: '#F0EDE9' },

  // Categorias pill no modal
  catPill: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: C.milk },
  catPillAtiva: { backgroundColor: C.cafe },
  catPillTxt: { fontSize: 12, fontWeight: '600', color: C.cafe },

  // Toggle promoção
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF8F5', borderRadius: 14, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#F0E0D8' },
  promoToggle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0EDE9', justifyContent: 'center', alignItems: 'center' },
  promoLabel: { fontSize: 14, fontWeight: '600', color: C.textDark },
  promoSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  // Botão excluir
  btnExcluir: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 12, marginTop: 8, borderWidth: 1.5, borderColor: '#E74C3C', borderRadius: 14 },

  // Stats
  statCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, elevation: 2 },
  statIconBox: { width: 54, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statLabel: { fontSize: 12, color: C.textMuted, marginBottom: 4 },
  statValor: { fontSize: 22, fontWeight: 'bold' },
  statsSecaoTitulo: { fontSize: 11, fontWeight: 'bold', color: C.textMuted, letterSpacing: 1, marginTop: 6 },
  statusLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, padding: 14, borderRadius: 12, elevation: 1 },
  statusLinhaLabel: { flex: 1, fontSize: 14, color: C.textDark, fontWeight: '500' },
  statusLinhaQtd: { fontSize: 18, fontWeight: 'bold' },

  // Modal geral
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modal: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: C.textDark, marginBottom: 6 },
  modalSub: { fontSize: 13, color: C.textMid, marginBottom: 3, lineHeight: 20 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 12, borderWidth: 1.5, marginBottom: 8 },
  statusBtnTxt: { flex: 1, fontSize: 14, color: C.textDark, fontWeight: '500' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  modalFechar: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },

  // Avaliações
  avalCard: { backgroundColor: C.cream, borderRadius: 12, padding: 14, marginBottom: 10 },
  avalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avalAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.cafe, justifyContent: 'center', alignItems: 'center' },
  avalNome: { fontSize: 13, fontWeight: 'bold', color: C.textDark },
  avalData: { fontSize: 11, color: C.textMuted },
  avalComentario: { fontSize: 13, color: '#555', fontStyle: 'italic', lineHeight: 19 },

  vazio: { alignItems: 'center', paddingTop: 60, gap: 12 },
  vazioTxt: { color: '#CCC', fontSize: 15 },

  // ── Notas fiscais — busca e contador ──────────────────────────
  nfFiltroWrap: { backgroundColor: C.white, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  nfBuscaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.white, marginHorizontal: 16, marginTop: 12,
    marginBottom: 6, borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 11, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  nfBuscaInput: { flex: 1, fontSize: 14, color: C.textDark },
  nfContadorRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 18, paddingBottom: 6,
  },
  nfContadorTxt: { fontSize: 12, color: C.textMuted, fontWeight: '600' },
  nfContadorTotal: { fontSize: 13, color: C.verde, fontWeight: 'bold' },

  // ── Card da nota na lista ─────────────────────────────────────
  nfCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16, elevation: 2,
    borderLeftWidth: 4, borderLeftColor: '#6F4E37',
  },
  nfCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  nfCardIconBox: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: C.milk,
    justifyContent: 'center', alignItems: 'center',
  },
  nfCardNumero: { fontSize: 15, fontWeight: 'bold', color: C.textDark },
  nfCardPedido: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  nfCardDescontoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8, marginBottom: 2 },
  nfCardDescBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF8E1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  nfCardDescTxt: { fontSize: 11, color: '#F39C12', fontWeight: '600' },

  // ── Modal da nota fiscal ──────────────────────────────────────
  nfCabecalho: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4,
  },
  nfIconBox: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: C.milk,
    justifyContent: 'center', alignItems: 'center',
  },
  nfNumero: { fontSize: 20, fontWeight: 'bold', color: C.textDark },
  nfData: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  nfDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 14 },
  nfSecaoTitulo: {
    fontSize: 10, fontWeight: 'bold', color: '#BBB',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 4,
  },
  nfBloco: {
    backgroundColor: C.cream, borderRadius: 14, padding: 12, marginBottom: 14,
  },
  nfLinhaInfo: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 6, borderBottomWidth: 1, borderColor: '#F0F0F0',
  },
  nfLinhaLabel: { fontSize: 10, color: '#AAA', marginBottom: 1 },
  nfLinhaValor: { fontSize: 13, color: C.textDark, fontWeight: '500', lineHeight: 18 },

  // Itens
  nfItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, borderBottomWidth: 1, borderColor: '#F0F0F0',
  },
  nfItemQtdBox: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: '#6F4E3718',
    justifyContent: 'center', alignItems: 'center',
  },
  nfItemQtd: { fontSize: 12, fontWeight: 'bold', color: C.cafe },
  nfItemNome: { flex: 1, fontSize: 13, color: C.textDark, fontWeight: '500' },
  nfItemPreco: { fontSize: 13, fontWeight: 'bold', color: C.verde },

  // Totais / descontos
  nfLinhaDesconto: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderColor: '#F0F0F0',
  },
  nfDescontoLabel: { fontSize: 13, color: '#888' },
  nfDescontoVal: { fontSize: 13, color: C.vermelho, fontWeight: '600' },
  nfTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, marginTop: 2,
  },
  nfTotalLabel: { fontSize: 13, fontWeight: 'bold', color: C.textDark, letterSpacing: 0.5 },
  nfTotalValor: { fontSize: 22, fontWeight: 'bold', color: C.verde },
  nfPontosRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8E1', padding: 10, borderRadius: 10, marginTop: 10,
  },
  nfPontosTxt: { fontSize: 12, color: '#F39C12', fontWeight: '600', flex: 1 },
});