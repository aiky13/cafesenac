import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, SafeAreaView, Platform, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import db from '../database/DatabaseInit';
import { C, S } from '../theme';

const APELIDOSOPTIONS = ['Casa', 'Trabalho', 'Outro'];

const enderecoVazio = { apelido: 'Casa', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' };

export default function GerenciarEnderecos({ navigation, route }) {
  const { user, onSelecionar } = route.params || {};
  const [enderecos, setEnderecos] = useState([]);
  const [modalForm, setModalForm] = useState(false);
  const [editando, setEditando] = useState(null); // id do endereço sendo editado, null = novo
  const [form, setForm] = useState(enderecoVazio);

  // Corrige banco legado que pode ter UNIQUE(usuario_id) errado na tabela enderecos
  const corrigirTabelaEnderecos = () => {
    try {
      // Verifica se a tabela tem a constraint errada tentando inserir dois registros do mesmo usuário
      // A forma mais segura é recriar a tabela sem a constraint
      db.execSync(`
        CREATE TABLE IF NOT EXISTS enderecos_novo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER NOT NULL,
          apelido TEXT DEFAULT 'Casa',
          cep TEXT,
          rua TEXT,
          numero TEXT,
          complemento TEXT,
          bairro TEXT,
          cidade TEXT,
          estado TEXT,
          principal INTEGER DEFAULT 0
        );
      `);
      // Copia dados da tabela antiga para a nova (se a nova ainda não tiver dados)
      const temDados = db.getFirstSync('SELECT COUNT(*) as c FROM enderecos_novo');
      const dadosOriginais = db.getAllSync('SELECT * FROM enderecos');
      if (temDados.c === 0 && dadosOriginais.length > 0) {
        for (const e of dadosOriginais) {
          try {
            db.runSync(
              `INSERT INTO enderecos_novo (id, usuario_id, apelido, cep, rua, numero, complemento, bairro, cidade, estado, principal)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
              [e.id, e.usuario_id, e.apelido || 'Casa', e.cep, e.rua, e.numero, e.complemento, e.bairro, e.cidade, e.estado, e.principal || 0]
            );
          } catch (_) {}
        }
      }
      // Substitui a tabela antiga pela nova
      db.execSync(`DROP TABLE IF EXISTS enderecos`);
      db.execSync(`ALTER TABLE enderecos_novo RENAME TO enderecos`);
    } catch (_) {}
  };

  const carregar = () => {
    try {
      const data = db.getAllSync(
        'SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY principal DESC, id ASC',
        [user.id]
      );
      setEnderecos(data || []);
    } catch (e) { console.error('Erro endereços:', e); }
  };

  useEffect(() => { corrigirTabelaEnderecos(); carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm(enderecoVazio);
    setModalForm(true);
  };

  const abrirEditar = (end) => {
    setEditando(end.id);
    setForm({
      apelido: end.apelido || 'Casa',
      cep: end.cep || '',
      rua: end.rua || '',
      numero: end.numero || '',
      complemento: end.complemento || '',
      bairro: end.bairro || '',
      cidade: end.cidade || '',
      estado: end.estado || '',
    });
    setModalForm(true);
  };

  const salvar = () => {
    const obrigatorios = ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'];
    if (obrigatorios.some(c => !form[c]?.trim()))
      return Alert.alert('Atenção', 'Preencha todos os campos obrigatórios (*).');
    try {
      if (editando) {
        db.runSync(
          `UPDATE enderecos SET apelido=?, cep=?, rua=?, numero=?, complemento=?, bairro=?, cidade=?, estado=? WHERE id=? AND usuario_id=?`,
          [form.apelido, form.cep, form.rua, form.numero, form.complemento, form.bairro, form.cidade, form.estado, editando, user.id]
        );
      } else {
        // Primeiro endereço vira principal automaticamente
        const isPrincipal = enderecos.length === 0 ? 1 : 0;
        db.runSync(
          `INSERT INTO enderecos (usuario_id, apelido, cep, rua, numero, complemento, bairro, cidade, estado, principal) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [user.id, form.apelido, form.cep, form.rua, form.numero, form.complemento, form.bairro, form.cidade, form.estado, isPrincipal]
        );
      }
      setModalForm(false);
      carregar();
    } catch (e) {
      console.error('Erro salvar endereço:', e);
      Alert.alert('Erro', 'Não foi possível salvar o endereço.');
    }
  };

  const excluir = (id) => {
    Alert.alert('Excluir endereço', 'Tem certeza que deseja excluir este endereço?', [
      { text: 'Cancelar' },
      {
        text: 'Excluir', style: 'destructive', onPress: () => {
          try {
            db.runSync('DELETE FROM enderecos WHERE id = ? AND usuario_id = ?', [id, user.id]);
            // Se era o principal, promove o próximo
            const resto = db.getAllSync('SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY id ASC', [user.id]);
            if (resto.length > 0 && !resto.some(e => e.principal === 1)) {
              db.runSync('UPDATE enderecos SET principal = 1 WHERE id = ?', [resto[0].id]);
            }
            carregar();
          } catch (e) { Alert.alert('Erro', 'Não foi possível excluir.'); }
        }
      }
    ]);
  };

  const definirPrincipal = (id) => {
    try {
      db.runSync('UPDATE enderecos SET principal = 0 WHERE usuario_id = ?', [user.id]);
      db.runSync('UPDATE enderecos SET principal = 1 WHERE id = ?', [id]);
      carregar();
    } catch (e) { console.error(e); }
  };

  const selecionar = (end) => {
    // Salva como principal no banco
    try {
      db.runSync('UPDATE enderecos SET principal = 0 WHERE usuario_id = ?', [user.id]);
      db.runSync('UPDATE enderecos SET principal = 1 WHERE id = ?', [end.id]);
    } catch (e) { console.error(e); }

    // Simplesmente volta — o useFocusEffect do Checkout relê o principal do banco
    navigation.goBack();
  };

  const ICONE_APELIDO = { Casa: 'home-outline', Trabalho: 'briefcase-outline', Outro: 'location-outline' };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Meus Endereços</Text>
        <TouchableOpacity style={styles.addBtn} onPress={abrirNovo}>
          <Ionicons name="add" size={26} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {enderecos.length === 0 ? (
          <View style={styles.vazio}>
            <Ionicons name="location-outline" size={80} color="#E8E8E8" />
            <Text style={styles.vazioTxt}>Nenhum endereço cadastrado</Text>
            <TouchableOpacity style={styles.btnAdicionar} onPress={abrirNovo}>
              <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={styles.btnAdicionarTxt}>Adicionar endereço</Text>
            </TouchableOpacity>
          </View>
        ) : (
          enderecos.map(end => (
            <TouchableOpacity
              key={end.id}
              style={[styles.card, end.principal === 1 && styles.cardPrincipal]}
              onPress={() => selecionar(end)}
              activeOpacity={0.88}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIconBox}>
                  <Ionicons name={ICONE_APELIDO[end.apelido] || 'location-outline'} size={20} color="#6F4E37" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardApelido}>{end.apelido}</Text>
                    {end.principal === 1 && (
                      <View style={styles.badgePrincipal}>
                        <Text style={styles.badgePrincipalTxt}>Principal</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={(e) => { e.stopPropagation?.(); abrirEditar(end); }}
                      style={styles.editIconBtn}
                    >
                      <Ionicons name="pencil-outline" size={16} color="#6F4E37" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardRua} numberOfLines={1}>
                    {end.rua}, {end.numero}{end.complemento ? ` - ${end.complemento}` : ''}
                  </Text>
                  <Text style={styles.cardBairro} numberOfLines={1}>
                    {end.bairro} • {end.cidade}/{end.estado} • CEP {end.cep}
                  </Text>
                </View>
              </View>

              <View style={styles.cardAcoes}>
                {end.principal !== 1 && (
                  <TouchableOpacity
                    style={styles.acaoBtn}
                    onPress={(e) => { e.stopPropagation?.(); definirPrincipal(end.id); }}
                  >
                    <Ionicons name="star-outline" size={16} color="#F39C12" />
                    <Text style={[styles.acaoTxt, { color: '#F39C12' }]}>Principal</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.acaoBtn, styles.acaoBtnExcluir]}
                  onPress={(e) => { e.stopPropagation?.(); excluir(end.id); }}
                >
                  <Ionicons name="trash-outline" size={16} color="#E74C3C" />
                  <Text style={[styles.acaoTxt, { color: '#E74C3C' }]}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.btnAdicionarFlutuante} onPress={abrirNovo}>
          <Ionicons name="add-circle-outline" size={20} color="#6F4E37" />
          <Text style={styles.btnAdicionarFlutuanteTxt}>Adicionar novo endereço</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL FORM */}
      <Modal visible={modalForm} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>{editando ? 'Editar Endereço' : 'Novo Endereço'}</Text>
              <TouchableOpacity onPress={() => setModalForm(false)}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Apelido */}
              <Text style={styles.label}>Apelido *</Text>
              <View style={styles.rowBtns}>
                {APELIDOSOPTIONS.map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.opcao, form.apelido === a && styles.opcaoAtiva]}
                    onPress={() => setForm({ ...form, apelido: a })}
                  >
                    <Ionicons name={ICONE_APELIDO[a]} size={16} color={form.apelido === a ? '#FFF' : '#6F4E37'} />
                    <Text style={[styles.opcaoTxt, form.apelido === a && { color: '#FFF' }]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>CEP *</Text>
              <TextInput style={styles.input} placeholder="00000-000" value={form.cep}
                onChangeText={t => setForm({ ...form, cep: t })} keyboardType="numeric" maxLength={9} />

              <Text style={styles.label}>Rua / Avenida *</Text>
              <TextInput style={styles.input} placeholder="Ex: Av. das Palmeiras" value={form.rua}
                onChangeText={t => setForm({ ...form, rua: t })} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 0.35 }}>
                  <Text style={styles.label}>Número *</Text>
                  <TextInput style={styles.input} placeholder="123" value={form.numero}
                    onChangeText={t => setForm({ ...form, numero: t })} keyboardType="numeric" />
                </View>
                <View style={{ flex: 0.6 }}>
                  <Text style={styles.label}>Complemento</Text>
                  <TextInput style={styles.input} placeholder="Apto, bloco..." value={form.complemento}
                    onChangeText={t => setForm({ ...form, complemento: t })} />
                </View>
              </View>

              <Text style={styles.label}>Bairro *</Text>
              <TextInput style={styles.input} placeholder="Ex: Centro" value={form.bairro}
                onChangeText={t => setForm({ ...form, bairro: t })} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 0.65 }}>
                  <Text style={styles.label}>Cidade *</Text>
                  <TextInput style={styles.input} placeholder="Ex: Serra" value={form.cidade}
                    onChangeText={t => setForm({ ...form, cidade: t })} />
                </View>
                <View style={{ flex: 0.3 }}>
                  <Text style={styles.label}>UF *</Text>
                  <TextInput style={styles.input} placeholder="ES" value={form.estado}
                    onChangeText={t => setForm({ ...form, estado: t.toUpperCase() })} maxLength={2} />
                </View>
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalForm(false)}>
                  <Text style={styles.btnCancelarTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSalvar} onPress={salvar}>
                  <Ionicons name="save-outline" size={18} color="#FFF" />
                  <Text style={styles.btnSalvarTxt}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  header: { backgroundColor: C.espresso, paddingTop: Platform.OS === 'android' ? 46 : 20, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 6, marginRight: 12 },
  headerTitulo: { flex: 1, color: C.white, fontSize: 20, fontWeight: 'bold' },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 6 },

  scroll: { padding: 18, paddingBottom: 40 },

  vazio: { alignItems: 'center', paddingTop: 60, gap: 12 },
  vazioTxt: { color: C.textMuted, fontSize: 16 },
  btnAdicionar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.cafe, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, marginTop: 10 },
  btnAdicionarTxt: { color: C.white, fontWeight: 'bold' },

  card: { backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 14, ...S.cardShadow, borderWidth: 1.5, borderColor: 'transparent' },
  cardPrincipal: { borderColor: C.cafe },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  cardIconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.milk, justifyContent: 'center', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' },
  cardApelido: { fontWeight: 'bold', fontSize: 15, color: C.espresso },
  badgePrincipal: { backgroundColor: C.milk, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: C.foam },
  badgePrincipalTxt: { fontSize: 11, color: C.cafe, fontWeight: 'bold' },
  cardRua: { fontSize: 13, color: C.textMid },
  cardBairro: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  editIconBtn: { marginLeft: 'auto', padding: 4, backgroundColor: C.milk, borderRadius: 8 },

  cardAcoes: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderColor: C.foam, paddingTop: 10 },
  acaoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: C.milk, borderRadius: 8 },
  acaoBtnExcluir: { backgroundColor: C.vermelhoClaro },
  acaoTxt: { fontSize: 12, color: C.cafe, fontWeight: '600' },

  btnAdicionarFlutuante: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: C.cafe, borderStyle: 'dashed', marginTop: 6 },
  btnAdicionarFlutuanteTxt: { color: C.cafe, fontWeight: '600', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,10,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: C.espresso },

  label: { fontSize: 11, fontWeight: '700', color: C.textMid, marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { borderWidth: 1.5, borderColor: C.foam, borderRadius: 13, padding: 13, marginBottom: 4, backgroundColor: C.milk, fontSize: 14, color: C.textDark },
  rowBtns: { flexDirection: 'row', gap: 8 },
  opcao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 11, borderRadius: 12, backgroundColor: C.milk, borderWidth: 1.5, borderColor: C.foam },
  opcaoAtiva: { backgroundColor: C.cafe, borderColor: C.cafe },
  opcaoTxt: { color: C.cafe, fontWeight: '600', fontSize: 13 },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 8 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 13, alignItems: 'center', backgroundColor: C.milk },
  btnCancelarTxt: { color: C.textMid, fontWeight: '600' },
  btnSalvar: { flex: 2, flexDirection: 'row', padding: 14, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.cafe },
  btnSalvarTxt: { color: C.white, fontWeight: 'bold', fontSize: 15 },
});