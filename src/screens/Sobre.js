import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNav from '../components/BottomNav';
import { C, S } from '../theme';

export default function Sobre({ navigation, route }) {
  const user = route.params?.user;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const InfoItem = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color="#6F4E37" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F8F8' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6F4E37']} tintColor="#6F4E37" />
        }
      >
        {/* HEADER COM SETA DE VOLTAR */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Image source={require('../../assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
          <Text style={styles.appNome}>CaféSenac</Text>
          <Text style={styles.versao}>Versão 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre o App</Text>
          <View style={styles.card}>
            <Text style={styles.descricao}>
              O CaféSenac é um aplicativo de pedidos para cafeteria, desenvolvido para facilitar a experiência de compra de cafés, lanches e sobremesas. Navegue pelo cardápio, favorite seus produtos preferidos e acompanhe seus pedidos em tempo real.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações</Text>
          <View style={styles.card}>
            <InfoItem icon="code-slash-outline"     label="Versão"         value="1.0.0" />
            <View style={styles.divider} />
            <InfoItem icon="phone-portrait-outline" label="Plataforma"     value="Android & iOS" />
            <View style={styles.divider} />
            <InfoItem icon="construct-outline"      label="Tecnologia"     value="React Native + Expo" />
            <View style={styles.divider} />
            <InfoItem icon="server-outline"         label="Banco de dados" value="SQLite (expo-sqlite)" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Desenvolvedor</Text>
          <View style={styles.card}>
            <InfoItem icon="person-outline"   label="Nome"   value="Aluno — CaféSenac" />
            <View style={styles.divider} />
            <InfoItem icon="school-outline"   label="Curso"  value="Desenvolvimento de Sistemas" />
            <View style={styles.divider} />
            <InfoItem icon="location-outline" label="Local"  value="LInhares, Espírito Santo" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Funcionalidades</Text>
          <View style={styles.card}>
            {[
              { icon: 'log-in-outline',  txt: 'Login e cadastro de usuários' },
              { icon: 'cafe-outline',    txt: 'Cardápio com categorias e busca' },
              { icon: 'heart-outline',   txt: 'Lista de produtos favoritos' },
              { icon: 'cart-outline',    txt: 'Carrinho e finalização de pedidos' },
              { icon: 'time-outline',    txt: 'Acompanhamento de status do pedido' },
              { icon: 'person-outline',  txt: 'Perfil do usuário com FAQ' },
            ].map((item, i, arr) => (
              <View key={i}>
                <View style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={item.icon} size={18} color="#6F4E37" />
                  </View>
                  <Text style={styles.featureTxt}>{item.txt}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>Feito com ☕ e muito código</Text>
      </ScrollView>

      <BottomNav navigation={navigation} active="Sobre" user={user} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: C.espresso, alignItems: 'center', paddingTop: 54, paddingBottom: 40 },
  backBtn: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 6 },
  logoImg: { width: 120, height: 120, marginBottom: 10 },
  appNome: { color: C.white, fontSize: 26, fontWeight: 'bold', letterSpacing: 0.5 },
  versao: { color: C.latte, fontSize: 12, marginTop: 4, letterSpacing: 1 },
  section: { paddingHorizontal: 18, marginTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.textLight, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 5, ...S.cardShadow },
  descricao: { color: C.textMid, lineHeight: 22, fontSize: 14, padding: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  infoLabel: { fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.textDark, marginTop: 2 },
  divider: { height: 1, backgroundColor: C.foam, marginHorizontal: 15 },
  featureRow: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.milk, justifyContent: 'center', alignItems: 'center' },
  featureTxt: { fontSize: 14, color: C.textMid, flex: 1 },
  footer: { textAlign: 'center', color: C.textMuted, fontSize: 12, marginVertical: 30, letterSpacing: 0.5 },
  logoBox: {},
});