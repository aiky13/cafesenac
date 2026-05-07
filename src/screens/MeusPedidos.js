import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import db from '../database/DatabaseInit';
import BottomNav from '../components/BottomNav';
import { C, S } from '../theme';

const STATUS_STEP = {
  'Em Preparo':        2,
  'Pronto':            3,
  'Saiu para Entrega': 4,
  'Entregue':          5,
  'Cancelado':        -1,
};
const STATUS_COR = {
  'Em Preparo':        '#F39C12',
  'Pronto':            '#27ae60',
  'Saiu para Entrega': '#2980b9',
  'Entregue':          '#6F4E37',
  'Cancelado':         '#E74C3C',
};
// Steps para entrega
const STEPS_ENTREGA = [
  { label: 'Confirmado', icon: 'checkmark-done'   },
  { label: 'Preparando', icon: 'cafe'             },
  { label: 'Pronto',     icon: 'checkmark-circle' },
  { label: 'A Caminho',  icon: 'bicycle'          },
  { label: 'Entregue',   icon: 'home'             },
];
// Steps para retirada
const STEPS_RETIRADA = [
  { label: 'Confirmado', icon: 'checkmark-done'   },
  { label: 'Preparando', icon: 'cafe'             },
  { label: 'Pronto',     icon: 'checkmark-circle' },
  { label: 'Retirar',    icon: 'storefront'       },
];
const STEPS = STEPS_ENTREGA; // fallback
// Só permite cancelar se ainda em preparo
const PODE_CANCELAR = ['Em Preparo'];

