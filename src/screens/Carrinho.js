import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, Alert, RefreshControl, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import db from '../database/DatabaseInit';
import BottomNav from '../components/BottomNav';
import { C, S } from '../theme';

export default function Carrinho({ navigation, route }) {
  const user = route.params?.user;
  const [itens, setItens] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const carregarCarrinho = () => {
    if (!user?.id) return;
    try {
      const data = db.getAllSync(`
        SELECT c.id, c.quantidade, p.nome, p.preco, p.imagem,
               p.id as produto_id, p.estoque, p.categoria
        FROM carrinho c INNER JOIN produtos p ON c.produto_id = p.id
        WHERE c.usuario_id = ?`, [user.id]);
      setItens(data || []);
    } catch (e) { console.error(e); }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); carregarCarrinho(); setRefreshing(false); }, [user]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', carregarCarrinho);
    carregarCarrinho();
    return unsub;
  }, [navigation, user]);

  const alterarQtd = (item, delta) => {
    const nova = item.quantidade + delta;
    if (nova <= 0) {
      Alert.alert('Remover item', `Remover "${item.nome}" do carrinho?`, [
        { text: 'Cancelar' },
        { text: 'Remover', style: 'destructive', onPress: () => {
          db.runSync('DELETE FROM carrinho WHERE id = ?', [item.id]);
          db.runSync('UPDATE produtos SET estoque = estoque + ? WHERE id = ?', [item.quantidade, item.produto_id]);
          carregarCarrinho();
        }}
      ]);
      return;
    }
    if (delta > 0 && item.estoque <= 0) { Alert.alert('Sem estoque', 'Não há mais unidades disponíveis.'); return; }
    db.runSync('UPDATE carrinho SET quantidade = ? WHERE id = ?', [nova, item.id]);
    delta > 0
      ? db.runSync('UPDATE produtos SET estoque = estoque - 1 WHERE id = ?', [item.produto_id])
      : db.runSync('UPDATE produtos SET estoque = estoque + 1 WHERE id = ?', [item.produto_id]);
    carregarCarrinho();
  };

  const remover = (item) => {
    Alert.alert('Remover item', `Remover "${item.nome}" do carrinho?`, [
      { text: 'Cancelar' },
      { text: 'Remover', style: 'destructive', onPress: () => {
        db.runSync('DELETE FROM carrinho WHERE id = ?', [item.id]);
        db.runSync('UPDATE produtos SET estoque = estoque + ? WHERE id = ?', [item.quantidade, item.produto_id]);
        carregarCarrinho();
      }}
    ]);
  };

  const total = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0);

  // Altura do rodapé: precisa ser o paddingBottom do FlatList
  const RODAPE_H = Platform.OS === 'ios' ? 260 : 240;

  const irCheckout = () => {
    if (itens.length === 0) return Alert.alert('Carrinho vazio', 'Adicione produtos antes de finalizar.');
    navigation.navigate('Checkout', { user, itens, total });
  };

  const renderItem = ({ item }) => {
    const semEstoque = item.estoque <= 0;
    return (
      <View style={styles.card}>
        <Image source={{ uri: item.imagem }} style={styles.img} resizeMode="cover" />
        <View style={styles.cardInfo}>
          <Text style={styles.catTag}>{item.categoria}</Text>
          <Text style={styles.nome} numberOfLines={2}>{item.nome}</Text>
          <Text style={styles.precoUnit}>R$ {item.preco.toFixed(2)}/un</Text>
          {semEstoque && (
            <View style={styles.estoqueAviso}>
              <Ionicons name="warning-outline" size={11} color={C.amarelo} />
              <Text style={styles.estoqueAvisoTxt}>Limite atingido</Text>
            </View>
          )}
          <View style={styles.cardBottom}>
            <View style={styles.counter}>
              <TouchableOpacity style={styles.counterBtn} onPress={() => alterarQtd(item, -1)}>
                <Ionicons name="remove" size={16} color={C.cafe} />
              </TouchableOpacity>
              <Text style={styles.qtd}>{item.quantidade}</Text>
              <TouchableOpacity
                style={[styles.counterBtn, semEstoque && { opacity: 0.35 }]}
                onPress={() => alterarQtd(item, 1)}
                disabled={semEstoque}
              >
                <Ionicons name="add" size={16} color={semEstoque ? C.foam : C.cafe} />
              </TouchableOpacity>
            </View>
            <Text style={styles.precoTotal}>R$ {(item.preco * item.quantidade).toFixed(2)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.removeBtn} onPress={() => remover(item)}>
          <Ionicons name="trash-outline" size={17} color={C.vermelho} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.espresso} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Carrinho</Text>
          {totalItens > 0 && <Text style={styles.subtitulo}>{totalItens} item{totalItens > 1 ? 's' : ''}</Text>}
        </View>
        {itens.length > 0 && (
          <TouchableOpacity style={styles.limparBtn} onPress={() =>
            Alert.alert('Limpar carrinho', 'Remover todos os itens?', [
              { text: 'Cancelar' },
              { text: 'Limpar', style: 'destructive', onPress: () => {
                itens.forEach(i => {
                  db.runSync('DELETE FROM carrinho WHERE id = ?', [i.id]);
                  db.runSync('UPDATE produtos SET estoque = estoque + ? WHERE id = ?', [i.quantidade, i.produto_id]);
                });
                carregarCarrinho();
              }}
            ])
          }>
            <Text style={styles.limparTxt}>Limpar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* VAZIO */}
      {itens.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="cart-outline" size={48} color={C.latte} />
          </View>
          <Text style={styles.emptyTitulo}>Carrinho vazio</Text>
          <Text style={styles.emptyDesc}>Adicione produtos do cardápio para começar seu pedido.</Text>
          <TouchableOpacity style={styles.explorarBtn} onPress={() => navigation.navigate('Home', { user })}>
            <Ionicons name="cafe-outline" size={18} color={C.white} />
            <Text style={styles.explorarBtnTxt}>Explorar Cardápio</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* LISTA — ocupa todo o espaço entre header e rodapé */
        <FlatList
          data={itens}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.cafe]} tintColor={C.cafe} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: RODAPE_H }}
        />
      )}

      {/* RODAPÉ FIXO — só aparece quando tem itens */}
      {itens.length > 0 && (
        <View style={styles.rodape}>
          <View style={styles.resumo}>
            <View style={styles.resumoLinha}>
              <Text style={styles.resumoLabel}>Subtotal ({totalItens} item{totalItens > 1 ? 's' : ''})</Text>
              <Text style={styles.resumoVal}>R$ {total.toFixed(2)}</Text>
            </View>
            <View style={styles.resumoLinha}>
              <Text style={styles.resumoLabel}>Entrega</Text>
              <Text style={[styles.resumoVal, { color: C.verde }]}>Calculado no checkout</Text>
            </View>
          </View>
          <View style={styles.totalBox}>
            <View>
              <Text style={styles.totalLabel}>Total estimado</Text>
              <Text style={styles.totalVal}>R$ {total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutBtn} onPress={irCheckout}>
              <Text style={styles.checkoutBtnTxt}>Finalizar</Text>
              <Ionicons name="arrow-forward" size={18} color={C.white} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <BottomNav navigation={navigation} active="Carrinho" user={user} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 50 : 54,
    paddingBottom: 16, paddingHorizontal: 20, gap: 14,
    backgroundColor: C.cream,
  },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.milk, borderWidth: 1, borderColor: C.foam, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 22, fontWeight: '800', color: C.espresso },
  subtitulo: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  limparBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.vermelhoClaro },
  limparTxt: { color: C.vermelho, fontSize: 12, fontWeight: '700' },

  // ── Card ──────────────────────────────────────────────────────
  card: {
    flexDirection: 'row', backgroundColor: C.white,
    borderRadius: 18, marginBottom: 12,
    borderWidth: 1, borderColor: C.foam,
    ...S.cardShadow, overflow: 'hidden',
    minHeight: 110,
  },
  img: { width: 95, height: '100%' },
  cardInfo: { flex: 1, padding: 12, paddingRight: 6 },
  catTag: { fontSize: 9, fontWeight: '800', color: C.caramel, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  nome: { fontSize: 14, fontWeight: '700', color: C.espresso, lineHeight: 19 },
  precoUnit: { fontSize: 12, color: C.textLight, fontWeight: '600', marginTop: 4 },
  estoqueAviso: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  estoqueAvisoTxt: { fontSize: 10, color: C.amarelo, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  counter: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.milk, borderRadius: 12, borderWidth: 1, borderColor: C.foam },
  counterBtn: { width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  qtd: { minWidth: 24, textAlign: 'center', fontWeight: '800', fontSize: 14, color: C.espresso },
  precoTotal: { fontSize: 15, fontWeight: '800', color: C.verde },
  removeBtn: { padding: 12, justifyContent: 'center', alignItems: 'center' },

  // ── Rodapé fixo ───────────────────────────────────────────────
  rodape: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.white,
    borderTopWidth: 1, borderColor: C.foam,
    paddingHorizontal: 20, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 100 : 82,
    ...S.cardShadow,
  },
  resumo: { gap: 5, marginBottom: 14 },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
  resumoLabel: { fontSize: 13, color: C.textLight },
  resumoVal: { fontSize: 13, color: C.textMid, fontWeight: '600' },
  totalBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.milk, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.foam },
  totalLabel: { fontSize: 10, color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalVal: { fontSize: 22, fontWeight: '800', color: C.espresso, marginTop: 2 },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cafe, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 14, ...S.cardShadow },
  checkoutBtnTxt: { color: C.white, fontWeight: '800', fontSize: 14 },

  // ── Vazio ─────────────────────────────────────────────────────
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, paddingBottom: 100 },
  emptyIconBox: { width: 90, height: 90, borderRadius: 28, backgroundColor: C.milk, borderWidth: 1.5, borderColor: C.foam, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitulo: { fontSize: 20, fontWeight: '800', color: C.espresso, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: C.textLight, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  explorarBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cafe, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, ...S.cardShadow },
  explorarBtnTxt: { color: C.white, fontWeight: '800', fontSize: 14 },
});