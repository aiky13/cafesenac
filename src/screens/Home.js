import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, TextInput, ScrollView, Image, SafeAreaView, Platform,
  Modal, Animated, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import db from '../database/DatabaseInit';
import BottomNav from '../components/BottomNav';

export default function Home({ navigation, route }) {
  const [produtos, setProdutos] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [catAtiva, setCatAtiva] = useState('Todas');
  const [busca, setBusca] = useState('');
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // user em estado para garantir que sempre reflete o banco
  const [user, setUser] = useState(route.params?.user);
  const slideAnim = useRef(new Animated.Value(-280)).current;

  const abrirDrawer = () => {
    setDrawerAberto(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  };

  const fecharDrawer = () => {
    Animated.timing(slideAnim, { toValue: -280, duration: 250, useNativeDriver: true }).start(() => {
      setDrawerAberto(false);
    });
  };

  const irPara = (tela) => {
    fecharDrawer();
    setTimeout(() => navigation.navigate(tela, { user }), 280);
  };

  const carregarProdutos = (cat) => {
    const categoria = cat !== undefined ? cat : catAtiva;
    let query = 'SELECT * FROM produtos';
    let params = [];
    if (categoria === 'Promoções') {
      query += ' WHERE promocao = 1';
    } else if (categoria !== 'Todas') {
      query += ' WHERE categoria = ?';
      params.push(categoria);
    }
    try {
      const data = db.getAllSync(query, params);
      setProdutos(data);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    }
  };

  const carregarFavoritos = () => {
    if (!user?.id) return;
    try {
      const data = db.getAllSync('SELECT produto_id FROM favoritos WHERE usuario_id = ?', [user.id]);
      setFavoritos(data.map(f => f.produto_id));
    } catch (error) {
      console.error("Erro ao carregar favoritos:", error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregarProdutos(catAtiva);
    carregarFavoritos();
    setRefreshing(false);
  }, [catAtiva, user]);

  const produtosFiltrados = busca.trim() === ''
    ? produtos
    : produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));

  useEffect(() => {
    carregarProdutos(catAtiva);
  }, [catAtiva]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Relê o user do banco para pegar dados atualizados (foto, nome, etc.)
      if (route.params?.user?.id) {
        try {
          const userAtual = db.getFirstSync('SELECT * FROM usuarios WHERE id = ?', [route.params.user.id]);
          if (userAtual) setUser(userAtual);
        } catch (e) {}
      }
      carregarProdutos(catAtiva);
      carregarFavoritos();
    });
    carregarFavoritos();
    return unsubscribe;
  }, [navigation]);

  const toggleFavorito = (pId) => {
    if (!user?.id) return;
    try {
      const existe = db.getFirstSync('SELECT * FROM favoritos WHERE usuario_id = ? AND produto_id = ?', [user.id, pId]);
      if (existe) {
        db.runSync('DELETE FROM favoritos WHERE usuario_id = ? AND produto_id = ?', [user.id, pId]);
        setFavoritos(prev => prev.filter(id => id !== pId));
      } else {
        db.runSync('INSERT INTO favoritos (usuario_id, produto_id) VALUES (?, ?)', [user.id, pId]);
        setFavoritos(prev => [...prev, pId]);
      }
    } catch (error) {
      console.error("Erro toggleFavorito:", error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* DRAWER LATERAL */}
        <Modal visible={drawerAberto} transparent animationType="none">
          <TouchableWithoutFeedback onPress={fecharDrawer}>
            <View style={styles.overlay} />
          </TouchableWithoutFeedback>
          <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.drawerHeader}>
              <Image source={require('../../assets/logo.png')} style={styles.drawerLogo} resizeMode="contain" />
              <Text style={styles.drawerNome}>{user?.nome || 'Usuário'}</Text>
              <Text style={styles.drawerEmail}>{user?.email || ''}</Text>
            </View>

            {[
              { icon: 'home-outline',               label: 'Início',        tela: 'Home' },
              { icon: 'heart-outline',              label: 'Favoritos',     tela: 'Favoritos' },
              { icon: 'cart-outline',               label: 'Carrinho',      tela: 'Carrinho' },
              { icon: 'time-outline',               label: 'Meus Pedidos',  tela: 'MeusPedidos' },
              { icon: 'person-outline',             label: 'Meu Perfil',    tela: 'Perfil' },
              { icon: 'information-circle-outline', label: 'Sobre o App',   tela: 'Sobre' },
            ].map(item => (
              <TouchableOpacity key={item.tela} style={styles.drawerItem} onPress={() => irPara(item.tela)}>
                <Ionicons name={item.icon} size={22} color="#6F4E37" />
                <Text style={styles.drawerItemTxt}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.drawerDivider} />

            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => { fecharDrawer(); setTimeout(() => navigation.replace('Login'), 280); }}
            >
              <Ionicons name="log-out-outline" size={22} color="#E74C3C" />
              <Text style={[styles.drawerItemTxt, { color: '#E74C3C' }]}>Sair</Text>
            </TouchableOpacity>
          </Animated.View>
        </Modal>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={abrirDrawer} style={styles.hamburger}>
            <Ionicons name="menu" size={26} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.7)" />
            <TextInput
              placeholder="Buscar café..."
              style={styles.searchInput}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={busca}
              onChangeText={setBusca}
            />
            {busca.length > 0 && (
              <TouchableOpacity onPress={() => setBusca('')}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* CATEGORIAS */}
        <View style={styles.catContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Todas', 'Promoções', 'Bebidas', 'Lanches', 'Sobremesas'].map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setCatAtiva(c)}
                style={[styles.catBtn, catAtiva === c && styles.active, c === 'Promoções' && catAtiva !== c && styles.promoBtn]}
              >
                <Text style={[styles.catTxt, catAtiva === c && styles.activeTxt]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* LISTAGEM COM PULL-TO-REFRESH */}
        <FlatList
          data={produtosFiltrados}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="search-outline" size={60} color="#EEE" />
              <Text style={{ color: '#CCC', marginTop: 10, fontSize: 16 }}>Nenhum produto encontrado</Text>
            </View>
          }
          numColumns={2}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6F4E37']} tintColor="#6F4E37" />
          }
          renderItem={({ item }) => {
            const isFav = favoritos.includes(item.id);
            return (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => toggleFavorito(item.id)} style={styles.favIcon}>
                  <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#E74C3C' : '#999'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Detalhes', { produto: item, user })}>
                  <Image source={{ uri: item.imagem }} style={styles.img} />
                  {item.promocao === 1 && (
                    <View style={styles.promoBadgeHome}>
                      <Ionicons name="pricetag" size={9} color="#FFF" />
                      <Text style={styles.promoBadgeHomeTxt}>PROMO</Text>
                    </View>
                  )}
                  <Text style={styles.nome} numberOfLines={1}>{item.nome}</Text>
                  <Text style={styles.preco}>R$ {item.preco.toFixed(2)}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />

        <BottomNav navigation={navigation} active="Home" user={user} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F4F1' },
  container: { flex: 1, backgroundColor: '#F8F4F1' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 0, paddingTop: Platform.OS === 'android' ? 44 : 14,
    paddingBottom: 18, paddingHorizontal: 16, gap: 12,
    backgroundColor: '#4A2512',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    elevation: 6, shadowColor: '#4a2512', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  hamburger: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 10 },
  searchBar: {
    flex: 1, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  searchInput: { flex: 1, marginLeft: 10, color: '#FFF', fontSize: 14 },
  catContainer: { height: 56, marginBottom: 8, paddingHorizontal: 14, marginTop: 12 },
  catBtn: {
    paddingHorizontal: 18, borderRadius: 22, backgroundColor: '#FFF',
    marginRight: 8, height: 38, justifyContent: 'center',
    elevation: 1, borderWidth: 1.5, borderColor: '#EDE6DF',
  },
  active: { backgroundColor: '#4A2512', borderColor: '#4A2512', elevation: 3 },
  catTxt: { color: '#7A5C48', fontWeight: '700', fontSize: 13 },
  activeTxt: { color: '#FFF', fontWeight: '800' },
  listContent: { paddingHorizontal: 8, paddingBottom: 90, paddingTop: 4 },
  card: {
    flex: 0.5, backgroundColor: '#FFF', margin: 6,
    borderRadius: 22, padding: 10, elevation: 3,
    shadowColor: '#4A2512', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    borderWidth: 1, borderColor: '#F0EAE4',
  },
  img: { width: '100%', height: 120, borderRadius: 16 },
  favIcon: {
    position: 'absolute', top: 12, right: 12, zIndex: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 14, padding: 5,
    elevation: 2,
  },
  nome: { fontWeight: '800', marginTop: 10, color: '#2C1A0E', fontSize: 13, letterSpacing: -0.2 },
  promoBtn: { borderWidth: 2, borderColor: '#C0392B', backgroundColor: '#FFF5F5' },
  promoBadgeHome: {
    position: 'absolute', top: 10, left: 10, zIndex: 5,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#C0392B', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
  },
  promoBadgeHomeTxt: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  preco: { color: '#27ae60', fontWeight: '800', marginTop: 4, fontSize: 14 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: 280,
    backgroundColor: '#FFF', elevation: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
  },
  drawerHeader: {
    backgroundColor: '#4A1010', padding: 25, paddingTop: 30,
    marginTop: -60, paddingBottom: 25,
  },
  drawerAvatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10, marginTop: 20,
  },
  drawerLogo: { width: 90, height: 90, marginBottom: 8, marginTop: 10 },
  drawerNome: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  drawerEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3 },
  drawerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 25, gap: 15,
  },
  drawerItemTxt: { fontSize: 15, color: '#333', fontWeight: '500' },
  drawerDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 8 },
});