export default function MeusPedidos({ navigation, route }) {
  const user = route.params?.user ?? null;
  const [pedidos, setPedidos] = useState([]);
  const [itensPorPedido, setItensPorPedido] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const carregarTudo = useCallback(() => {
    if (!user?.id) return;

    let listaPedidos = [];
    try {
      listaPedidos = db.getAllSync(
        'SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC',
        [user.id]
      ) ?? [];
    } catch (e) {
      console.error('Erro pedidos:', e);
      listaPedidos = [];
    }
    setPedidos(listaPedidos);

    const mapa = {};
    for (const ped of listaPedidos) {
      try {
        const its = db.getAllSync(
          'SELECT * FROM pedido_itens WHERE pedido_id = ?',
          [ped.id]
        ) ?? [];
        mapa[ped.id] = its;
      } catch (e) {
        mapa[ped.id] = [];
      }
    }
    setItensPorPedido(mapa);
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    carregarTudo();
    setRefreshing(false);
  }, [carregarTudo]);

  useEffect(() => {
    carregarTudo();
    const unsub = navigation.addListener('focus', carregarTudo);
    return unsub;
  }, [navigation, carregarTudo]);

  const ultimo = pedidos.length > 0 ? pedidos[0] : null;
  const statusAtual = ultimo ? (STATUS_STEP[ultimo.status] ?? 0) : -1;

  const cancelarPedido = (pedido) => {
    if (!PODE_CANCELAR.includes(pedido.status)) {
      Alert.alert(
        'Não é possível cancelar',
        `Pedidos com status "${pedido.status}" não podem ser cancelados.

Entre em contato com a loja.`
      );
      return;
    }
    Alert.alert(
      'Cancelar pedido',
      `Deseja cancelar o Pedido #${pedido.id}?

Esta ação não pode ser desfeita.`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar', style: 'destructive',
          onPress: () => {
            try {
              db.runSync("UPDATE pedidos SET status = 'Cancelado' WHERE id = ? AND usuario_id = ?",
                [pedido.id, user.id]);
              // Devolve estoque dos itens
              const itens = db.getAllSync('SELECT * FROM pedido_itens WHERE pedido_id = ?', [pedido.id]);
              for (const it of itens) {
                db.runSync(
                  'UPDATE produtos SET estoque = estoque + ? WHERE nome = ?',
                  [it.quantidade, it.produto_nome]
                );
              }
              carregarTudo();
              Alert.alert('Pedido cancelado', `Pedido #${pedido.id} foi cancelado com sucesso.`);
            } catch (e) {
              console.error(e);
              Alert.alert('Erro', 'Não foi possível cancelar o pedido.');
            }
          }
        }
      ]
    );
  };

  const StatusStep = ({ icon, label, active }) => (
    <View style={styles.stepContainer}>
      <View style={[styles.circle, active && styles.circleActive]}>
        <Ionicons name={icon} size={20} color={active ? '#FFF' : '#CCC'} />
      </View>
      <Text style={[styles.stepText, active && styles.stepTextActive]} numberOfLines={2}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER COM SETA DE VOLTAR */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Meus Pedidos</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6F4E37']} tintColor="#6F4E37" />
        }
      >
        {/* STATUS DO PEDIDO MAIS RECENTE */}
        <View style={styles.monitorCard}>
          {ultimo ? (
            <>
              <Text style={styles.monitorTitle}>Pedido #{ultimo.id}</Text>
              <Text style={styles.monitorStatusTxt}>{ultimo.status}</Text>

              {/* Steps — só mostra se não cancelado */}
              {ultimo.status !== 'Cancelado' ? (
                <View style={styles.statusRow}>
                  {(() => {
                    // Escolhe os steps certos: entrega ou retirada
                    const isRetirada = ultimo.tipo_entrega === 'retirada';
                    const stepsAtivos = isRetirada ? STEPS_RETIRADA : STEPS_ENTREGA;
                    return stepsAtivos.map((s, i) => (
                      <StatusStep
                        key={i}
                        icon={s.icon}
                        label={s.label}
                        active={i < statusAtual}
                        cor={STATUS_COR[ultimo.status] || '#27ae60'}
                      />
                    ));
                  })()}
                </View>
              ) : (
                <View style={styles.canceladoBox}>
                  <Ionicons name="close-circle" size={36} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.canceladoTxt}>Este pedido foi cancelado</Text>
                </View>
              )}

              {!!ultimo.forma_pagamento && (
                <Text style={styles.monitorSub}>
                  {ultimo.forma_pagamento}
                  {ultimo.tipo_entrega === 'retirada'
                    ? ` • Retirada às ${ultimo.horario_retirada}`
                    : ultimo.endereco_entrega
                    ? ` • ${ultimo.endereco_entrega}`
                    : ''}
                </Text>
              )}

              {/* Botão cancelar — só aparece se status permitir */}
              {PODE_CANCELAR.includes(ultimo.status) && (
                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => cancelarPedido(ultimo)}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#E74C3C" />
                  <Text style={styles.btnCancelarTxt}>Cancelar pedido</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.4)" />
              <Text style={[styles.monitorTitle, { marginTop: 12 }]}>
                Nenhum pedido ainda
              </Text>
            </>
          )}
        </View>

        {/* HISTÓRICO */}
        {pedidos.length > 0 && (
          <>
            <Text style={styles.historyTitle}>Histórico de Pedidos</Text>
            {pedidos.map((item) => {
              const itens = itensPorPedido[item.id] ?? [];
              return (
                <View key={item.id} style={styles.pedCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pedData}>
                      {item.data} • Pedido #{item.id}
                    </Text>
                    <Text style={[styles.pedStatus, { color: STATUS_COR[item.status] || '#6F4E37' }]}>{item.status}</Text>
                    {!!item.forma_pagamento && (
                      <Text style={styles.pedPag}>{item.forma_pagamento}</Text>
                    )}
                    {itens.map((it, i) => (
                      <Text key={i} style={styles.pedItem}>
                        {it.quantidade}x {it.produto_nome}
                      </Text>
                    ))}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.pedTotal}>
                      R$ {Number(item.total).toFixed(2)}
                    </Text>
                    {!!item.nota_fiscal && (
                      <Text style={styles.pedNota}>
                        NF-{String(item.nota_fiscal).padStart(5, '0')}
                      </Text>
                    )}
                    {PODE_CANCELAR.includes(item.status) && (
                      <TouchableOpacity
                        style={styles.btnCancelarSmall}
                        onPress={() => cancelarPedido(item)}
                      >
                        <Ionicons name="close-circle-outline" size={13} color="#E74C3C" />
                        <Text style={styles.btnCancelarSmallTxt}>Cancelar</Text>
                      </TouchableOpacity>
                    )}
                    {item.status === 'Cancelado' && (
                      <View style={styles.pedCanceladoBadge}>
                        <Text style={styles.pedCanceladoTxt}>Cancelado</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {pedidos.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={60} color="#EEE" />
            <Text style={styles.emptyText}>Nenhum pedido realizado ainda.</Text>
          </View>
        )}
      </ScrollView>

      <BottomNav navigation={navigation} active="MeusPedidos" user={user} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream, paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: Platform.OS === 'android' ? 50 : 20, marginBottom: 20 },
  backBtn: { backgroundColor: C.milk, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: C.foam },
  title: { fontSize: 22, fontWeight: 'bold', color: C.espresso },
  monitorCard: { backgroundColor: C.espresso, padding: 24, borderRadius: 28, marginBottom: 24, alignItems: 'center', ...S.strongShadow },
  monitorTitle: { color: C.white, fontSize: 17, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  monitorStatusTxt: { color: C.latte, fontSize: 13, fontWeight: '600', marginBottom: 18, letterSpacing: 0.3 },
  monitorSub: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 14, textAlign: 'center', lineHeight: 17 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  stepContainer: { alignItems: 'center', flex: 1, paddingHorizontal: 2 },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  circleActive: { backgroundColor: C.verde },
  stepText: { color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 5, textAlign: 'center', width: '100%' },
  stepTextActive: { color: C.white, fontWeight: 'bold' },
  historyTitle: { fontSize: 13, fontWeight: '700', color: C.textLight, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  pedCard: { backgroundColor: C.white, padding: 16, borderRadius: 18, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, ...S.cardShadow },
  pedData: { fontSize: 11, color: C.textMuted, marginBottom: 3 },
  pedStatus: { fontWeight: 'bold', color: C.cafe, marginBottom: 2, fontSize: 13 },
  pedPag: { fontSize: 11, color: C.textMuted, marginBottom: 4 },
  pedItem: { fontSize: 12, color: C.textMid },
  pedTotal: { fontWeight: 'bold', fontSize: 16, color: C.verde },
  pedNota: { fontSize: 10, color: C.textMuted, marginTop: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 30 },
  emptyText: { color: C.textMuted, fontSize: 15, marginTop: 15 },
  canceladoBox: { alignItems: 'center', gap: 8, paddingVertical: 10 },
  canceladoTxt: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  btnCancelar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(192,57,43,0.12)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(192,57,43,0.35)' },
  btnCancelarTxt: { color: C.vermelho, fontWeight: '600', fontSize: 13 },
  btnCancelarSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: C.vermelhoClaro, borderRadius: 10 },
  btnCancelarSmallTxt: { color: C.vermelho, fontSize: 11, fontWeight: '600' },
  pedCanceladoBadge: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.vermelhoClaro, borderRadius: 10 },
  pedCanceladoTxt: { color: C.vermelho, fontSize: 11, fontWeight: '600' },
});