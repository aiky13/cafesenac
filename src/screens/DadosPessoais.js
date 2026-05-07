import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, SafeAreaView, Platform, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import db from '../database/DatabaseInit';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const APELIDOS = ['Casa', 'Trabalho', 'Outro'];
const ICONE_APELIDO = {
  Casa: 'home-outline',
  Trabalho: 'briefcase-outline',
  Outro: 'location-outline',
};
const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'Hipercard', 'Amex'];

const enderecoVazio = {
  apelido: 'Casa', cep: '', rua: '', numero: '',
  complemento: '', bairro: '', cidade: '', estado: '',
};

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────
export default function DadosPessoais({ navigation, route }) {
  const userParam = route.params?.user;

  // ── Dados do usuário ──────────────────────────────────────
  const [user, setUser] = useState(userParam);
  const [editandoDados, setEditandoDados] = useState(false);
  const [formDados, setFormDados] = useState({
    nome: userParam?.nome || '',
    email: userParam?.email || '',
    telefone: userParam?.telefone || '',
    senha: '',
    senhaAtual: '',
  });

  // ── Endereços ─────────────────────────────────────────────
  const [enderecos, setEnderecos] = useState([]);
  const [modalEndereco, setModalEndereco] = useState(false);
  const [editandoEnd, setEditandoEnd] = useState(null);
  const [formEnd, setFormEnd] = useState(enderecoVazio);

  // ── Cartões ───────────────────────────────────────────────
  const [cartoes, setCartoes] = useState([]);
  const [modalCartao, setModalCartao] = useState(false);
  const [novoCartao, setNovoCartao] = useState({
    tipo: 'credito', bandeira: 'Visa', numero: '', nome: '',
  });

  // ── Acordeões ─────────────────────────────────────────────
  const [secaoAberta, setSecaoAberta] = useState('dados'); // 'dados' | 'enderecos' | 'cartoes'

  // ─────────────────────────────────────────────────────────
  const carregarTudo = useCallback(() => {
    if (!user?.id) return;
    try {
      const u = db.getFirstSync('SELECT * FROM usuarios WHERE id = ?', [user.id]);
      if (u) {
        setUser(u);
        setFormDados({ nome: u.nome, email: u.email, telefone: u.telefone || '', senha: '', senhaAtual: '' });
      }
    } catch (e) { console.error('Erro carregar usuário:', e); }

    try {
      const ends = db.getAllSync(
        'SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY principal DESC, id ASC',
        [user.id]
      );
      setEnderecos(ends || []);
    } catch (e) { console.error('Erro endereços:', e); }

    try {
      const cards = db.getAllSync('SELECT * FROM cartoes WHERE usuario_id = ?', [user.id]);
      setCartoes(cards || []);
    } catch (e) { console.error('Erro cartões:', e); }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { carregarTudo(); }, [carregarTudo]));

  // ─────────────────────────────────────────────────────────
  // Salvar dados pessoais
  // ─────────────────────────────────────────────────────────
  const salvarDados = () => {
    const { nome, email, telefone, senha, senhaAtual } = formDados;

    if (!nome.trim() || !email.trim() || !telefone.trim())
      return Alert.alert('Atenção', 'Nome, e-mail e telefone são obrigatórios.');

    // Valida senha atual se quiser trocar
    if (senha.trim()) {
      if (!senhaAtual.trim())
        return Alert.alert('Atenção', 'Informe sua senha atual para definir uma nova.');
      const check = db.getFirstSync(
        'SELECT id FROM usuarios WHERE id = ? AND senha = ?',
        [user.id, senhaAtual]
      );
      if (!check)
        return Alert.alert('Senha incorreta', 'A senha atual informada não confere.');
    }

    try {
      if (senha.trim()) {
        db.runSync(
          'UPDATE usuarios SET nome = ?, email = ?, telefone = ?, senha = ? WHERE id = ?',
          [nome.trim(), email.trim().toLowerCase(), telefone.trim(), senha, user.id]
        );
      } else {
        db.runSync(
          'UPDATE usuarios SET nome = ?, email = ?, telefone = ? WHERE id = ?',
          [nome.trim(), email.trim().toLowerCase(), telefone.trim(), user.id]
        );
      }
      setEditandoDados(false);
      carregarTudo();
      Alert.alert('✓ Salvo!', 'Dados atualizados com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'E-mail já cadastrado por outro usuário.');
    }
  };

  const cancelarEdicao = () => {
    setEditandoDados(false);
    setFormDados({
      nome: user.nome, email: user.email,
      telefone: user.telefone || '', senha: '', senhaAtual: '',
    });
  };

  // ─────────────────────────────────────────────────────────
  // Endereços
  // ─────────────────────────────────────────────────────────
  const abrirNovoEnd = () => {
    setEditandoEnd(null);
    setFormEnd(enderecoVazio);
    setModalEndereco(true);
  };

  const abrirEditarEnd = (end) => {
    setEditandoEnd(end.id);
    setFormEnd({
      apelido: end.apelido || 'Casa',
      cep: end.cep || '', rua: end.rua || '',
      numero: end.numero || '', complemento: end.complemento || '',
      bairro: end.bairro || '', cidade: end.cidade || '', estado: end.estado || '',
    });
    setModalEndereco(true);
  };

  const salvarEndereco = () => {
    const obrig = ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'];
    if (obrig.some(c => !formEnd[c]?.trim()))
      return Alert.alert('Atenção', 'Preencha os campos obrigatórios (*).');
    try {
      if (editandoEnd) {
        db.runSync(
          `UPDATE enderecos SET apelido=?,cep=?,rua=?,numero=?,complemento=?,bairro=?,cidade=?,estado=?
           WHERE id=? AND usuario_id=?`,
          [formEnd.apelido, formEnd.cep, formEnd.rua, formEnd.numero,
            formEnd.complemento, formEnd.bairro, formEnd.cidade, formEnd.estado,
            editandoEnd, user.id]
        );
      } else {
        const isPrincipal = enderecos.length === 0 ? 1 : 0;
        db.runSync(
          `INSERT INTO enderecos (usuario_id,apelido,cep,rua,numero,complemento,bairro,cidade,estado,principal)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [user.id, formEnd.apelido, formEnd.cep, formEnd.rua, formEnd.numero,
            formEnd.complemento, formEnd.bairro, formEnd.cidade, formEnd.estado, isPrincipal]
        );
      }
      setModalEndereco(false);
      carregarTudo();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar o endereço.');
    }
  };

  const excluirEndereco = (id, isPrincipal) => {
    if (enderecos.length === 1) {
      // Único endereço — permite excluir sem promover
    }
    Alert.alert('Excluir endereço', 'Tem certeza?', [
      { text: 'Cancelar' },
      {
        text: 'Excluir', style: 'destructive', onPress: () => {
          try {
            db.runSync('DELETE FROM enderecos WHERE id = ? AND usuario_id = ?', [id, user.id]);
            if (isPrincipal) {
              const resto = db.getAllSync(
                'SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY id ASC', [user.id]
              );
              if (resto.length > 0)
                db.runSync('UPDATE enderecos SET principal = 1 WHERE id = ?', [resto[0].id]);
            }
            carregarTudo();
          } catch (e) { Alert.alert('Erro', 'Não foi possível excluir.'); }
        }
      }
    ]);
  };

  const definirPrincipal = (id) => {
    try {
      db.runSync('UPDATE enderecos SET principal = 0 WHERE usuario_id = ?', [user.id]);
      db.runSync('UPDATE enderecos SET principal = 1 WHERE id = ?', [id]);
      carregarTudo();
    } catch (e) { console.error(e); }
  };

  // ─────────────────────────────────────────────────────────
  // Cartões
  // ─────────────────────────────────────────────────────────
  const salvarCartao = () => {
    if (!novoCartao.numero || !novoCartao.nome)
      return Alert.alert('Atenção', 'Preencha número e nome do titular.');
    try {
      const final = novoCartao.numero.replace(/\D/g, '').slice(-4);
      db.runSync(
        `INSERT INTO cartoes (usuario_id, tipo, bandeira, numero_final, nome_titular) VALUES (?,?,?,?,?)`,
        [user.id, novoCartao.tipo, novoCartao.bandeira, final, novoCartao.nome]
      );
      setNovoCartao({ tipo: 'credito', bandeira: 'Visa', numero: '', nome: '' });
      setModalCartao(false);
      carregarTudo();
      Alert.alert('✓ Cartão salvo!', 'Cartão cadastrado com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível cadastrar o cartão.');
    }
  };

  const excluirCartao = (id) => {
    Alert.alert('Excluir cartão', 'Tem certeza que deseja remover este cartão?', [
      { text: 'Cancelar' },
      {
        text: 'Remover', style: 'destructive', onPress: () => {
          try {
            db.runSync('DELETE FROM cartoes WHERE id = ? AND usuario_id = ?', [id, user.id]);
            carregarTudo();
          } catch (e) { Alert.alert('Erro', 'Não foi possível remover.'); }
        }
      }
    ]);
  };

  // ─────────────────────────────────────────────────────────
  // Sub-componentes
  // ─────────────────────────────────────────────────────────
  const BtnOpcao = ({ label, icon, ativo, onPress }) => (
    <TouchableOpacity
      style={[styles.opcao, ativo && styles.opcaoAtiva]}
      onPress={onPress}
    >
      {icon && <Ionicons name={icon} size={16} color={ativo ? '#FFF' : '#6F4E37'} />}
      <Text style={[styles.opcaoTxt, ativo && { color: '#FFF' }]}>{label}</Text>
    </TouchableOpacity>
  );

  const Accordion = ({ id, icon, titulo, badge, children }) => {
    const aberto = secaoAberta === id;
    return (
      <View style={styles.accordion}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => setSecaoAberta(aberto ? null : id)}
          activeOpacity={0.8}
        >
          <View style={styles.accordionIconBox}>
            <Ionicons name={icon} size={20} color="#6F4E37" />
          </View>
          <Text style={styles.accordionTitulo}>{titulo}</Text>
          {badge != null && (
            <View style={styles.accordionBadge}>
              <Text style={styles.accordionBadgeTxt}>{badge}</Text>
            </View>
          )}
          <Ionicons
            name={aberto ? 'chevron-up' : 'chevron-down'}
            size={18} color="#CCC"
          />
        </TouchableOpacity>
        {aberto && <View style={styles.accordionBody}>{children}</View>}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>

      {/* ════════════ MODAL ENDEREÇO ═══════════════════════════ */}
      <Modal visible={modalEndereco} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                {editandoEnd ? 'Editar Endereço' : 'Novo Endereço'}
              </Text>
              <TouchableOpacity onPress={() => setModalEndereco(false)}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={styles.label}>Apelido *</Text>
              <View style={styles.rowBtns}>
                {APELIDOS.map(a => (
                  <BtnOpcao
                    key={a} label={a} icon={ICONE_APELIDO[a]}
                    ativo={formEnd.apelido === a}
                    onPress={() => setFormEnd({ ...formEnd, apelido: a })}
                  />
                ))}
              </View>

              <Text style={styles.label}>CEP *</Text>
              <TextInput style={styles.input} placeholder="00000-000"
                value={formEnd.cep} keyboardType="numeric" maxLength={9}
                onChangeText={t => setFormEnd({ ...formEnd, cep: t })} />

              <Text style={styles.label}>Rua / Avenida *</Text>
              <TextInput style={styles.input} placeholder="Ex: Av. das Palmeiras"
                value={formEnd.rua}
                onChangeText={t => setFormEnd({ ...formEnd, rua: t })} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 0.35 }}>
                  <Text style={styles.label}>Número *</Text>
                  <TextInput style={styles.input} placeholder="123"
                    value={formEnd.numero} keyboardType="numeric"
                    onChangeText={t => setFormEnd({ ...formEnd, numero: t })} />
                </View>
                <View style={{ flex: 0.65 }}>
                  <Text style={styles.label}>Complemento</Text>
                  <TextInput style={styles.input} placeholder="Apto, bloco..."
                    value={formEnd.complemento}
                    onChangeText={t => setFormEnd({ ...formEnd, complemento: t })} />
                </View>
              </View>

              <Text style={styles.label}>Bairro *</Text>
              <TextInput style={styles.input} placeholder="Ex: Centro"
                value={formEnd.bairro}
                onChangeText={t => setFormEnd({ ...formEnd, bairro: t })} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 0.65 }}>
                  <Text style={styles.label}>Cidade *</Text>
                  <TextInput style={styles.input} placeholder="Ex: Serra"
                    value={formEnd.cidade}
                    onChangeText={t => setFormEnd({ ...formEnd, cidade: t })} />
                </View>
                <View style={{ flex: 0.3 }}>
                  <Text style={styles.label}>UF *</Text>
                  <TextInput style={styles.input} placeholder="ES"
                    value={formEnd.estado} maxLength={2}
                    onChangeText={t => setFormEnd({ ...formEnd, estado: t.toUpperCase() })} />
                </View>
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.btnCancelarModal}
                  onPress={() => setModalEndereco(false)}
                >
                  <Text style={styles.btnCancelarModalTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSalvarModal} onPress={salvarEndereco}>
                  <Ionicons name="save-outline" size={18} color="#FFF" />
                  <Text style={styles.btnSalvarModalTxt}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════════════ MODAL CARTÃO ═════════════════════════════ */}
      <Modal visible={modalCartao} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Cadastrar Cartão</Text>
              <TouchableOpacity onPress={() => setModalCartao(false)}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={styles.label}>Tipo</Text>
              <View style={styles.rowBtns}>
                {['credito', 'debito'].map(t => (
                  <BtnOpcao key={t}
                    label={t === 'credito' ? 'Crédito' : 'Débito'}
                    ativo={novoCartao.tipo === t}
                    onPress={() => setNovoCartao({ ...novoCartao, tipo: t })} />
                ))}
              </View>

              <Text style={styles.label}>Bandeira</Text>
              <View style={[styles.rowBtns, { flexWrap: 'wrap' }]}>
                {BANDEIRAS.map(b => (
                  <TouchableOpacity key={b}
                    style={[styles.opcaoSmall, novoCartao.bandeira === b && styles.opcaoAtiva]}
                    onPress={() => setNovoCartao({ ...novoCartao, bandeira: b })}
                  >
                    <Text style={[styles.opcaoSmallTxt, novoCartao.bandeira === b && { color: '#FFF' }]}>
                      {b}
                    </Text>
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

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.btnCancelarModal}
                  onPress={() => setModalCartao(false)}
                >
                  <Text style={styles.btnCancelarModalTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSalvarModal} onPress={salvarCartao}>
                  <Ionicons name="card-outline" size={18} color="#FFF" />
                  <Text style={styles.btnSalvarModalTxt}>Salvar Cartão</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════════════ CONTEÚDO ═════════════════════════════════ */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dados Pessoais</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* ── AVATAR ── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={44} color="#FFF" />
          </View>
          <Text style={styles.avatarNome}>{user?.nome}</Text>
          <Text style={styles.avatarEmail}>{user?.email}</Text>
        </View>

        {/* ══════════ DADOS PESSOAIS ══════════════════════════ */}
        <Accordion id="dados" icon="person-outline" titulo="Dados Cadastrais">

          {/* CPF — read-only */}
          <View style={styles.campoReadOnly}>
            <View style={styles.campoReadOnlyLeft}>
              <Text style={styles.campoLabel}>CPF</Text>
              <Text style={styles.campoValor}>{user?.cpf || '—'}</Text>
            </View>
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={12} color="#999" />
              <Text style={styles.lockTxt}>Fixo</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {!editandoDados ? (
            /* MODO VISUALIZAÇÃO */
            <>
              <CampoInfo icon="person-outline" label="Nome" value={user?.nome} />
              <View style={styles.divider} />
              <CampoInfo icon="mail-outline" label="E-mail" value={user?.email} />
              <View style={styles.divider} />
              <CampoInfo icon="call-outline" label="Telefone" value={user?.telefone || '—'} />
              <View style={styles.divider} />
              <CampoInfo icon="key-outline" label="Senha" value="••••••••" />

              <TouchableOpacity
                style={styles.btnEditar}
                onPress={() => setEditandoDados(true)}
              >
                <Ionicons name="pencil-outline" size={16} color="#6F4E37" />
                <Text style={styles.btnEditarTxt}>Editar informações</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* MODO EDIÇÃO */
            <>
              <Text style={styles.label}>Nome completo *</Text>
              <TextInput style={styles.input} value={formDados.nome}
                onChangeText={t => setFormDados({ ...formDados, nome: t })} />

              <Text style={styles.label}>E-mail *</Text>
              <TextInput style={styles.input} value={formDados.email}
                keyboardType="email-address" autoCapitalize="none"
                onChangeText={t => setFormDados({ ...formDados, email: t })} />

              <Text style={styles.label}>Telefone *</Text>
              <TextInput style={styles.input} value={formDados.telefone}
                keyboardType="phone-pad"
                onChangeText={t => setFormDados({ ...formDados, telefone: t })} />

              <View style={styles.senhaDivider}>
                <Ionicons name="key-outline" size={14} color="#999" />
                <Text style={styles.senhaDividerTxt}>Alterar senha (opcional)</Text>
              </View>

              <Text style={styles.label}>Senha atual</Text>
              <TextInput style={styles.input} secureTextEntry
                placeholder="Obrigatório para trocar a senha"
                value={formDados.senhaAtual}
                onChangeText={t => setFormDados({ ...formDados, senhaAtual: t })} />

              <Text style={styles.label}>Nova senha</Text>
              <TextInput style={styles.input} secureTextEntry
                placeholder="Deixe em branco para manter"
                value={formDados.senha}
                onChangeText={t => setFormDados({ ...formDados, senha: t })} />

              <View style={styles.rowAcoes}>
                <TouchableOpacity style={styles.btnCancelar} onPress={cancelarEdicao}>
                  <Text style={styles.btnCancelarTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSalvar} onPress={salvarDados}>
                  <Ionicons name="checkmark-outline" size={18} color="#FFF" />
                  <Text style={styles.btnSalvarTxt}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Accordion>

        {/* ══════════ ENDEREÇOS ═══════════════════════════════ */}
        <Accordion
          id="enderecos"
          icon="location-outline"
          titulo="Endereços"
          badge={enderecos.length}
        >
          {enderecos.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="location-outline" size={40} color="#E8E8E8" />
              <Text style={styles.vazioTxt}>Nenhum endereço cadastrado</Text>
            </View>
          ) : (
            enderecos.map((end, idx) => (
              <View key={end.id}>
                <View style={[styles.endCard, end.principal === 1 && styles.endCardPrincipal]}>
                  <View style={styles.endTop}>
                    <View style={styles.endIconBox}>
                      <Ionicons
                        name={ICONE_APELIDO[end.apelido] || 'location-outline'}
                        size={18} color="#6F4E37"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.endTitleRow}>
                        <Text style={styles.endApelido}>{end.apelido}</Text>
                        {end.principal === 1 && (
                          <View style={styles.badgePrincipal}>
                            <Ionicons name="star" size={10} color="#6F4E37" />
                            <Text style={styles.badgePrincipalTxt}>Principal</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.endRua} numberOfLines={1}>
                        {end.rua}, {end.numero}
                        {end.complemento ? ` - ${end.complemento}` : ''}
                      </Text>
                      <Text style={styles.endBairro} numberOfLines={1}>
                        {end.bairro} • {end.cidade}/{end.estado} • CEP {end.cep}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.endAcoes}>
                    {end.principal !== 1 && (
                      <TouchableOpacity
                        style={styles.acaoBtn}
                        onPress={() => definirPrincipal(end.id)}
                      >
                        <Ionicons name="star-outline" size={14} color="#F39C12" />
                        <Text style={[styles.acaoTxt, { color: '#F39C12' }]}>Principal</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.acaoBtn} onPress={() => abrirEditarEnd(end)}>
                      <Ionicons name="pencil-outline" size={14} color="#6F4E37" />
                      <Text style={styles.acaoTxt}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acaoBtn}
                      onPress={() => excluirEndereco(end.id, end.principal === 1)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#E74C3C" />
                      <Text style={[styles.acaoTxt, { color: '#E74C3C' }]}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {idx < enderecos.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}

          <TouchableOpacity style={styles.btnAdicionarDashed} onPress={abrirNovoEnd}>
            <Ionicons name="add-circle-outline" size={18} color="#6F4E37" />
            <Text style={styles.btnAdicionarDashedTxt}>Adicionar endereço</Text>
          </TouchableOpacity>
        </Accordion>

        {/* ══════════ CARTÕES ═════════════════════════════════ */}
        <Accordion
          id="cartoes"
          icon="card-outline"
          titulo="Cartões Salvos"
          badge={cartoes.length}
        >
          {cartoes.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="card-outline" size={40} color="#E8E8E8" />
              <Text style={styles.vazioTxt}>Nenhum cartão cadastrado</Text>
            </View>
          ) : (
            cartoes.map((card, idx) => (
              <View key={card.id}>
                <View style={styles.cartaoItem}>
                  <View style={styles.cartaoIconBox}>
                    <Ionicons name="card" size={20} color="#6F4E37" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartaoTitulo}>
                      {card.bandeira} • {card.tipo === 'credito' ? 'Crédito' : 'Débito'}
                    </Text>
                    <Text style={styles.cartaoNumero}>**** **** **** {card.numero_final}</Text>
                    <Text style={styles.cartaoTitular}>{card.nome_titular}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cartaoExcluir}
                    onPress={() => excluirCartao(card.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
                {idx < cartoes.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          )}

          <TouchableOpacity
            style={styles.btnAdicionarDashed}
            onPress={() => setModalCartao(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color="#6F4E37" />
            <Text style={styles.btnAdicionarDashedTxt}>Adicionar cartão</Text>
          </TouchableOpacity>
        </Accordion>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Helper de campo somente leitura
// ─────────────────────────────────────────────────────────────
function CampoInfo({ icon, label, value }) {
  return (
    <View style={styles.campoInfo}>
      <Ionicons name={icon} size={16} color="#999" style={{ marginTop: 1 }} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.campoLabel}>{label}</Text>
        <Text style={styles.campoValor}>{value}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F8' },

  // ── Header ─────────────────────────────────────────────
  header: {
    backgroundColor: '#6F4E37',
    paddingTop: Platform.OS === 'android' ? 45 : 20,
    paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10, padding: 6,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },

  scroll: { paddingHorizontal: 16, paddingTop: 20 },

  // ── Avatar ─────────────────────────────────────────────
  avatarSection: { alignItems: 'center', marginBottom: 22 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#6F4E37', justifyContent: 'center',
    alignItems: 'center', marginBottom: 12,
    elevation: 4, shadowColor: '#6F4E37',
    shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  avatarNome: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  avatarEmail: { fontSize: 13, color: '#999', marginTop: 3 },

  // ── Accordion ──────────────────────────────────────────
  accordion: {
    backgroundColor: '#FFF', borderRadius: 20,
    marginBottom: 12, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
  },
  accordionIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F5F0EB',
    justifyContent: 'center', alignItems: 'center',
  },
  accordionTitulo: { flex: 1, fontSize: 15, fontWeight: '700', color: '#333' },
  accordionBadge: {
    backgroundColor: '#6F4E37', width: 22, height: 22,
    borderRadius: 11, justifyContent: 'center', alignItems: 'center',
  },
  accordionBadgeTxt: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  accordionBody: { paddingHorizontal: 16, paddingBottom: 16 },

  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 6 },

  // ── Campos ─────────────────────────────────────────────
  campoReadOnly: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 10,
  },
  campoReadOnlyLeft: {},
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  lockTxt: { fontSize: 11, color: '#999' },
  campoInfo: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
  campoLabel: { fontSize: 11, color: '#999', marginBottom: 2 },
  campoValor: { fontSize: 15, color: '#333', fontWeight: '500' },

  btnEditar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 12, padding: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#6F4E37',
  },
  btnEditarTxt: { color: '#6F4E37', fontWeight: '600', fontSize: 14 },

  // ── Formulário inline ──────────────────────────────────
  label: {
    fontSize: 12, fontWeight: '600', color: '#999',
    marginBottom: 5, marginTop: 10,
  },
  input: {
    borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 12,
    padding: 13, marginBottom: 2, backgroundColor: '#FAFAFA', fontSize: 14,
  },
  senhaDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16, marginBottom: 4, paddingVertical: 8,
    borderTopWidth: 1, borderColor: '#F0F0F0',
  },
  senhaDividerTxt: { color: '#AAA', fontSize: 12, fontWeight: '600' },
  rowAcoes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnCancelar: {
    flex: 1, padding: 13, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#F0F0F0',
  },
  btnCancelarTxt: { color: '#666', fontWeight: '600' },
  btnSalvar: {
    flex: 2, flexDirection: 'row', padding: 13, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6F4E37',
  },
  btnSalvarTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

  // ── Endereços ──────────────────────────────────────────
  vazio: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  vazioTxt: { color: '#CCC', fontSize: 14 },
  endCard: {
    backgroundColor: '#F9F9F9', borderRadius: 14,
    padding: 12, borderWidth: 1.5, borderColor: 'transparent',
  },
  endCardPrincipal: { borderColor: '#6F4E37', backgroundColor: '#FDF9F7' },
  endTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  endIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F5F0EB', justifyContent: 'center', alignItems: 'center',
  },
  endTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  endApelido: { fontWeight: 'bold', fontSize: 14, color: '#333' },
  badgePrincipal: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F5F0EB', paddingHorizontal: 7,
    paddingVertical: 2, borderRadius: 8,
  },
  badgePrincipalTxt: { fontSize: 11, color: '#6F4E37', fontWeight: 'bold' },
  endRua: { fontSize: 13, color: '#555', marginBottom: 1 },
  endBairro: { fontSize: 12, color: '#999' },
  endAcoes: {
    flexDirection: 'row', gap: 6, flexWrap: 'wrap',
    borderTopWidth: 1, borderColor: '#EFEFEF', paddingTop: 8,
  },
  acaoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 5, paddingHorizontal: 9,
    backgroundColor: '#FFF', borderRadius: 8,
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  acaoTxt: { fontSize: 12, color: '#6F4E37', fontWeight: '600' },

  // ── Cartões ────────────────────────────────────────────
  cartaoItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingVertical: 10,
  },
  cartaoIconBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#F5F0EB', justifyContent: 'center', alignItems: 'center',
  },
  cartaoTitulo: { fontWeight: '600', color: '#333', fontSize: 14 },
  cartaoNumero: { fontSize: 12, color: '#999', marginTop: 2 },
  cartaoTitular: { fontSize: 11, color: '#BBB', marginTop: 1 },
  cartaoExcluir: {
    padding: 8, backgroundColor: '#FFF5F5',
    borderRadius: 10, borderWidth: 1, borderColor: '#FFD0D0',
  },

  // ── Botão adicionar tracejado ───────────────────────────
  btnAdicionarDashed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 13, borderRadius: 12, marginTop: 10,
    borderWidth: 1.5, borderColor: '#6F4E37', borderStyle: 'dashed',
  },
  btnAdicionarDashedTxt: { color: '#6F4E37', fontWeight: '600', fontSize: 14 },

  // ── Modal ──────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28,
    borderTopRightRadius: 28, padding: 24, maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  btnCancelarModal: {
    flex: 1, padding: 14, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#F0F0F0',
  },
  btnCancelarModalTxt: { color: '#666', fontWeight: '600' },
  btnSalvarModal: {
    flex: 2, flexDirection: 'row', padding: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6F4E37',
  },
  btnSalvarModalTxt: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },

  // ── Opções (tipo/bandeira) ──────────────────────────────
  rowBtns: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  opcao: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, padding: 11, borderRadius: 12,
    backgroundColor: '#F5F0EB', borderWidth: 1, borderColor: '#E8DDD5',
  },
  opcaoAtiva: { backgroundColor: '#6F4E37', borderColor: '#6F4E37' },
  opcaoTxt: { color: '#6F4E37', fontWeight: '600', fontSize: 13 },
  opcaoSmall: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#F5F0EB', borderWidth: 1,
    borderColor: '#E8DDD5', marginBottom: 6,
  },
  opcaoSmallTxt: { color: '#6F4E37', fontWeight: '600', fontSize: 12 },
});