import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Image,
  TouchableOpacity, Alert, RefreshControl, Dimensions, Platform, SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import db from '../database/DatabaseInit';
import BottomNav from '../components/BottomNav';
import { C, S } from '../theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2;

export default function Favoritos({ navigation, route }) {
  const [lista, setLista] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const user = route.params?.user;

  const carregarFavoritos = () => {
    if (!user?.id) return;
    try {
      const data = db.getAllSync(
        'SELECT p.* FROM produtos p INNER JOIN favoritos f ON p.id = f.produto_id WHERE f.usuario_id = ?',
        [user.id]
      );
      setLista(data || []);
    } catch (e) { console.error(e); }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true); carregarFavoritos(); setRefreshing(false);
  }, [user]);

  useEffect(() => {
    carregarFavoritos();
    const unsub = navigation.addListener('focus', carregarFavoritos);
    return unsub;
  }, [navigation, user]);

  const desfavoritar = (pId, nome) => {
    Alert.alert('Remover favorito', `Remover "${nome}" dos favoritos?`, [
      { text: 'Cancelar' },
      { text: 'Remover', style: 'destructive', onPress: () => {
        try {
          db.runSync('DELETE FROM favoritos WHERE usuario_id = ? AND produto_id = ?', [user.id, pId]);
          carregarFavoritos();
        } catch { Alert.alert('Erro', 'Nao foi possivel remover.'); }
      }}
    ]);
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.92}
        onPress={() => navigation.navigate('Detalhes', { produto: item, user })}>
        <View style={styles.imgBox}>
          <Image source={{ uri: item.imagem }} style={styles.img} resizeMode="cover" />

          <TouchableOpacity style={styles.heartBtn} onPress={() => desfavoritar(item.id, item.nome)}>
            <Ionicons name="heart" size={18} color="#E74C3C" />
          </TouchableOpacity>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.catTag}>{item.categoria}</Text>
          <Text style={styles.nome} numberOfLines={1}>{item.nome}</Text>
          <View style={styles.cardFooter}>
              <Text style={styles.preco}>R$ {item.preco?.toFixed(2)}</Text>
            <TouchableOpacity style={styles.addBtn}
              onPress={() => navigation.navigate('Detalhes', { produto: item, user })}>
              <Ionicons name="add" size={18} color={C.white} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.espresso} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Meus Favoritos</Text>
          {lista.length > 0 && <Text style={styles.subtitulo}>{lista.length} produto{lista.length > 1 ? 's' : ''} salvo{lista.length > 1 ? 's' : ''}</Text>}
        </View>
        <View style={styles.heartIconBox}>
          <Ionicons name="heart" size={20} color={C.cafe} />
        </View>
      </View>

      {lista.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="heart-outline" size={48} color={C.latte} />
          </View>
          <Text style={styles.emptyTitulo}>Lista vazia</Text>
          <Text style={styles.emptyDesc}>Explore o cardapio e salve seus produtos favoritos aqui.</Text>
          <TouchableOpacity style={styles.explorarBtn} onPress={() => navigation.navigate('Home', { user })}>
            <Ionicons name="cafe-outline" size={18} color={C.white} />
            <Text style={styles.explorarBtnTxt}>Explorar Cardapio</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={item => String(item.id)}
          style={{ flex: 1 }}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.cafe]} tintColor={C.cafe} />}
          renderItem={renderItem}
        />
      )}
      <BottomNav navigation={navigation} active="Favoritos" user={user} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'android' ? 50 : 54, paddingBottom: 16, paddingHorizontal: 20, gap: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.milk, borderWidth: 1, borderColor: C.foam, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 22, fontWeight: '800', color: C.espresso, letterSpacing: -0.3 },
  subtitulo: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  heartIconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.milk, borderWidth: 1, borderColor: C.foam, justifyContent: 'center', alignItems: 'center' },
  grid: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
  card: { width: CARD_W, backgroundColor: C.white, borderRadius: 20, marginBottom: 14, overflow: 'hidden', ...S.cardShadow, borderWidth: 1, borderColor: C.foam },
  imgBox: { width: '100%', height: 140, position: 'relative' },
  img: { width: '100%', height: '100%' },
  heartBtn: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center' },
  promoBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.vermelho, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  promoBadgeTxt: { color: C.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  cardBody: { padding: 12 },
  catTag: { fontSize: 9, fontWeight: '800', color: C.caramel, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  nome: { fontSize: 13, fontWeight: '700', color: C.espresso, marginBottom: 10, letterSpacing: -0.2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preco: { fontSize: 15, fontWeight: '800', color: C.verde },
  precoOld: { fontSize: 10, color: C.textMuted, textDecorationLine: 'line-through' },
  precoPromo: { fontSize: 14, fontWeight: '800', color: C.vermelho },
  addBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.cafe, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, paddingBottom: 100 },
  emptyIconBox: { width: 90, height: 90, borderRadius: 28, backgroundColor: C.milk, borderWidth: 1.5, borderColor: C.foam, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitulo: { fontSize: 20, fontWeight: '800', color: C.espresso, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: C.textLight, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  explorarBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cafe, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, ...S.cardShadow },
  explorarBtnTxt: { color: C.white, fontWeight: '800', fontSize: 14 },
});