import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
  Dimensions, Alert, Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import db from '../database/DatabaseInit';

const { width } = Dimensions.get('window');

const C = {
  espresso: '#4A2512',
  cafe:     '#6F4E37',
  caramel:  '#C68642',
  milk:     '#F5F0EB',
  foam:     '#E8DDD5',
  verde:    '#27ae60',
  white:    '#FFFFFF',
  textMid:  '#555',
  textMuted:'#999',
};

function EstrelasInput({ valor, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
          <Ionicons name={i <= valor ? 'star' : 'star-outline'} size={34} color={i <= valor ? '#FFD700' : '#DDD'} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EstrelasDisplay({ media, tamanho = 16 }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => {
        const nome = media >= i ? 'star' : media >= i - 0.5 ? 'star-half' : 'star-outline';
        return <Ionicons key={i} name={nome} size={tamanho} color="#FFD700" />;
      })}
    </View>
  );
}

function BarraDistribuicao({ label, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.barraRow}>
      <Text style={styles.barraLabel}>{label}</Text>
      <View style={styles.barraFundo}>
        <View style={[styles.barraFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.barraCount}>{count}</Text>
    </View>
  );
}

export default function DetalhesProduto({ route, navigation }) {
  const { produto } = route.params;
  const user = route.params?.user ?? null;

  const [qtd, setQtd]                       = useState(1);
  const [isFav, setIsFav]                   = useState(false);
  const [estoque, setEstoque]               = useState(produto.estoque ?? 10);
  const [mediaNota, setMediaNota]           = useState(0);
  const [totalAvaliacoes, setTotalAvaliacoes] = useState(0);
  const [distribuicao, setDistribuicao]     = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [avaliacoes, setAvaliacoes]         = useState([]);
  const [minhaAvaliacao, setMinhaAvaliacao] = useState(null);
  const [modalAberto, setModalAberto]       = useState(false);
  const [notaTemp, setNotaTemp]             = useState(0);
  const [comentarioTemp, setComentarioTemp] = useState('');
  const [imgIdx, setImgIdx]                 = useState(0);

  const galeria = [
    produto.imagem,
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=500',
    'https://images.unsplash.com/photo-1506372023823-741c83b836fe?q=80&w=500',
    'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=500',
  ];

  const carregarEstoque = useCallback(() => {
    try {
      const p = db.getFirstSync('SELECT estoque FROM produtos WHERE id = ?', [produto.id]);
      if (p) setEstoque(p.estoque);
    } catch (_) {}
  }, [produto.id]);

  const carregarAvaliacoes = useCallback(() => {
    try {
      const stats = db.getFirstSync(
        'SELECT AVG(nota) as media, COUNT(*) as total FROM avaliacoes WHERE produto_id = ?',
        [produto.id]
      );
      setMediaNota(stats?.media ? parseFloat(stats.media.toFixed(1)) : 0);
      setTotalAvaliacoes(stats?.total ?? 0);

      const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      for (let n = 1; n <= 5; n++) {
        const row = db.getFirstSync(
          'SELECT COUNT(*) as c FROM avaliacoes WHERE produto_id = ? AND nota = ?',
          [produto.id, n]
        );
        dist[n] = row?.c ?? 0;
      }
      setDistribuicao(dist);

      const lista = db.getAllSync(
        `SELECT a.id, a.nota, a.comentario, a.data, a.usuario_id, u.nome as usuario_nome
         FROM avaliacoes a INNER JOIN usuarios u ON a.usuario_id = u.id
         WHERE a.produto_id = ? ORDER BY a.id DESC`,
        [produto.id]
      );
      setAvaliacoes(lista ?? []);

      if (user?.id) {
        const minha = db.getFirstSync(
          'SELECT * FROM avaliacoes WHERE usuario_id = ? AND produto_id = ?',
          [user.id, produto.id]
        );
        setMinhaAvaliacao(minha ?? null);
      }
    } catch (e) { console.error(e); }
  }, [produto.id, user?.id]);

  useEffect(() => {
    if (user?.id) {
      try {
        const existe = db.getFirstSync(
          'SELECT * FROM favoritos WHERE usuario_id = ? AND produto_id = ?',
          [user.id, produto.id]
        );
        setIsFav(!!existe);
      } catch (_) {}
    }
    carregarEstoque();
    carregarAvaliacoes();
  }, []);

  const toggleFavorito = () => {
    if (!user?.id) return;
    try {
      if (isFav) {
        db.runSync('DELETE FROM favoritos WHERE usuario_id = ? AND produto_id = ?', [user.id, produto.id]);
        setIsFav(false);
      } else {
        db.runSync('INSERT INTO favoritos (usuario_id, produto_id) VALUES (?, ?)', [user.id, produto.id]);
        setIsFav(true);
      }
    } catch (e) { console.error(e); }
  };

  const incrementarQtd = () => {
    const noCarrinho = (() => {
      try {
        const r = db.getFirstSync('SELECT quantidade FROM carrinho WHERE usuario_id = ? AND produto_id = ?', [user?.id, produto.id]);
        return r?.quantidade ?? 0;
      } catch (_) { return 0; }
    })();
    if (qtd + 1 + noCarrinho > estoque) return;
    setQtd(qtd + 1);
  };

  const adicionarCarrinho = () => {
    if (!user?.id) {
      Alert.alert('Login necessário', 'Faça login para adicionar ao carrinho.', [
        { text: 'Cancelar' },
        { text: 'Fazer Login', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    let estoqueAtual = 0;
    try {
      const p = db.getFirstSync('SELECT estoque FROM produtos WHERE id = ?', [produto.id]);
      estoqueAtual = p?.estoque ?? 0;
    } catch (e) { return; }

    if (estoqueAtual <= 0) { Alert.alert('Sem estoque', 'Produto esgotado.'); return; }
    if (qtd > estoqueAtual) { Alert.alert('Estoque insuficiente', `Só temos ${estoqueAtual} unidades.`); return; }

    try {
      const noCarrinho = db.getFirstSync(
        'SELECT quantidade FROM carrinho WHERE usuario_id = ? AND produto_id = ?',
        [user.id, produto.id]
      );
      const qtdJa = noCarrinho?.quantidade ?? 0;
      if (qtdJa + qtd > estoqueAtual) {
        Alert.alert('Estoque insuficiente', `Você já tem ${qtdJa} no carrinho.`);
        return;
      }
      if (noCarrinho) {
        db.runSync('UPDATE carrinho SET quantidade = quantidade + ? WHERE usuario_id = ? AND produto_id = ?', [qtd, user.id, produto.id]);
      } else {
        db.runSync('INSERT INTO carrinho (usuario_id, produto_id, quantidade) VALUES (?,?,?)', [user.id, produto.id, qtd]);
      }
      db.runSync('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [qtd, produto.id]);
      setEstoque(estoqueAtual - qtd);
      Alert.alert('✓ Adicionado!', `${qtd}x ${produto.nome} no carrinho.`, [
        { text: 'Continuar' },
        { text: 'Ver Carrinho', onPress: () => navigation.navigate('Carrinho', { user }) },
      ]);
    } catch (e) { console.error(e); }
  };

  const abrirModalAvaliacao = () => {
    if (!user?.id) {
      Alert.alert('Login necessário', 'Faça login para avaliar.', [
        { text: 'Cancelar' },
        { text: 'Fazer Login', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    setNotaTemp(minhaAvaliacao?.nota ?? 0);
    setComentarioTemp(minhaAvaliacao?.comentario ?? '');
    setModalAberto(true);
  };

  const salvarAvaliacao = () => {
    if (notaTemp === 0) { Alert.alert('Atenção', 'Selecione uma nota.'); return; }
    try {
      const dataHoje = new Date().toLocaleDateString('pt-BR');
      if (minhaAvaliacao) {
        db.runSync('UPDATE avaliacoes SET nota=?, comentario=?, data=? WHERE usuario_id=? AND produto_id=?',
          [notaTemp, comentarioTemp.trim(), dataHoje, user.id, produto.id]);
      } else {
        db.runSync('INSERT INTO avaliacoes (usuario_id, produto_id, nota, comentario, data) VALUES (?,?,?,?,?)',
          [user.id, produto.id, notaTemp, comentarioTemp.trim(), dataHoje]);
      }
      setModalAberto(false);
      carregarAvaliacoes();
      Alert.alert('✓ Avaliação salva!', 'Obrigado pelo feedback!');
    } catch (e) { Alert.alert('Erro', 'Não foi possível salvar.'); }
  };

  const excluirAvaliacao = () => {
    Alert.alert('Remover avaliação', 'Deseja remover sua avaliação?', [
      { text: 'Cancelar' },
      { text: 'Remover', style: 'destructive', onPress: () => {
        try {
          db.runSync('DELETE FROM avaliacoes WHERE usuario_id=? AND produto_id=?', [user.id, produto.id]);
          setModalAberto(false);
          carregarAvaliacoes();
        } catch (e) { console.error(e); }
      }},
    ]);
  };

  const labelNota = n => ({ 1: '😞 Ruim', 2: '😐 Regular', 3: '🙂 Bom', 4: '😊 Muito bom', 5: '🤩 Excelente!' }[n] ?? '');

  const corEstoque   = estoque === 0 ? '#E74C3C' : estoque <= 3 ? '#E67E22' : C.verde;
  const bgEstoque    = estoque === 0 ? '#FDECEC' : estoque <= 3 ? '#FEF3E6' : '#EDFDF4';
  const labelEstoque = estoque === 0 ? 'Esgotado' : `${estoque} disponíveis`;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5F2' }}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── HERO ──────────────────────────────────────────── */}
        <View style={styles.heroBox}>
          <ScrollView
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setImgIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {galeria.map((img, i) => (
              <Image key={i} source={{ uri: img }} style={[styles.heroImg, { width }]} resizeMode="cover" />
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>
          {user?.id && (
            <TouchableOpacity style={styles.favBtn} onPress={toggleFavorito}>
              <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#E74C3C' : '#FFF'} />
            </TouchableOpacity>
          )}

          <View style={styles.dotsRow}>
            {galeria.map((_, i) => (
              <View key={i} style={[styles.dot, i === imgIdx && styles.dotAtivo]} />
            ))}
          </View>

          {produto.promocao === 1 && (
            <View style={styles.promoBadgeHero}>
              <Ionicons name="pricetag" size={11} color="#FFF" />
              <Text style={styles.promoBadgeHeroTxt}>PROMOÇÃO</Text>
            </View>
          )}
        </View>

        {/* ── CARD INFO ─────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.nome}>{produto.nome}</Text>
            <View style={[styles.estoqueBadge, { backgroundColor: bgEstoque }]}>
              <View style={[styles.estoqueDot, { backgroundColor: corEstoque }]} />
              <Text style={[styles.estoqueTxt, { color: corEstoque }]}>{labelEstoque}</Text>
            </View>
          </View>

          <Text style={styles.categoria}>{produto.categoria}</Text>

          <View style={styles.ratingRow}>
            <EstrelasDisplay media={mediaNota} tamanho={16} />
            <Text style={styles.ratingTxt}>
              {totalAvaliacoes > 0
                ? `${mediaNota.toFixed(1)} · ${totalAvaliacoes} avaliação${totalAvaliacoes !== 1 ? 'ões' : ''}`
                : 'Sem avaliações ainda'}
            </Text>
          </View>

          <Text style={styles.desc}>{produto.descricao}</Text>

          <View style={styles.separador} />

          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.precoLabel}>Preço total</Text>
              <Text style={styles.preco}>R$ {(produto.preco * qtd).toFixed(2)}</Text>
            </View>
            <View style={styles.counter}>
              <TouchableOpacity
                style={[styles.counterBtn, qtd <= 1 && { opacity: 0.3 }]}
                onPress={() => qtd > 1 && setQtd(qtd - 1)}
              >
                <Ionicons name="remove" size={18} color={C.cafe} />
              </TouchableOpacity>
              <Text style={styles.qtd}>{qtd}</Text>
              <TouchableOpacity
                style={[styles.counterBtn, estoque <= 0 && { opacity: 0.3 }]}
                onPress={incrementarQtd}
              >
                <Ionicons name="add" size={18} color={C.cafe} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, estoque === 0 && styles.btnEsgotado]}
            onPress={adicionarCarrinho}
            disabled={estoque === 0}
            activeOpacity={0.85}
          >
            <Ionicons name={estoque === 0 ? 'close-circle-outline' : 'cart-outline'} size={22} color="#FFF" />
            <Text style={styles.btnTxt}>
              {estoque === 0 ? 'Produto Esgotado' : 'Adicionar ao Carrinho'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── AVALIAÇÕES ────────────────────────────────────── */}
        <View style={styles.avalSection}>
          <View style={styles.avalTituloRow}>
            <Text style={styles.secaoTitulo}>Avaliações</Text>
            <TouchableOpacity style={styles.btnAvaliar} onPress={abrirModalAvaliacao}>
              <Ionicons name={minhaAvaliacao ? 'star' : 'star-outline'} size={14} color={C.cafe} />
              <Text style={styles.btnAvaliarTxt}>{minhaAvaliacao ? 'Editar' : 'Avaliar'}</Text>
            </TouchableOpacity>
          </View>

          {totalAvaliacoes > 0 ? (
            <View style={styles.resumoCard}>
              <View style={styles.resumoEsq}>
                <Text style={styles.resumoNota}>{mediaNota.toFixed(1)}</Text>
                <EstrelasDisplay media={mediaNota} tamanho={18} />
                <Text style={styles.resumoTotal}>{totalAvaliacoes} avaliação{totalAvaliacoes !== 1 ? 'ões' : ''}</Text>
              </View>
              <View style={styles.resumoDir}>
                {[5, 4, 3, 2, 1].map(n => (
                  <BarraDistribuicao key={n} label={`${n}★`} count={distribuicao[n]} total={totalAvaliacoes} />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.semAval}>
              <Ionicons name="chatbubble-outline" size={48} color="#DDD" />
              <Text style={styles.semAvalTxt}>Nenhuma avaliação ainda</Text>
              <Text style={styles.semAvalSub}>Seja o primeiro a avaliar!</Text>
            </View>
          )}

          {avaliacoes.map(item => {
            const ehMinha = user?.id === item.usuario_id;
            return (
              <View key={item.id} style={[styles.avalCard, ehMinha && styles.avalCardMinha]}>
                <View style={styles.avalHeader}>
                  <View style={styles.avalAvatar}>
                    <Text style={styles.avalAvatarTxt}>{item.usuario_nome?.charAt(0)?.toUpperCase() ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.avalNome}>{item.usuario_nome}</Text>
                      {ehMinha && (
                        <View style={styles.minhaTag}>
                          <Text style={styles.minhaTagTxt}>Você</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.avalData}>{item.data}</Text>
                  </View>
                  <EstrelasDisplay media={item.nota} tamanho={13} />
                </View>
                {!!item.comentario && (
                  <Text style={styles.avalComentario}>"{item.comentario}"</Text>
                )}
                {ehMinha && (
                  <TouchableOpacity style={styles.editarMinha} onPress={abrirModalAvaliacao}>
                    <Ionicons name="pencil-outline" size={13} color={C.cafe} />
                    <Text style={styles.editarMinhaTxt}>Editar minha avaliação</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODAL AVALIAÇÃO ───────────────────────────────── */}
      <Modal visible={modalAberto} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalAberto(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitulo}>{minhaAvaliacao ? 'Editar avaliação' : 'Avaliar produto'}</Text>
              <TouchableOpacity onPress={() => setModalAberto(false)}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalProdRow}>
              <Image source={{ uri: produto.imagem }} style={styles.modalProdImg} />
              <Text style={styles.modalProdNome}>{produto.nome}</Text>
            </View>
            <Text style={styles.modalLabel}>Sua nota *</Text>
            <View style={styles.modalEstrelasRow}>
              <EstrelasInput valor={notaTemp} onChange={setNotaTemp} />
              {notaTemp > 0 && <Text style={styles.labelNotaTxt}>{labelNota(notaTemp)}</Text>}
            </View>
            <Text style={styles.modalLabel}>Comentário (opcional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Conte o que achou..."
              multiline numberOfLines={3} maxLength={200}
              value={comentarioTemp} onChangeText={setComentarioTemp}
              textAlignVertical="top"
            />
            <Text style={styles.modalContador}>{comentarioTemp.length}/200</Text>
            <View style={styles.modalBtns}>
              {minhaAvaliacao && (
                <TouchableOpacity style={styles.btnRemover} onPress={excluirAvaliacao}>
                  <Ionicons name="trash-outline" size={16} color="#E74C3C" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btnCancelarModal} onPress={() => setModalAberto(false)}>
                <Text style={styles.btnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSalvarModal} onPress={salvarAvaliacao}>
                <Ionicons name="checkmark-outline" size={18} color="#FFF" />
                <Text style={styles.btnSalvarTxt}>Publicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBox:    { height: 340, position: 'relative' },
  heroImg:    { height: 340 },
  backBtn:    { position: 'absolute', top: 50, left: 18, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: 8 },
  favBtn:     { position: 'absolute', top: 50, right: 18, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: 8 },
  dotsRow:    { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6, zIndex: 5, left: 0, right: 0, justifyContent: 'center' },
  dot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotAtivo:   { backgroundColor: '#FFF', width: 20 },
  promoBadgeHero: { position: 'absolute', bottom: 48, alignSelf: 'center', left: 0, right: 0, alignItems: 'center', zIndex: 10, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  promoBadgeHeroTxt: { color: '#FFF', fontSize: 11, fontWeight: '800', backgroundColor: '#E74C3C', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },

  card: {
    backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    marginTop: -28, padding: 24, elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: -4 },
  },
  rowBetween:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome:         { fontSize: 26, fontWeight: '900', color: '#2C1A0E', flex: 1, marginRight: 12, letterSpacing: -0.3 },
  estoqueBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  estoqueDot:   { width: 7, height: 7, borderRadius: 4 },
  estoqueTxt:   { fontSize: 11, fontWeight: '700' },
  categoria:    { color: C.caramel, fontWeight: '700', fontSize: 11, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1.2 },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 },
  ratingTxt:    { color: C.textMuted, fontSize: 12 },
  desc:         { color: C.textMid, lineHeight: 22, fontSize: 14, marginBottom: 16 },
  separador:    { height: 1, backgroundColor: '#F0EDE9', marginBottom: 16 },
  precoLabel:   { fontSize: 11, color: C.textMuted, marginBottom: 2 },
  preco:        { fontSize: 32, fontWeight: '900', color: C.verde, letterSpacing: -1 },
  counter:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F0EB', borderRadius: 20, borderWidth: 1.5, borderColor: '#E8DDD5', overflow: 'hidden' },
  counterBtn:   { paddingHorizontal: 14, paddingVertical: 10 },
  qtd:          { minWidth: 28, textAlign: 'center', fontWeight: '800', fontSize: 17, color: '#2C1A0E' },
  btn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#4A2512', padding: 18, borderRadius: 30, marginTop: 20, elevation: 4, shadowColor: '#4A2512', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  btnEsgotado:  { backgroundColor: '#CCC', elevation: 0, shadowOpacity: 0 },
  btnTxt:       { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },

  avalSection:  { backgroundColor: '#FFF', margin: 12, borderRadius: 24, padding: 20, elevation: 2 },
  avalTituloRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  secaoTitulo:  { fontSize: 18, fontWeight: '800', color: '#2C1A0E' },
  btnAvaliar:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F5F0EB', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E8DDD5' },
  btnAvaliarTxt:{ color: C.cafe, fontSize: 12, fontWeight: '700' },

  resumoCard:   { flexDirection: 'row', backgroundColor: '#FAFAFA', borderRadius: 16, padding: 16, marginBottom: 16, gap: 16 },
  resumoEsq:    { alignItems: 'center', justifyContent: 'center', minWidth: 70 },
  resumoNota:   { fontSize: 40, fontWeight: '900', color: '#2C1A0E', lineHeight: 44 },
  resumoTotal:  { fontSize: 11, color: C.textMuted, marginTop: 4 },
  resumoDir:    { flex: 1, justifyContent: 'center', gap: 4 },

  barraRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barraLabel:   { width: 22, fontSize: 11, color: C.textMuted, textAlign: 'right' },
  barraFundo:   { flex: 1, height: 7, backgroundColor: '#EEE', borderRadius: 4, overflow: 'hidden' },
  barraFill:    { height: 7, backgroundColor: '#FFD700', borderRadius: 4 },
  barraCount:   { width: 16, fontSize: 11, color: C.textMuted },

  semAval:      { alignItems: 'center', paddingVertical: 24, gap: 6 },
  semAvalTxt:   { fontSize: 15, color: '#CCC', fontWeight: '600' },
  semAvalSub:   { fontSize: 12, color: '#DDD' },

  avalCard:       { backgroundColor: '#FAFAFA', borderRadius: 16, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#F0EDE9' },
  avalCardMinha:  { borderColor: C.cafe, backgroundColor: '#FFF8F5' },
  avalHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avalAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.cafe, justifyContent: 'center', alignItems: 'center' },
  avalAvatarTxt:  { color: '#FFF', fontWeight: '800', fontSize: 15 },
  avalNome:       { fontSize: 13, fontWeight: '700', color: '#2C1A0E' },
  avalData:       { fontSize: 11, color: C.textMuted, marginTop: 1 },
  avalComentario: { fontSize: 13, color: C.textMid, fontStyle: 'italic', lineHeight: 20, marginTop: 4 },
  minhaTag:       { backgroundColor: C.cafe, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  minhaTagTxt:    { color: '#FFF', fontSize: 9, fontWeight: '800' },
  editarMinha:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#F5F0EB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  editarMinhaTxt: { color: C.cafe, fontSize: 12, fontWeight: '600' },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard:      { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  modalHandle:    { width: 40, height: 4, backgroundColor: '#EEE', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitulo:    { fontSize: 18, fontWeight: '800', color: '#2C1A0E' },
  modalProdRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FAFAFA', borderRadius: 14, padding: 12, marginBottom: 16 },
  modalProdImg:   { width: 50, height: 50, borderRadius: 10 },
  modalProdNome:  { fontSize: 15, fontWeight: '700', color: '#2C1A0E', flex: 1 },
  modalLabel:     { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 4 },
  modalEstrelasRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  labelNotaTxt:   { fontSize: 14, color: C.cafe, fontWeight: '700' },
  modalInput:     { borderWidth: 1.5, borderColor: '#E8DDD5', borderRadius: 14, padding: 14, fontSize: 14, color: '#333', backgroundColor: '#FAFAFA', minHeight: 80 },
  modalContador:  { fontSize: 11, color: '#CCC', textAlign: 'right', marginTop: 4, marginBottom: 12 },
  modalBtns:      { flexDirection: 'row', gap: 10, alignItems: 'center' },
  btnRemover:     { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: '#E74C3C', justifyContent: 'center', alignItems: 'center' },
  btnCancelarModal:{ flex: 1, paddingVertical: 14, borderRadius: 20, backgroundColor: '#F5F0EB', alignItems: 'center' },
  btnCancelarTxt: { color: C.cafe, fontWeight: '700', fontSize: 14 },
  btnSalvarModal: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.cafe, paddingVertical: 14, borderRadius: 20 },
  btnSalvarTxt:   { color: '#FFF', fontWeight: '800', fontSize: 14 },
});