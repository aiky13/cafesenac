import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import db from '../database/DatabaseInit';
import { C, S } from '../theme';

const formatarCPF = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};
const formatarTelefone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
};
const validarNome = (v) => {
  const p = v.trim().split(/\s+/);
  if (p.length < 2) return 'Informe nome e sobrenome.';
  if (p.some(x => x.length < 2)) return 'Cada parte deve ter ao menos 2 letras.';
  if (/[^a-zA-ZÀ-ÿ\s]/.test(v)) return 'O nome não pode ter números ou símbolos.';
  return '';
};
const validarEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'E-mail inválido.';
const validarCPF = (v) => {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11) return 'CPF deve ter 11 dígitos.';
  if (/^(\d)\1{10}$/.test(d)) return 'CPF inválido.';
  let s = 0; for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let r = (s * 10) % 11; if (r >= 10) r = 0;
  if (r !== +d[9]) return 'CPF inválido.';
  s = 0; for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  r = (s * 10) % 11; if (r >= 10) r = 0;
  if (r !== +d[10]) return 'CPF inválido.';
  return '';
};
const validarTelefone = (v) => { const d = v.replace(/\D/g, ''); return d.length < 10 || d.length > 11 ? 'Telefone inválido.' : ''; };
const validarSenha = (v) => {
  if (v.length < 6) return 'Mínimo 6 caracteres.';
  if (!/[A-Za-z]/.test(v)) return 'Inclua ao menos uma letra.';
  if (!/[0-9]/.test(v)) return 'Inclua ao menos um número.';
  return '';
};

function Campo({ label, erro, tocado, children }) {
  const mostrarErro = tocado && !!erro;
  const mostrarOk   = tocado && !erro;
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, mostrarErro && { borderColor: C.vermelho }, mostrarOk && { borderColor: C.verde }]}>
        {children}
        {mostrarErro && <Ionicons name="close-circle" size={18} color={C.vermelho} style={{ marginRight: 12 }} />}
        {mostrarOk   && <Ionicons name="checkmark-circle" size={18} color={C.verde} style={{ marginRight: 12 }} />}
      </View>
      {mostrarErro && (
        <View style={styles.erroRow}>
          <Ionicons name="alert-circle-outline" size={13} color={C.vermelho} />
          <Text style={styles.erroTxt}>{erro}</Text>
        </View>
      )}
    </View>
  );
}

