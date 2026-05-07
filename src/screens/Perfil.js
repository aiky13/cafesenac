import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, SafeAreaView, LayoutAnimation, Platform, UIManager, Image,
} from 'react-native';
if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
import { Ionicons } from '@expo/vector-icons';
import db from '../database/DatabaseInit';
import DataService from '../services/DataService';
import BottomNav from '../components/BottomNav';
import { C, S } from '../theme';

export default function Perfil({ navigation, route }) {
  const user = route.params?.user || null;
  const [faqAberto, setFaqAberto] = useState(null);
  const [stats, setStats] = useState({ pedidos: 0, favoritos: 0, pontos: 0 });

  useEffect(() => {
    if (!user?.id) return;
    const carregar = () => {
      try {
        const p = db.getFirstSync('SELECT COUNT(*) as total FROM pedidos WHERE usuario_id = ?', [user.id]);
        const f = db.getFirstSync('SELECT COUNT(*) as total FROM favoritos WHERE usuario_id = ?', [user.id]);
        // Pontos ficam na tabela `pontos` (saldo), não em `usuarios`
        const pt = db.getFirstSync('SELECT saldo FROM pontos WHERE usuario_id = ?', [user.id]);
        const saldoPontos = pt?.saldo || 0;
        // Converte pontos em R$: cada 500 pontos = R$ 5,00 → 1 ponto = R$ 0,01
        const emReais = saldoPontos * 0.01;
        setStats({ pedidos: p?.total || 0, favoritos: f?.total || 0, pontos: emReais });
      } catch (e) { console.error('Erro stats perfil:', e); }
    };
    carregar();
    const unsub = navigation.addListener('focus', carregar);
    return unsub;
  }, [navigation, user]);

  if (!user?.id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
        <View style={styles.semLoginBox}>
          <Ionicons name="person-circle-outline" size={90} color={C.latte} />
          <Text style={styles.semLoginTitulo}>Você não está logado</Text>
          <Text style={styles.semLoginSub}>Faça login para acessar seu perfil completo.</Text>
          <TouchableOpacity style={styles.btnLogin} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="log-in-outline" size={20} color={C.white} />
            <Text style={styles.btnLoginTxt}>FAZER LOGIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCadastro} onPress={() => navigation.navigate('Cadastro')}>
            <Ionicons name="person-add-outline" size={18} color={C.cafe} />
            <Text style={styles.btnCadastroTxt}>CRIAR CONTA</Text>
          </TouchableOpacity>
        </View>
        <BottomNav navigation={navigation} active="Perfil" user={user} />
      </SafeAreaView>
    );
  }

  const faqs = [
    { id: 1, pergunta: 'Como faço um pedido?', resposta: 'Navegue pelo cardápio, escolha seu produto, adicione ao carrinho e finalize a compra.' },
    { id: 2, pergunta: 'Como cancelar um pedido?', resposta: 'Pedidos "Em Preparo" podem ser cancelados em Meus Pedidos. Após esse status, entre em contato com a loja.' },
    { id: 3, pergunta: 'Como funciona o sistema de pontos?', resposta: 'Cada R$1,00 gasto gera R$0,10 em pontos. Acumule R$5,00 e use como desconto no checkout.' },
    { id: 4, pergunta: 'Como usar cupom de desconto?', resposta: 'Na tela de checkout, insira o código no campo "Cupom". Cupons: CAFE10 (10% off), BEMVINDO (R$5 off).' },
    { id: 5, pergunta: 'Posso alterar meus dados?', resposta: 'Acesse "Dados Pessoais" no seu perfil para editar suas informações.' },
  ];

  const toggleFaq = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFaqAberto(faqAberto === id ? null : id);
  };

  const handleExcluir = () => {
    Alert.alert('Confirmar', 'Deseja excluir sua conta permanentemente?', [
      { text: 'Cancelar' },
      { text: 'Excluir', style: 'destructive', onPress: () => { DataService.excluirUsuario(user.id); navigation.replace('Login'); } }
    ]);
  };

  const MenuItem = ({ icon, label, onPress, danger = false, badge }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIconBox, { backgroundColor: danger ? C.vermelhoClaro : C.cream }]}>
        <Ionicons name={icon} size={19} color={danger ? C.vermelho : C.cafe} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: C.vermelho }]}>{label}</Text>
      {badge ? <View style={styles.badge}><Text style={styles.badgeTxt}>{badge}</Text></View> : null}
      <Ionicons name="chevron-forward" size={16} color={C.latte} />
    </TouchableOpacity>
  );

  const podeResgatar = stats.pontos >= 5;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerBg} />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitulo}>Meu Perfil</Text>

          {/* Avatar card */}
          <View style={styles.userCard}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarLetra}>{user.nome?.charAt(0)?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>{user.nome}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
              <View style={styles.vipBadge}>
                <Ionicons name="star" size={11} color={C.gold} />
                <Text style={styles.vipTxt}>Cliente VIP</Text>
              </View>
            </View>
          </View>
        </View>

        {/* STATS */}
        <View style={styles.statsRow}>
          {[
            { icon: 'receipt-outline', val: stats.pedidos, label: 'Pedidos' },
            { icon: 'heart-outline',   val: stats.favoritos, label: 'Favoritos' },
            { icon: 'cafe-outline',    val: `R$${Number(stats.pontos).toFixed(2)}`, label: 'Pontos' },
          ].map((s, i) => (
            <View key={i} style={[styles.statItem, i < 2 && styles.statBorder]}>
              <Ionicons name={s.icon} size={20} color={C.cafe} />
              <Text style={styles.statNum}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* PONTOS */}
        {stats.pontos > 0 && (
          <View style={[styles.section, { marginTop: 18 }]}>
            <View style={[styles.pontosCard, podeResgatar && styles.pontosCardAtivo]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pontosValor}>R$ {stats.pontos.toFixed(2)} em pontos</Text>
                <Text style={styles.pontosDesc}>
                  {podeResgatar ? '✓ Disponível para usar no checkout!' : `Faltam R$ ${(5 - stats.pontos).toFixed(2)} para resgatar`}
                </Text>
                <View style={styles.barraFundo}>
                  <View style={[styles.barraFill, { width: `${Math.min((stats.pontos / 5) * 100, 100)}%`, backgroundColor: podeResgatar ? C.verde : C.cafe }]} />
                </View>
              </View>
              <View style={[styles.pontosIconBox, podeResgatar && { backgroundColor: C.verde }]}>
                <Ionicons name="gift-outline" size={24} color={C.white} />
              </View>
            </View>
          </View>
        )}

        {/* MINHA CONTA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Minha Conta</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="person-outline"   label="Dados Pessoais"    onPress={() => navigation.navigate('DadosPessoais', { user })} />
            <View style={styles.menuDiv} />
            <MenuItem icon="location-outline" label="Meus Endereços"    onPress={() => navigation.navigate('GerenciarEnderecos', { user })} />
            <View style={styles.menuDiv} />
            <MenuItem icon="receipt-outline"  label="Meus Pedidos"      onPress={() => navigation.navigate('MeusPedidos', { user })} badge={stats.pedidos > 0 ? String(stats.pedidos) : null} />
            <View style={styles.menuDiv} />
            <MenuItem icon="heart-outline"    label="Favoritos"         onPress={() => navigation.navigate('Favoritos', { user })} />
            <View style={styles.menuDiv} />
            <MenuItem icon="cart-outline"     label="Carrinho"          onPress={() => navigation.navigate('Carrinho', { user })} />
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Central de Ajuda</Text>
          <View style={styles.menuCard}>
            {faqs.map((item, i) => (
              <View key={item.id}>
                <TouchableOpacity style={styles.faqHeader} onPress={() => toggleFaq(item.id)}>
                  <Ionicons name="help-circle-outline" size={19} color={C.cafe} />
                  <Text style={styles.faqPergunta}>{item.pergunta}</Text>
                  <Ionicons name={faqAberto === item.id ? 'chevron-up' : 'chevron-down'} size={16} color={C.latte} />
                </TouchableOpacity>
                {faqAberto === item.id && (
                  <View style={styles.faqResp}><Text style={styles.faqRespTxt}>{item.resposta}</Text></View>
                )}
                {i < faqs.length - 1 && <View style={styles.menuDiv} />}
              </View>
            ))}
          </View>
        </View>

        {/* SAIR / EXCLUIR */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem icon="log-out-outline" label="Sair da Conta"  onPress={() => navigation.replace('Login')} />
            <View style={styles.menuDiv} />
            <MenuItem icon="trash-outline"   label="Excluir Conta"  danger onPress={handleExcluir} />
          </View>
        </View>

        <Text style={styles.versao}>CaféSenac v1.0 • Sabor & Qualidade</Text>
      </ScrollView>
      <BottomNav navigation={navigation} active="Perfil" user={user} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  semLoginBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 35, paddingBottom: 100 },
  semLoginTitulo: { fontSize: 20, fontWeight: '800', color: C.espresso, marginTop: 18, marginBottom: 8 },
  semLoginSub: { fontSize: 14, color: C.textLight, textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  btnLogin: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.cafe, paddingVertical: 15, paddingHorizontal: 40, borderRadius: 16, width: '100%', justifyContent: 'center', marginBottom: 12, ...S.cardShadow },
  btnLoginTxt: { color: C.white, fontWeight: '800', fontSize: 14 },
  btnCadastro: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.cafe, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16, width: '100%', justifyContent: 'center' },
  btnCadastroTxt: { color: C.cafe, fontWeight: '700', fontSize: 14 },

  header: { marginBottom: 0 },
  headerBg: { backgroundColor: C.espresso, height: 160, position: 'absolute', top: 0, left: 0, right: 0, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  backBtn: { position: 'absolute', top: Platform.OS === 'android' ? 48 : 18, left: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 7 },
  headerTitulo: { color: C.white, fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: Platform.OS === 'android' ? 52 : 22, marginBottom: 16 },
  userCard: { backgroundColor: C.milk, marginHorizontal: 18, borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, ...S.strongShadow, marginTop: 10 },
  avatarBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.cafe, justifyContent: 'center', alignItems: 'center' },
  avatarLetra: { color: C.white, fontSize: 26, fontWeight: '800' },
  userName: { fontSize: 17, fontWeight: '800', color: C.espresso },
  userEmail: { fontSize: 12, color: C.textLight, marginTop: 2 },
  vipBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.goldLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 7, alignSelf: 'flex-start' },
  vipTxt: { fontSize: 11, color: C.espresso, fontWeight: '700' },

  statsRow: { flexDirection: 'row', backgroundColor: C.milk, marginHorizontal: 18, marginTop: 14, borderRadius: 20, padding: 18, ...S.cardShadow },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statBorder: { borderRightWidth: 1, borderColor: C.foam },
  statNum: { fontSize: 18, fontWeight: '800', color: C.espresso },
  statLabel: { fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  section: { marginHorizontal: 18, marginTop: 22 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: C.textLight, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 },
  menuCard: { backgroundColor: C.milk, borderRadius: 20, overflow: 'hidden', ...S.cardShadow },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
  menuIconBox: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 14, color: C.textDark, fontWeight: '600' },
  menuDiv: { height: 1, backgroundColor: C.cream, marginHorizontal: 14 },
  badge: { backgroundColor: C.cafe, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 4 },
  badgeTxt: { color: C.white, fontSize: 11, fontWeight: '700' },

  faqHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 10 },
  faqPergunta: { flex: 1, fontSize: 13, fontWeight: '600', color: C.textDark },
  faqResp: { backgroundColor: C.cream, marginHorizontal: 14, marginBottom: 14, padding: 14, borderRadius: 12 },
  faqRespTxt: { color: C.textMid, lineHeight: 20, fontSize: 13 },

  pontosCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.milk, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: C.foam, ...S.cardShadow },
  pontosCardAtivo: { borderColor: C.verde },
  pontosValor: { fontSize: 16, fontWeight: '800', color: C.espresso },
  pontosDesc: { fontSize: 12, color: C.textLight, marginTop: 3, marginBottom: 10 },
  barraFundo: { height: 6, backgroundColor: C.foam, borderRadius: 3 },
  barraFill: { height: 6, borderRadius: 3 },
  pontosIconBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.cafe, justifyContent: 'center', alignItems: 'center' },

  versao: { textAlign: 'center', color: C.textMuted, fontSize: 11, marginVertical: 28, letterSpacing: 0.5 },
});