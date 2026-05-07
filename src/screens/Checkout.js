import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, SafeAreaView, Modal, Platform, Clipboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import db from '../database/DatabaseInit';
import { C, S } from '../theme';
import DataService, {
  PONTOS_PARA_RESGATAR,
  VALOR_RESGATE,
} from '../services/DataService';

// ─── Componentes estáticos FORA do Checkout ───────────────────────
// Definir dentro do componente faz o React recriar a referência a cada
// render, desmontando/remontando os filhos e fechando o teclado.
function Secao({ titulo, children }) {
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      <View style={styles.secaoCard}>{children}</View>
    </View>
  );
}

function BtnOpcao({ label, icon, ativo, onPress, flex }) {
  return (
    <TouchableOpacity style={[styles.opcao, ativo && styles.opcaoAtiva, flex && { flex }]} onPress={onPress}>
      {icon && <Ionicons name={icon} size={18} color={ativo ? '#FFF' : '#6F4E37'} />}
      <Text style={[styles.opcaoTxt, ativo && { color: C.white }]}>{label}</Text>
    </TouchableOpacity>
  );
}
// ──────────────────────────────────────────────────────────────────

export default function Checkout({ navigation, route }) {
  const { user }   = route.params;
  const itensRef   = useRef(route.params?.itens ?? []);
  const itens      = itensRef.current;   // protegido contra navigate merge
  const totalBruto = route.params?.total ?? 0;

  // ── Endereços ─────────────────────────────────────────────────
  const [enderecos, setEnderecos]             = useState([]);
  const [enderecoSelecionado, setEnderecoSel] = useState(null);

  // ── Entrega ───────────────────────────────────────────────────
  const [tipoEntrega, setTipoEntrega]         = useState('entrega');
  const [horarioRetirada, setHorarioRetirada] = useState('');
  const [dataRetirada, setDataRetirada]       = useState('');

  // ── Pagamento ─────────────────────────────────────────────────
  const [formaPag, setFormaPag]               = useState('');
  const [tipoCartao, setTipoCartao]           = useState('credito');
  const [cartoes, setCartoes]                 = useState([]);
  const [cartaoSelecionado, setCartaoSel]     = useState(null);
  const [modalCartao, setModalCartao]         = useState(false);
  const [novoCartao, setNovoCartao]           = useState({ tipo: 'credito', bandeira: 'Visa', numero: '', nome: '' });

  // ── Dinheiro ──────────────────────────────────────────────────
  const [precisaTroco, setPrecisaTroco]       = useState(false);
  const [valorTroco, setValorTroco]           = useState('');

  // ── Pontos ────────────────────────────────────────────────────
  const [saldoPontos, setSaldoPontos]         = useState(0);
  const [usarPontos, setUsarPontos]           = useState(false);

  // ── Cupom ─────────────────────────────────────────────────────
  const [codigoCupom, setCodigoCupom]         = useState('');
  const [cupomAplicado, setCupomAplicado]     = useState(null); // objeto cupom
  const [errosCupom, setErroCupom]            = useState('');

  // ── Nota fiscal ───────────────────────────────────────────────
  const [modalNota, setModalNota]             = useState(false);
  const [pedidoFinalizado, setPedidoFinal]    = useState(null);

  // ── Cálculos de desconto ──────────────────────────────────────
  const { desconto: descontoPontosDisp, pontosUsados, blocos } =
    DataService.calcularResgate(saldoPontos);

  const descontoPontos  = usarPontos ? descontoPontosDisp : 0;
  const descontoCupom   = cupomAplicado
    ? DataService.calcularDescontoCupom(cupomAplicado, totalBruto)
    : 0;
  const totalComDesconto = Math.max(0, totalBruto - descontoPontos - descontoCupom);

  // Pontos que serão ganhos nesta compra (sobre o valor final pago)
  const pontosAGanhar = DataService.calcularPontosGanhos(totalComDesconto);

  // ── Carrega dados ─────────────────────────────────────────────
  const carregarDados = useCallback(() => {
    try {
      const ends = db.getAllSync(
        'SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY principal DESC, id ASC',
        [user.id]
      );
      setEnderecos(ends || []);
      if (ends?.length > 0 && !enderecoSelecionado) {
        const principal = ends.find(e => e.principal === 1) || ends[0];
        setEnderecoSel(principal);
      }
    } catch (e) { console.error('Erro endereços:', e); }

    try {
      const cards = db.getAllSync('SELECT * FROM cartoes WHERE usuario_id = ?', [user.id]);
      setCartoes(cards || []);
    } catch (e) { console.error('Erro cartões:', e); }

    // Saldo de pontos
    setSaldoPontos(DataService.getSaldoPontos(user.id));
  }, [user.id]);

  useEffect(() => { carregarDados(); }, []);

  // Ao voltar de GerenciarEnderecos, relê o endereço principal do banco
  useFocusEffect(
    useCallback(() => {
      try {
        const ends = db.getAllSync(
          'SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY principal DESC, id ASC',
          [user.id]
        );
        if (ends?.length > 0) {
          const principal = ends.find(e => e.principal === 1) || ends[0];
          setEnderecoSel(principal);
          setEnderecos(ends);
        }
      } catch (e) { console.error('Erro reload endereços:', e); }
    }, [user.id])
  );

  // ── Aplicar cupom ─────────────────────────────────────────────
  const aplicarCupom = () => {
    setErroCupom('');
    if (!codigoCupom.trim()) return setErroCupom('Digite um código de cupom.');
    const cupom = DataService.validarCupom(codigoCupom);
    if (!cupom) {
      setCupomAplicado(null);
      return setErroCupom('Cupom inválido ou expirado.');
    }
    setCupomAplicado(cupom);
    const desc = DataService.calcularDescontoCupom(cupom, totalBruto);
    Alert.alert(
      '✓ Cupom aplicado!',
      cupom.tipo === 'percentual'
        ? `Desconto de ${cupom.desconto}% — R$ ${desc.toFixed(2)} off`
        : `Desconto fixo de R$ ${desc.toFixed(2)}`
    );
  };

  const removerCupom = () => {
    setCupomAplicado(null);
    setCodigoCupom('');
    setErroCupom('');
  };

  // ── Salvar cartão ─────────────────────────────────────────────
  const salvarCartao = () => {
    if (!novoCartao.numero || !novoCartao.nome)
      return Alert.alert('Atenção', 'Preencha número e nome do cartão.');
    try {
      const final = novoCartao.numero.replace(/\D/g, '').slice(-4);
      db.runSync(
        `INSERT INTO cartoes (usuario_id, tipo, bandeira, numero_final, nome_titular) VALUES (?,?,?,?,?)`,
        [user.id, novoCartao.tipo, novoCartao.bandeira, final, novoCartao.nome]
      );
      const cards = db.getAllSync('SELECT * FROM cartoes WHERE usuario_id = ?', [user.id]);
      setCartoes(cards || []);
      setNovoCartao({ tipo: 'credito', bandeira: 'Visa', numero: '', nome: '' });
      setModalCartao(false);
      Alert.alert('✓ Cartão salvo!', 'Cartão cadastrado com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível cadastrar o cartão.');
    }
  };

  // ── Finalizar pedido ──────────────────────────────────────────
  const finalizarPedido = () => {
    if (!formaPag)
      return Alert.alert('Atenção', 'Escolha uma forma de pagamento.');
    if (tipoEntrega === 'entrega' && !enderecoSelecionado)
      return Alert.alert('Atenção', 'Selecione ou cadastre um endereço de entrega.');
    if (tipoEntrega === 'retirada' && !dataRetirada)
      return Alert.alert('Atenção', 'Selecione a data de retirada.');
    if (tipoEntrega === 'retirada' && !horarioRetirada.trim())
      return Alert.alert('Atenção', 'Informe o horário desejado para retirada.');
    if (formaPag === 'cartao' && !cartaoSelecionado)
      return Alert.alert('Atenção', 'Selecione um cartão.');
    if (formaPag === 'dinheiro' && precisaTroco) {
      const v = parseFloat(valorTroco.replace(',', '.'));
      if (!valorTroco || isNaN(v) || v <= totalComDesconto)
        return Alert.alert('Atenção', `Informe um valor de troco maior que R$ ${totalComDesconto.toFixed(2)}.`);
    }

    try {
      // Número sequencial da nota fiscal
      const ultimaNota = db.getFirstSync('SELECT MAX(nota_fiscal) as ultima FROM pedidos');
      const numNota = ((ultimaNota?.ultima) || 0) + 1;

      // Monta strings
      const e = enderecoSelecionado;
      const endStr = tipoEntrega === 'entrega' && e
        ? `${e.rua}, ${e.numero}${e.complemento ? ` - ${e.complemento}` : ''} - ${e.bairro}, ${e.cidade}/${e.estado} - CEP ${e.cep}`
        : 'Retirada na loja';

      let pagStr = '';
      if (formaPag === 'cartao') {
        pagStr = `Cartão ${cartaoSelecionado.bandeira} ${cartaoSelecionado.tipo === 'credito' ? 'Crédito' : 'Débito'} **** ${cartaoSelecionado.numero_final}`;
      } else if (formaPag === 'pix') {
        pagStr = 'PIX';
      } else {
        pagStr = precisaTroco
          ? `Dinheiro (Troco para R$ ${parseFloat(valorTroco.replace(',', '.')).toFixed(2)})`
          : 'Dinheiro (sem troco)';
      }

      if (usarPontos && descontoPontos > 0) pagStr += ` + ${pontosUsados} pontos`;

      const troco = formaPag === 'dinheiro' && precisaTroco
        ? parseFloat(valorTroco.replace(',', '.')) - totalComDesconto
        : 0;

      const dataHoje = new Date().toLocaleDateString('pt-BR');

      // INSERT pedido
      db.runSync(
        `INSERT INTO pedidos
           (usuario_id, data, total, status, forma_pagamento, tipo_entrega,
            horario_retirada, endereco_entrega, nota_fiscal, troco,
            desconto_pontos, desconto_cupom, cupom_usado, pontos_ganhos)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          user.id, dataHoje, totalComDesconto, 'Em Preparo', pagStr,
          tipoEntrega, (dataRetirada && horarioRetirada) ? `${dataRetirada} às ${horarioRetirada}` : horarioRetirada, endStr, numNota, troco,
          descontoPontos, descontoCupom,
          cupomAplicado?.codigo || null,
          pontosAGanhar,
        ]
      );

      const pedidoRow = db.getFirstSync(
        'SELECT id FROM pedidos WHERE usuario_id = ? AND nota_fiscal = ?',
        [user.id, numNota]
      );
      if (!pedidoRow?.id) throw new Error('ID do pedido não encontrado após INSERT');
      const pedidoId = pedidoRow.id;

      // INSERT itens
      for (const item of itensRef.current) {
        db.runSync(
          `INSERT INTO pedido_itens (pedido_id, produto_nome, quantidade, preco_unit) VALUES (?,?,?,?)`,
          [pedidoId, item.nome, item.quantidade, item.preco]
        );
      }

      // Operações de pontos
      if (usarPontos && pontosUsados > 0) {
        DataService.debitarPontos(user.id, pontosUsados);
      }
      DataService.adicionarPontos(user.id, pontosAGanhar);

      // Limpa carrinho
      db.runSync('DELETE FROM carrinho WHERE usuario_id = ?', [user.id]);

      const saldoFinal = DataService.getSaldoPontos(user.id);

      setPedidoFinal({
        id: pedidoId,
        nota: numNota,
        pagamento: pagStr,
        entrega: endStr,
        horario: (dataRetirada && horarioRetirada) ? `${dataRetirada} às ${horarioRetirada}` : horarioRetirada,
        tipo: tipoEntrega,
        data: dataHoje,
        troco: troco > 0 ? troco.toFixed(2) : null,
        totalBruto,
        descontoPontos,
        descontoCupom,
        cupom: cupomAplicado?.codigo || null,
        totalFinal: totalComDesconto,
        pontosGanhos: pontosAGanhar,
        saldoPontosAtual: saldoFinal,
      });

      setModalNota(true);
    } catch (e) {
      console.error('ERRO finalizarPedido:', e);
      Alert.alert('Erro', `Não foi possível finalizar o pedido.\n\n${e.message}`);
    }
  };

  const copiarPix = () => {
    Clipboard.setString('00020126330014BR.GOV.BCB.PIX0111cafeteste52040000530398654');
    Alert.alert('✓ Copiado!', 'Código PIX copiado para a área de transferência.');
  };

  const cartoesFiltrados = cartoes.filter(c => c.tipo === tipoCartao);
  const ICONE_APELIDO = { Casa: 'home-outline', Trabalho: 'briefcase-outline', Outro: 'location-outline' };
  const temDesconto = descontoPontos > 0 || descontoCupom > 0;

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>

      {/* ══════════════ MODAL NOTA FISCAL ══════════════════════ */}
      <Modal visible={modalNota} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.notaCard}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={{ alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="checkmark-circle" size={70} color="#27ae60" />
                <Text style={styles.notaTitulo}>Pedido Confirmado!</Text>
                <View style={styles.notaNumBox}>
                  <Ionicons name="document-text-outline" size={14} color="#6F4E37" />
                  <Text style={styles.notaNum}>
                    NOTA FISCAL Nº {String(pedidoFinalizado?.nota || 0).padStart(5, '0')}
                  </Text>
                </View>
              </View>

              <View style={styles.notaDivider} />

              <View style={styles.notaLinha}>
                <Text style={styles.notaLabel}>Pedido</Text>
                <Text style={styles.notaVal}>#{pedidoFinalizado?.id}</Text>
              </View>
              <View style={styles.notaLinha}>
                <Text style={styles.notaLabel}>Data</Text>
                <Text style={styles.notaVal}>{pedidoFinalizado?.data}</Text>
              </View>
              <View style={styles.notaLinha}>
                <Text style={styles.notaLabel}>Pagamento</Text>
                <Text style={styles.notaVal}>{pedidoFinalizado?.pagamento}</Text>
              </View>
              {pedidoFinalizado?.troco && (
                <View style={styles.notaLinha}>
                  <Text style={styles.notaLabel}>Troco</Text>
                  <Text style={[styles.notaVal, { color: C.verde }]}>R$ {pedidoFinalizado.troco}</Text>
                </View>
              )}
              <View style={styles.notaLinha}>
                <Text style={styles.notaLabel}>
                  {pedidoFinalizado?.tipo === 'retirada' ? 'Retirada' : 'Entrega'}
                </Text>
                <Text style={styles.notaVal}>
                  {pedidoFinalizado?.tipo === 'retirada' ? pedidoFinalizado?.horario : pedidoFinalizado?.entrega}
                </Text>
              </View>

              <View style={styles.notaDivider} />
              <Text style={[styles.notaLabel, { marginBottom: 6 }]}>Itens</Text>

              {itens?.map((item, i) => (
                <View key={i} style={styles.notaLinha}>
                  <Text style={styles.notaLabel}>{item.quantidade}x {item.nome}</Text>
                  <Text style={styles.notaVal}>R$ {(item.preco * item.quantidade).toFixed(2)}</Text>
                </View>
              ))}

              {/* Descontos na nota */}
              {(pedidoFinalizado?.descontoPontos > 0 || pedidoFinalizado?.descontoCupom > 0) && (
                <>
                  <View style={styles.notaDivider} />
                  <Text style={[styles.notaLabel, { marginBottom: 6 }]}>Descontos</Text>

                  {pedidoFinalizado?.descontoPontos > 0 && (
                    <View style={styles.notaLinha}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="star" size={12} color="#F39C12" />
                        <Text style={styles.notaLabel}>Resgate de pontos</Text>
                      </View>
                      <Text style={[styles.notaVal, { color: C.vermelho }]}>
                        - R$ {pedidoFinalizado.descontoPontos.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {pedidoFinalizado?.descontoCupom > 0 && (
                    <View style={styles.notaLinha}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="pricetag" size={12} color="#9B59B6" />
                        <Text style={styles.notaLabel}>Cupom {pedidoFinalizado.cupom}</Text>
                      </View>
                      <Text style={[styles.notaVal, { color: C.vermelho }]}>
                        - R$ {pedidoFinalizado.descontoCupom.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </>
              )}

              <View style={styles.notaDivider} />
              <View style={styles.notaLinha}>
                <Text style={[styles.notaLabel, { fontWeight: 'bold', fontSize: 15, color: C.textDark }]}>Total pago</Text>
                <Text style={[styles.notaVal, { color: C.verde, fontWeight: 'bold', fontSize: 17 }]}>
                  R$ {pedidoFinalizado?.totalFinal?.toFixed(2)}
                </Text>
              </View>

              {/* Pontos ganhos */}
              <View style={styles.notaPontosBox}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.notaPontosTxt}>
                  +{pedidoFinalizado?.pontosGanhos} pontos ganhos! Saldo atual: {pedidoFinalizado?.saldoPontosAtual} pts
                </Text>
              </View>

              <TouchableOpacity
                style={styles.notaBtn}
                onPress={() => { setModalNota(false); navigation.replace('MeusPedidos', { user }); }}
              >
                <Text style={styles.notaBtnTxt}>VER MEUS PEDIDOS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.notaBtn, { backgroundColor: C.milk, marginTop: 8 }]}
                onPress={() => { setModalNota(false); navigation.replace('Home', { user }); }}
              >
                <Text style={[styles.notaBtnTxt, { color: C.cafe }]}>VOLTAR AO INÍCIO</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══════════════ MODAL NOVO CARTÃO ══════════════════════ */}
      <Modal visible={modalCartao} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.cartaoModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTxt}>Cadastrar Cartão</Text>
              <TouchableOpacity onPress={() => setModalCartao(false)}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Tipo</Text>
            <View style={styles.rowBtns}>
              {['credito', 'debito'].map(t => (
                <BtnOpcao key={t} label={t === 'credito' ? 'Crédito' : 'Débito'}
                  ativo={novoCartao.tipo === t}
                  onPress={() => setNovoCartao({ ...novoCartao, tipo: t })} />
              ))}
            </View>

            <Text style={styles.label}>Bandeira</Text>
            <View style={[styles.rowBtns, { flexWrap: 'wrap' }]}>
              {['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex'].map(b => (
                <TouchableOpacity key={b}
                  style={[styles.opcaoSmall, novoCartao.bandeira === b && styles.opcaoAtiva]}
                  onPress={() => setNovoCartao({ ...novoCartao, bandeira: b })}
                >
                  <Text style={[{ fontSize: 12, color: C.cafe, fontWeight: '600' },
                    novoCartao.bandeira === b && { color: C.white }]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Número do cartão</Text>
            <TextInput style={styles.input} placeholder="0000 0000 0000 0000"
              keyboardType="numeric" maxLength={19}
              value={novoCartao.numero}
              onChangeText={t => setNovoCartao({ ...novoCartao, numero: t })} />

            <Text style={styles.label}>Nome do titular</Text>
            <TextInput style={styles.input} placeholder="Como no cartão"
              autoCapitalize="characters"
              value={novoCartao.nome}
              onChangeText={t => setNovoCartao({ ...novoCartao, nome: t })} />

            <View style={styles.rowBtns}>
              <TouchableOpacity style={[styles.opcao, { backgroundColor: '#EEE', borderColor: '#DDD' }]}
                onPress={() => setModalCartao(false)}>
                <Text style={{ color: '#555', fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.opcao, styles.opcaoAtiva]} onPress={salvarCartao}>
                <Text style={{ color: C.white, fontWeight: 'bold' }}>Salvar Cartão</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════ CONTEÚDO PRINCIPAL ═════════════════════ */}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitulo}>Finalizar Compra</Text>
        </View>

        {/* RESUMO */}
        <Secao titulo="Resumo do Pedido">
          {itens.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemNome}>{item.quantidade}x {item.nome}</Text>
              <Text style={styles.itemPreco}>R$ {(item.preco * item.quantidade).toFixed(2)}</Text>
            </View>
          ))}

          {/* Linha subtotal (sempre) */}
          <View style={[styles.totalRow, { borderTopWidth: temDesconto ? 1 : 0 }]}>
            <Text style={[styles.totalLabel, { fontSize: temDesconto ? 13 : 16, color: temDesconto ? '#999' : '#333' }]}>
              {temDesconto ? 'Subtotal' : 'Total'}
            </Text>
            <Text style={[styles.totalVal, { fontSize: temDesconto ? 14 : 18, color: temDesconto ? '#999' : '#27ae60' }]}>
              R$ {totalBruto.toFixed(2)}
            </Text>
          </View>

          {/* Desconto por pontos */}
          {descontoPontos > 0 && (
            <View style={styles.descontoRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="star" size={13} color="#F39C12" />
                <Text style={styles.descontoLabel}>Desconto (pontos)</Text>
              </View>
              <Text style={styles.descontoVal}>- R$ {descontoPontos.toFixed(2)}</Text>
            </View>
          )}

          {/* Desconto por cupom */}
          {descontoCupom > 0 && (
            <View style={styles.descontoRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="pricetag" size={13} color="#9B59B6" />
                <Text style={styles.descontoLabel}>Cupom {cupomAplicado?.codigo}</Text>
              </View>
              <Text style={styles.descontoVal}>- R$ {descontoCupom.toFixed(2)}</Text>
            </View>
          )}

          {/* Total final */}
          {temDesconto && (
            <View style={[styles.totalRow, { marginTop: 6 }]}>
              <Text style={styles.totalLabel}>Total a pagar</Text>
              <Text style={[styles.totalVal, { color: C.verde }]}>R$ {totalComDesconto.toFixed(2)}</Text>
            </View>
          )}

          {/* Preview de pontos a ganhar */}
          <View style={styles.pontosPreviewRow}>
            <Ionicons name="star-outline" size={14} color="#F39C12" />
            <Text style={styles.pontosPreviewTxt}>
              + {pontosAGanhar} pontos nesta compra
            </Text>
          </View>
        </Secao>

        {/* PONTOS */}
        {saldoPontos >= PONTOS_PARA_RESGATAR && (
          <Secao titulo="Meus Pontos">
            <View style={styles.pontosCheckRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pontosCheckTitulo}>
                  Você tem {saldoPontos} pontos
                </Text>
                <Text style={styles.pontosCheckSub}>
                  {blocos} resgate{blocos > 1 ? 's' : ''} disponível{blocos > 1 ? 'is' : ''}
                  {' '}= R$ {descontoPontosDisp.toFixed(2)} de desconto
                </Text>
                <Text style={styles.pontosCheckInfo}>
                  ({pontosUsados} pontos serão debitados)
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.togglePontos, usarPontos && styles.togglePontosAtivo]}
                onPress={() => setUsarPontos(!usarPontos)}
              >
                <Ionicons
                  name={usarPontos ? 'checkmark-circle' : 'ellipse-outline'}
                  size={28}
                  color={usarPontos ? '#27ae60' : '#CCC'}
                />
              </TouchableOpacity>
            </View>
          </Secao>
        )}

        {/* CUPOM */}
        <Secao titulo="Cupom de Desconto">
          {cupomAplicado ? (
            <View style={styles.cupomAplicadoRow}>
              <Ionicons name="pricetag" size={20} color="#9B59B6" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.cupomAplicadoTxt}>{cupomAplicado.codigo}</Text>
                <Text style={styles.cupomAplicadoDesc}>
                  {cupomAplicado.tipo === 'percentual'
                    ? `${cupomAplicado.desconto}% de desconto`
                    : `R$ ${cupomAplicado.desconto.toFixed(2)} de desconto`}
                </Text>
              </View>
              <TouchableOpacity onPress={removerCupom}>
                <Ionicons name="close-circle" size={22} color="#E74C3C" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.cupomInputRow}>
                <TextInput
                  style={styles.cupomInput}
                  placeholder="Digite seu cupom"
                  autoCapitalize="characters"
                  returnKeyType="done"
                  value={codigoCupom}
                  onChangeText={t => { setCodigoCupom(t); setErroCupom(''); }}
                  onSubmitEditing={aplicarCupom}
                />
                <TouchableOpacity style={styles.btnAplicarCupom} onPress={aplicarCupom}>
                  <Text style={styles.btnAplicarCupomTxt}>Aplicar</Text>
                </TouchableOpacity>
              </View>
              {!!errosCupom && (
                <View style={styles.erroCupomRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#E74C3C" />
                  <Text style={styles.erroCupom}>{errosCupom}</Text>
                </View>
              )}
              <Text style={styles.cupomDica}>Cupons de exemplo: CAFE10 (10% off) · BEMVINDO (R$ 5 off)</Text>
            </>
          )}
        </Secao>

        {/* ENTREGA OU RETIRADA */}
        <Secao titulo="Entrega ou Retirada">
          <View style={styles.rowBtns}>
            <BtnOpcao label="Entrega"  icon="bicycle-outline"    ativo={tipoEntrega === 'entrega'}   onPress={() => setTipoEntrega('entrega')} />
            <BtnOpcao label="Retirada" icon="storefront-outline" ativo={tipoEntrega === 'retirada'}  onPress={() => setTipoEntrega('retirada')} />
          </View>

          {tipoEntrega === 'retirada' && (() => {
            // Sempre recalcula a partir do momento atual — os dias "rolam" conforme o dia passa
            const diasSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
            const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
            const proxDias = Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i);
              const diaSemLabel = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : diasSemana[d.getDay()];
              // Formato salvo e exibido: "05/mai"
              const valor = `${String(d.getDate()).padStart(2,'0')}/${meses[d.getMonth()]}`;
              // Número do dia para exibir em destaque no card
              const numDia = String(d.getDate()).padStart(2,'0');
              const nomeMes = meses[d.getMonth()];
              return { diaSemLabel, valor, numDia, nomeMes, key: valor };
            });

            const HORARIOS = [
              '08:00','08:30','09:00','09:30',
              '10:00','10:30','11:00','11:30',
              '12:00','12:30','13:00','13:30',
              '14:00','14:30','15:00','15:30',
              '16:00','16:30','17:00','17:30',
              '18:00','18:30','19:00','19:30',
            ];

            return (
              <View style={{ marginTop: 16 }}>

                {/* ── Seleção de DATA ───────────────────────────── */}
                <View style={styles.relogioHeader}>
                  <Ionicons name="calendar-outline" size={20} color="#6F4E37" />
                  <Text style={styles.relogioLabel}>Data de retirada</Text>
                  {dataRetirada
                    ? <View style={styles.relogioSelecionadoBadge}><Text style={styles.relogioSelecionadoTxt}>{dataRetirada}</Text></View>
                    : <Text style={styles.relogioNenhum}>Nenhuma selecionada</Text>
                  }
                </View>

                {/* Grade de 7 cards de dia */}
                <View style={styles.diaGrid}>
                  {proxDias.map(({ diaSemLabel, valor, numDia, nomeMes, key }) => {
                    const ativo = dataRetirada === valor;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.diaCard, ativo && styles.diaCardAtivo]}
                        onPress={() => { setDataRetirada(valor); setHorarioRetirada(''); }}
                        activeOpacity={0.75}
                      >
                        {/* Label do dia da semana */}
                        <Text style={[styles.diaCardSemana, ativo && styles.diaCardTextoAtivo]}>
                          {diaSemLabel}
                        </Text>
                        {/* Número do dia em destaque */}
                        <Text style={[styles.diaCardNum, ativo && styles.diaCardTextoAtivo]}>
                          {numDia}
                        </Text>
                        {/* Mês abreviado */}
                        <Text style={[styles.diaCardMes, ativo && { color: 'rgba(255,255,255,0.75)' }]}>
                          {nomeMes}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ── Seleção de HORÁRIO — só aparece após escolher data ── */}
                {!!dataRetirada && (
                  <View style={styles.horarioContainer}>
                    <View style={styles.relogioHeader}>
                      <Ionicons name="time-outline" size={20} color="#6F4E37" />
                      <Text style={styles.relogioLabel}>Horário de retirada</Text>
                      {horarioRetirada
                        ? <View style={styles.relogioSelecionadoBadge}><Text style={styles.relogioSelecionadoTxt}>{horarioRetirada}</Text></View>
                        : <Text style={styles.relogioNenhum}>Nenhum selecionado</Text>
                      }
                    </View>

                    <View style={styles.relogioGrid}>
                      {HORARIOS.map(h => {
                        const ativo = horarioRetirada === h;
                        return (
                          <TouchableOpacity
                            key={h}
                            style={[styles.relogioSlot, ativo && styles.relogioSlotAtivo]}
                            onPress={() => setHorarioRetirada(h)}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.relogioSlotTxt, ativo && styles.relogioSlotTxtAtivo]}>
                              {h}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Resumo selecionado */}
                    {!!horarioRetirada && (
                      <View style={styles.resumoRetirada}>
                        <Ionicons name="checkmark-circle" size={18} color="#27ae60" />
                        <Text style={styles.resumoRetiradaTxt}>
                          Retirada: {dataRetirada} às {horarioRetirada}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <Text style={styles.relogioInfo}>* Horários sujeitos à disponibilidade da loja.</Text>
              </View>
            );
          })()}
        </Secao>

        {/* ENDEREÇO DE ENTREGA */}
        {tipoEntrega === 'entrega' && (
          <Secao titulo="Endereço de Entrega">
            {enderecoSelecionado ? (
              <View>
                <TouchableOpacity
                  style={styles.enderecoCard}
                  onPress={() => navigation.navigate('GerenciarEnderecos', { user })}
                >
                  <View style={styles.enderecoIconBox}>
                    <Ionicons name={ICONE_APELIDO[enderecoSelecionado.apelido] || 'location-outline'} size={20} color="#6F4E37" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.enderecoApelido}>{enderecoSelecionado.apelido}</Text>
                    <Text style={styles.enderecoRua} numberOfLines={1}>
                      {enderecoSelecionado.rua}, {enderecoSelecionado.numero}
                      {enderecoSelecionado.complemento ? ` - ${enderecoSelecionado.complemento}` : ''}
                    </Text>
                    <Text style={styles.enderecoBairro} numberOfLines={1}>
                      {enderecoSelecionado.bairro} • {enderecoSelecionado.cidade}/{enderecoSelecionado.estado}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CCC" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnTrocarEndereco}
                  onPress={() => navigation.navigate('GerenciarEnderecos', { user })}
                >
                  <Ionicons name="swap-horizontal-outline" size={16} color="#6F4E37" />
                  <Text style={styles.btnTrocarEnderecoTxt}>Gerenciar / trocar endereço</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.btnCadastrarEndereco}
                onPress={() => navigation.navigate('GerenciarEnderecos', { user })}
              >
                <Ionicons name="add-circle-outline" size={22} color="#6F4E37" />
                <Text style={styles.btnCadastrarEnderecoTxt}>Cadastrar endereço de entrega</Text>
              </TouchableOpacity>
            )}
          </Secao>
        )}

        {/* PAGAMENTO */}
        <Secao titulo="Forma de Pagamento">
          <View style={styles.rowBtns}>
            <BtnOpcao label="PIX" icon="qr-code-outline" ativo={formaPag === 'pix'} onPress={() => setFormaPag('pix')} />
            <BtnOpcao label="Cartão" icon="card-outline" ativo={formaPag === 'cartao'} onPress={() => setFormaPag('cartao')} />
            <BtnOpcao label="Dinheiro" icon="cash-outline" ativo={formaPag === 'dinheiro'} onPress={() => setFormaPag('dinheiro')} />
          </View>

          {/* PIX */}
          {formaPag === 'pix' && (
            <View style={styles.pixBox}>
              <Text style={styles.pixTitulo}>Escaneie o QR Code ou copie a chave</Text>
              <View style={styles.pixQR}>
                <Ionicons name="qr-code" size={110} color="#333" />
              </View>
              <TouchableOpacity style={styles.pixCopiaBox} onPress={copiarPix}>
                <Text style={styles.pixChave} numberOfLines={1}>
                  00020126330014BR.GOV.BCB.PIX0111cafeteste...
                </Text>
                <Ionicons name="copy-outline" size={22} color="#6F4E37" />
              </TouchableOpacity>
              <Text style={styles.pixInfo}>Chave PIX: cafeteste@cafe.com</Text>
              <Text style={styles.pixInfo}>Após o pagamento, confirme o pedido abaixo.</Text>
            </View>
          )}

          {/* CARTÃO */}
          {formaPag === 'cartao' && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.rowBtns}>
                <BtnOpcao label="Crédito" icon="card-outline" ativo={tipoCartao === 'credito'}
                  onPress={() => { setTipoCartao('credito'); setCartaoSel(null); }} />
                <BtnOpcao label="Débito" icon="card-outline" ativo={tipoCartao === 'debito'}
                  onPress={() => { setTipoCartao('debito'); setCartaoSel(null); }} />
              </View>

              {cartoesFiltrados.length === 0 ? (
                <View style={styles.semCartaoBox}>
                  <Ionicons name="card-outline" size={36} color="#DDD" />
                  <Text style={styles.semCartaoTxt}>Nenhum cartão {tipoCartao} cadastrado.</Text>
                </View>
              ) : (
                cartoesFiltrados.map(card => (
                  <TouchableOpacity key={card.id}
                    style={[styles.cartaoItem, cartaoSelecionado?.id === card.id && styles.cartaoSelecionado]}
                    onPress={() => setCartaoSel(card)}
                  >
                    <Ionicons name="card" size={22} color="#6F4E37" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartaoTxt}>{card.bandeira} • {card.tipo === 'credito' ? 'Crédito' : 'Débito'}</Text>
                      <Text style={{ fontSize: 12, color: C.textMuted }}>**** **** **** {card.numero_final}</Text>
                      <Text style={{ fontSize: 11, color: '#BBB' }}>{card.nome_titular}</Text>
                    </View>
                    {cartaoSelecionado?.id === card.id && <Ionicons name="checkmark-circle" size={22} color="#27ae60" />}
                  </TouchableOpacity>
                ))
              )}

              <TouchableOpacity style={styles.btnNovoCartao} onPress={() => setModalCartao(true)}>
                <Ionicons name="add-circle-outline" size={22} color="#6F4E37" />
                <Text style={styles.btnNovoCartaoTxt}>Cadastrar novo cartão</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* DINHEIRO */}
          {formaPag === 'dinheiro' && (
            <View style={{ marginTop: 14 }}>
              <View style={styles.dinheiroInfo}>
                <Ionicons name="cash-outline" size={28} color="#27ae60" />
                <Text style={styles.dinheiroTxt}>Pagamento em dinheiro na {tipoEntrega === 'retirada' ? 'retirada' : 'entrega'}.</Text>
              </View>

              <Text style={styles.label}>Precisa de troco?</Text>
              <View style={styles.trocoToggleRow}>
                <TouchableOpacity
                  style={[styles.trocoToggleBtn, !precisaTroco && styles.trocoToggleBtnAtivo]}
                  onPress={() => { setPrecisaTroco(false); setValorTroco(''); }}
                >
                  <Ionicons
                    name={!precisaTroco ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={!precisaTroco ? '#FFF' : '#6F4E37'}
                  />
                  <Text style={[styles.trocoToggleTxt, !precisaTroco && { color: C.white }]}>
                    Tenho o valor exato
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.trocoToggleBtn, precisaTroco && styles.trocoToggleBtnAtivoVerde]}
                  onPress={() => setPrecisaTroco(true)}
                >
                  <Ionicons
                    name={precisaTroco ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={precisaTroco ? '#FFF' : '#6F4E37'}
                  />
                  <Text style={[styles.trocoToggleTxt, precisaTroco && { color: C.white }]}>
                    Preciso de troco
                  </Text>
                </TouchableOpacity>
              </View>

              {precisaTroco && (
                <View style={styles.trocoInputBox}>
                  <Text style={styles.label}>Troco para quanto? *</Text>
                  <TextInput
                    style={styles.cupomInput}
                    placeholder={`Ex: ${(totalComDesconto + 10).toFixed(2)}`}
                    keyboardType="decimal-pad"
                    value={valorTroco}
                    onChangeText={setValorTroco}
                  />
                  {valorTroco !== '' && !isNaN(parseFloat(valorTroco.replace(',', '.'))) && parseFloat(valorTroco.replace(',', '.')) > totalComDesconto && (
                    <View style={styles.trocoPreview}>
                      <Ionicons name="information-circle-outline" size={16} color="#27ae60" />
                      <Text style={styles.trocoPreviewTxt}>
                        Você receberá R$ {(parseFloat(valorTroco.replace(',', '.')) - totalComDesconto).toFixed(2)} de troco
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </Secao>

        {/* CONFIRMAR */}
        <TouchableOpacity style={styles.btnPagar} onPress={finalizarPedido}>
          <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" />
          <Text style={styles.btnPagarTxt}>
            CONFIRMAR — R$ {totalComDesconto.toFixed(2)}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },

  header: {
    backgroundColor: C.cafe,
    paddingTop: Platform.OS === 'android' ? 45 : 20,
    paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 15,
  },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 6 },
  headerTitulo: { color: C.white, fontSize: 20, fontWeight: 'bold' },

  secao: { marginHorizontal: 20, marginTop: 20 },
  secaoTitulo: { fontSize: 12, fontWeight: 'bold', color: C.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  secaoCard: { backgroundColor: C.white, borderRadius: 20, padding: 16, elevation: 2 },

  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemNome: { color: '#555', flex: 1, fontSize: 14 },
  itemPreco: { fontWeight: 'bold', color: C.textDark, fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: C.foam, marginTop: 10, paddingTop: 10 },
  totalLabel: { fontWeight: 'bold', fontSize: 16, color: C.textDark },
  totalVal: { fontWeight: 'bold', fontSize: 18, color: C.verde },
  descontoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  descontoLabel: { color: '#888', fontSize: 13 },
  descontoVal: { color: C.vermelho, fontWeight: 'bold', fontSize: 13 },
  pontosPreviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8E1', padding: 8, borderRadius: 10, marginTop: 10,
  },
  pontosPreviewTxt: { fontSize: 12, color: '#F39C12', fontWeight: '600' },

  // Pontos
  pontosCheckRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  pontosCheckTitulo: { fontWeight: 'bold', color: C.textDark, fontSize: 14 },
  pontosCheckSub: { color: '#F39C12', fontSize: 12, marginTop: 2, fontWeight: '600' },
  pontosCheckInfo: { color: '#BBB', fontSize: 11, marginTop: 2 },
  togglePontos: { padding: 4 },
  togglePontosAtivo: {},

  // Cupom
  cupomInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cupomInput: {
    flex: 1,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E0D5CC',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: C.cream,
    fontSize: 15,
    color: C.textDark,
  },
  btnAplicarCupom: {
    backgroundColor: C.cafe,
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnAplicarCupomTxt: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  erroCupomRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  erroCupom: { color: C.vermelho, fontSize: 12, flex: 1 },
  cupomDica: { color: '#CCC', fontSize: 11, marginTop: 8 },
  cupomAplicadoRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9F2FF', padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#D7B9F5',
  },
  cupomAplicadoTxt: { fontWeight: 'bold', color: '#9B59B6', fontSize: 15 },
  cupomAplicadoDesc: { color: '#AAA', fontSize: 12, marginTop: 2 },

  rowBtns: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  opcao: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 12, borderRadius: 12,
    backgroundColor: C.milk, borderWidth: 1, borderColor: '#E8DDD5',
  },
  opcaoAtiva: { backgroundColor: C.cafe, borderColor: C.cafe },
  opcaoTxt: { color: C.cafe, fontWeight: '600', fontSize: 13 },
  opcaoSmall: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: C.milk, borderWidth: 1, borderColor: '#E8DDD5', marginBottom: 6,
  },

  input: { borderWidth: 1, borderColor: C.foam, borderRadius: 12, padding: 13, marginBottom: 10, backgroundColor: C.cream, fontSize: 14 },
  label: { color: C.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8 },

  enderecoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F9F5F2', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E8DDD5',
  },
  enderecoIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.milk, justifyContent: 'center', alignItems: 'center' },
  enderecoApelido: { fontWeight: 'bold', color: C.textDark, fontSize: 14, marginBottom: 2 },
  enderecoRua: { fontSize: 13, color: '#555' },
  enderecoBairro: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  btnTrocarEndereco: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    paddingVertical: 10, justifyContent: 'center',
    borderWidth: 1, borderColor: '#E8DDD5', borderRadius: 12,
  },
  btnTrocarEnderecoTxt: { color: C.cafe, fontWeight: '600', fontSize: 13 },
  btnCadastrarEndereco: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.cafe, borderStyle: 'dashed',
  },
  btnCadastrarEnderecoTxt: { color: C.cafe, fontWeight: '600', fontSize: 14 },

  pixBox: { marginTop: 16, alignItems: 'center' },
  pixTitulo: { fontWeight: 'bold', color: C.textDark, marginBottom: 12, fontSize: 14 },
  pixQR: { padding: 18, backgroundColor: C.cream, borderRadius: 16, marginBottom: 16, elevation: 1 },
  pixCopiaBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.milk, padding: 14, borderRadius: 12, width: '100%', gap: 10 },
  pixChave: { flex: 1, fontSize: 12, color: '#555' },
  pixInfo: { color: C.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' },

  cartaoItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: C.cream, marginTop: 10, borderWidth: 1, borderColor: C.foam },
  cartaoSelecionado: { borderColor: C.verde, backgroundColor: '#F0FFF4' },
  cartaoTxt: { color: C.textDark, fontWeight: '600', fontSize: 14 },
  semCartaoBox: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  semCartaoTxt: { color: '#CCC', fontSize: 13, textAlign: 'center' },
  btnNovoCartao: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 4, marginTop: 4 },
  btnNovoCartaoTxt: { color: C.cafe, fontWeight: '600', fontSize: 14 },

  dinheiroInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  dinheiroTxt: { color: C.textDark, fontWeight: '500', fontSize: 14, flex: 1 },

  // Troco toggle
  trocoToggleRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  trocoToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#E0D5CC',
    backgroundColor: C.milk,
  },
  trocoToggleBtnAtivo: {
    backgroundColor: C.cafe, borderColor: C.cafe,
  },
  trocoToggleBtnAtivoVerde: {
    backgroundColor: C.verde, borderColor: C.verde,
  },
  trocoToggleTxt: { fontSize: 12, fontWeight: '600', color: C.cafe, textAlign: 'center' },

  trocoInputBox: { marginTop: 14 },
  trocoPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FFF4', padding: 12, borderRadius: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#C3E6CB',
  },
  trocoPreviewTxt: { color: C.verde, fontWeight: 'bold', fontSize: 14, flex: 1 },

  btnPagar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: C.verde, margin: 20, padding: 20, borderRadius: 18, elevation: 4 },
  btnPagarTxt: { color: C.white, fontWeight: 'bold', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  notaCard: { backgroundColor: C.white, borderRadius: 25, padding: 25, maxHeight: '90%' },
  notaTitulo: { fontSize: 22, fontWeight: 'bold', color: C.textDark, marginTop: 8, marginBottom: 6 },
  notaNumBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.milk, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, marginBottom: 8 },
  notaNum: { fontSize: 13, color: C.cafe, fontWeight: 'bold' },
  notaLinha: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 8 },
  notaLabel: { color: C.textMuted, fontSize: 13 },
  notaVal: { color: C.textDark, fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  notaDivider: { height: 1, backgroundColor: '#EEE', width: '100%', marginVertical: 10 },
  notaPontosBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8E1', padding: 12, borderRadius: 12, marginBottom: 12, marginTop: 4,
  },
  notaPontosTxt: { color: '#F39C12', fontWeight: 'bold', fontSize: 13, flex: 1 },
  notaBtn: { backgroundColor: C.cafe, padding: 16, borderRadius: 15, width: '100%', alignItems: 'center', marginTop: 10 },
  notaBtnTxt: { color: C.white, fontWeight: 'bold', fontSize: 14 },

  cartaoModal: { backgroundColor: C.white, borderRadius: 25, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalHeaderTxt: { fontSize: 18, fontWeight: 'bold', color: C.textDark },

  // ── Seletor de horário (relógio) ──────────────────────────────
  relogioHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  relogioLabel: { flex: 1, fontWeight: 'bold', color: C.textDark, fontSize: 14 },
  relogioSelecionadoBadge: {
    backgroundColor: C.cafe, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20,
  },
  relogioSelecionadoTxt: { color: C.white, fontWeight: 'bold', fontSize: 14 },
  relogioNenhum: { color: '#CCC', fontSize: 13 },
  relogioGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  relogioSlot: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.milk,
    borderWidth: 1,
    borderColor: '#E8DDD5',
    alignItems: 'center',
  },
  relogioSlotAtivo: {
    backgroundColor: C.cafe,
    borderColor: C.cafe,
  },
  relogioSlotTxt: { fontSize: 13, fontWeight: '600', color: C.cafe },
  relogioSlotTxtAtivo: { color: C.white },
  relogioInfo: { fontSize: 11, color: '#BBB', marginTop: 12, textAlign: 'center' },
  // ── Grade de dias de retirada ──────────────────────────────────
  diaGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 7,
    marginBottom: 18,
  },
  diaCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 14,
    backgroundColor: C.milk,
    borderWidth: 1.5,
    borderColor: '#E8DDD5',
  },
  diaCardAtivo: {
    backgroundColor: C.cafe,
    borderColor: C.cafe,
  },
  diaCardSemana: {
    fontSize: 9,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  diaCardNum: {
    fontSize: 18,
    fontWeight: 'bold',
    color: C.textDark,
    lineHeight: 20,
  },
  diaCardMes: {
    fontSize: 10,
    color: '#AAA',
    marginTop: 2,
  },
  diaCardTextoAtivo: {
    color: C.white,
  },
  horarioContainer: {
    backgroundColor: '#F9F5F2',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  resumoRetirada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FFF4',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#C3E6CB',
  },
  resumoRetiradaTxt: {
    color: C.verde,
    fontWeight: 'bold',
    fontSize: 13,
  },
  diaSlot: {
    width: '22%', paddingVertical: 10, borderRadius: 12,
    backgroundColor: C.milk, borderWidth: 1, borderColor: '#E8DDD5',
    alignItems: 'center',
  },
  diaSlotLabel: { fontSize: 11, fontWeight: 'bold', color: C.cafe },
  diaSlotValor: { fontSize: 11, color: C.textMuted, marginTop: 2 },
});