export default function Cadastro({ navigation }) {
  const [form, setForm] = useState({ nome: '', email: '', cpf: '', telefone: '', senha: '', confSenha: '' });
  const [tocado, setTocado] = useState({ nome: false, email: false, cpf: false, telefone: false, senha: false, confSenha: false });
  const [verSenha, setVerSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  const erros = {
    nome:      validarNome(form.nome),
    email:     validarEmail(form.email),
    cpf:       validarCPF(form.cpf),
    telefone:  validarTelefone(form.telefone),
    senha:     validarSenha(form.senha),
    confSenha: form.confSenha !== form.senha ? 'As senhas não coincidem.' : '',
  };
  const ok = Object.values(erros).every(e => e === '');

  const tudo = (c, v) => { setForm(p => ({ ...p, [c]: v })); setTocado(p => ({ ...p, [c]: true })); };
  const tocarTodos = () => setTocado({ nome: true, email: true, cpf: true, telefone: true, senha: true, confSenha: true });

  const forca = () => {
    const s = form.senha; if (!s) return { nivel: 0, label: '', cor: C.foam };
    let pts = 0;
    if (s.length >= 6) pts++; if (s.length >= 10) pts++;
    if (/[A-Z]/.test(s)) pts++; if (/[0-9]/.test(s)) pts++; if (/[^A-Za-z0-9]/.test(s)) pts++;
    if (pts <= 1) return { nivel: 1, label: 'Fraca', cor: C.vermelho };
    if (pts <= 3) return { nivel: 2, label: 'Média', cor: C.amarelo };
    return { nivel: 3, label: 'Forte', cor: C.verde };
  };
  const f = forca();

  const salvar = () => {
    tocarTodos();
    if (!ok) return;
    setLoading(true);
    try {
      db.runSync('INSERT INTO usuarios (nome, email, cpf, telefone, senha) VALUES (?, ?, ?, ?, ?)',
        [form.nome.trim(), form.email.trim().toLowerCase(), form.cpf.replace(/\D/g,''), form.telefone.replace(/\D/g,''), form.senha]);
      const user = db.getFirstSync('SELECT * FROM usuarios WHERE email = ?', [form.email.trim().toLowerCase()]);
      navigation.reset({ index: 0, routes: [{ name: 'Home', params: { user } }] });
    } catch (e) {
      setLoading(false);
      const msg = String(e.message || '');
      if (msg.includes('UNIQUE') || msg.includes('unique')) alert('E-mail ou CPF já cadastrados.');
      else alert('Erro ao criar conta. Tente novamente.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={C.white} />
      </TouchableOpacity>

      <View style={styles.topoBox}>
        <View style={styles.logoCircle}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
        </View>
        <Text style={styles.topoTitulo}>Criar Conta</Text>
        <Text style={styles.topoSub}>CaféSenac — Sabor & Qualidade</Text>
      </View>

      <View style={styles.card}>
        <Campo label="Nome Completo *" erro={erros.nome} tocado={tocado.nome}>
          <TextInput style={styles.input} placeholder="Ex: João Silva" placeholderTextColor={C.textMuted}
            value={form.nome} onChangeText={t => tudo('nome', t)} autoCapitalize="words" />
        </Campo>

        <Campo label="E-mail *" erro={erros.email} tocado={tocado.email}>
          <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor={C.textMuted}
            value={form.email} onChangeText={t => tudo('email', t)} keyboardType="email-address" autoCapitalize="none" />
        </Campo>

        <Campo label="CPF *" erro={erros.cpf} tocado={tocado.cpf}>
          <TextInput style={styles.input} placeholder="000.000.000-00" placeholderTextColor={C.textMuted}
            value={form.cpf} onChangeText={t => tudo('cpf', formatarCPF(t))} keyboardType="numeric" maxLength={14} />
        </Campo>

        <Campo label="Telefone *" erro={erros.telefone} tocado={tocado.telefone}>
          <TextInput style={styles.input} placeholder="(27) 99999-9999" placeholderTextColor={C.textMuted}
            value={form.telefone} onChangeText={t => tudo('telefone', formatarTelefone(t))} keyboardType="phone-pad" maxLength={15} />
        </Campo>

        <Campo label="Senha *" erro={erros.senha} tocado={tocado.senha}>
          <TextInput style={[styles.input, { paddingRight: 44 }]} placeholder="Mín. 6 chars, letra e número" placeholderTextColor={C.textMuted}
            value={form.senha} onChangeText={t => tudo('senha', t)} secureTextEntry={!verSenha} autoCapitalize="none" />
          <TouchableOpacity style={{ position: 'absolute', right: 14 }} onPress={() => setVerSenha(v => !v)}>
            <Ionicons name={verSenha ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMuted} />
          </TouchableOpacity>
        </Campo>

        {form.senha.length > 0 && (
          <View style={{ marginTop: -10, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {[1,2,3].map(n => <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: f.nivel >= n ? f.cor : C.foam }} />)}
            </View>
            <Text style={{ color: f.cor, fontSize: 11, marginTop: 4, fontWeight: '700' }}>Senha {f.label}</Text>
          </View>
        )}

        <Campo label="Confirmar Senha *" erro={erros.confSenha} tocado={tocado.confSenha}>
          <TextInput style={styles.input} placeholder="Repita a senha" placeholderTextColor={C.textMuted}
            value={form.confSenha} onChangeText={t => tudo('confSenha', t)} secureTextEntry autoCapitalize="none" />
        </Campo>

        <TouchableOpacity style={[styles.btn, !ok && { opacity: 0.7 }]} onPress={salvar} disabled={loading}>
          <Ionicons name="person-add-outline" size={18} color={C.white} />
          <Text style={styles.btnTxt}>{loading ? 'Criando conta...' : 'CRIAR MINHA CONTA'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()}>
          <Text style={styles.linkTxt}>Já tem conta? <Text style={{ color: C.cafe, fontWeight: '800' }}>Faça login</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: C.espresso, paddingBottom: 40 },
  back: { position: 'absolute', top: Platform.OS === 'android' ? 46 : 56, left: 18, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 8 },
  topoBox: { alignItems: 'center', paddingTop: Platform.OS === 'android' ? 80 : 90, paddingBottom: 28 },
  logoCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.milk, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: C.latte, ...S.strongShadow, marginBottom: 2 },
  logoImg: { width: 105, height: 105 },
  topoTitulo: { color: C.white, fontSize: 24, fontWeight: '800', marginTop: 10 },
  topoSub: { color: C.latte, fontSize: 12, letterSpacing: 1.5, marginTop: 4, fontStyle: 'italic' },
  card: { backgroundColor: C.milk, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, flexGrow: 1 },
  label: { fontSize: 10, fontWeight: '800', color: C.textMid, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.cream, borderRadius: 14, borderWidth: 1.5, borderColor: C.foam, height: 50, paddingHorizontal: 14, marginBottom: 2 },
  input: { flex: 1, fontSize: 14, color: C.textDark },
  erroRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  erroTxt: { color: C.vermelho, fontSize: 12 },
  btn: { backgroundColor: C.cafe, borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8, ...S.cardShadow },
  btnTxt: { color: C.white, fontWeight: '800', fontSize: 15 },
  linkRow: { alignItems: 'center', marginTop: 18 },
  linkTxt: { color: C.textLight, fontSize: 14 },
});