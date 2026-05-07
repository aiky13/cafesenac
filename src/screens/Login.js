import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import db from '../database/DatabaseInit';
import { C, S } from '../theme';

const ADMIN_EMAIL = 'admin@cafesenac.com';
const ADMIN_SENHA = 'admin123';

const formatarCPF = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};
const validarSenha = (v) => {
  if (v.length < 6)        return 'Mínimo 6 caracteres.';
  if (!/[A-Za-z]/.test(v)) return 'Inclua ao menos uma letra.';
  if (!/[0-9]/.test(v))    return 'Inclua ao menos um número.';
  return '';
};

function Campo({ label, children, erro }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrap, !!erro && { borderColor: C.vermelho }]}>
        {children}
      </View>
      {!!erro && (
        <View style={styles.erroRow}>
          <Ionicons name="alert-circle-outline" size={12} color={C.vermelho} />
          <Text style={styles.erroTxt}>{erro}</Text>
        </View>
      )}
    </View>
  );
}

function ForcaSenha({ senha }) {
  if (!senha) return null;
  let pts = 0;
  if (senha.length >= 6) pts++; if (senha.length >= 10) pts++;
  if (/[A-Z]/.test(senha)) pts++; if (/[0-9]/.test(senha)) pts++;
  if (/[^A-Za-z0-9]/.test(senha)) pts++;
  const nivel = pts <= 1 ? 1 : pts <= 3 ? 2 : 3;
  const cor   = [C.vermelho, C.amarelo, C.verde][nivel - 1];
  const label = ['Fraca', 'Média', 'Forte'][nivel - 1];
  return (
    <View style={{ marginTop: -8, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', gap: 5, marginBottom: 3 }}>
        {[1,2,3].map(n => <View key={n} style={[styles.forcaBarra, { backgroundColor: nivel >= n ? cor : C.foam }]} />)}
      </View>
      <Text style={{ fontSize: 11, color: cor, fontWeight: '700' }}>Força: {label}</Text>
    </View>
  );
}

export default function Login({ navigation }) {
  const [modo, setModo]   = useState('login'); // 'login' | 'recuperar'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erroLogin, setErroLogin] = useState('');

  // Recuperação
  const [etapa, setEtapa]           = useState(1);
  const [recEmail, setRecEmail]     = useState('');
  const [recCpf, setRecCpf]         = useState('');
  const [novaSenha, setNovaSenha]   = useState('');
  const [confSenha, setConfSenha]   = useState('');
  const [verNova, setVerNova]       = useState(false);
  const [verConf, setVerConf]       = useState(false);
  const [erroRec, setErroRec]       = useState('');
  const [usuarioRec, setUsuarioRec] = useState(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const fade = (cb) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  // ── Login ─────────────────────────────────────────────────────
  const realizarLogin = () => {
    setErroLogin('');
    if (!email.trim() || !senha) return setErroLogin('Preencha e-mail e senha.');
    if (email.trim().toLowerCase() === ADMIN_EMAIL) {
      if (senha !== ADMIN_SENHA) return setErroLogin('Senha de administrador incorreta.');
      navigation.navigate('Admin', { autenticado: true });
      return;
    }
    const user = db.getFirstSync(
      'SELECT * FROM usuarios WHERE email = ? AND senha = ?',
      [email.trim().toLowerCase(), senha]
    );
    if (user) {
      navigation.reset({ index: 0, routes: [{ name: 'Home', params: { user } }] });
    } else {
      setErroLogin('E-mail ou senha incorretos.');
    }
  };

  // ── Recuperação etapa 1 ───────────────────────────────────────
  const verificarIdentidade = () => {
    setErroRec('');
    if (!recEmail.trim()) return setErroRec('Informe seu e-mail.');
    if (recCpf.replace(/\D/g, '').length !== 11) return setErroRec('Informe um CPF válido.');
    const user = db.getFirstSync(
      'SELECT * FROM usuarios WHERE email = ? AND cpf = ?',
      [recEmail.trim().toLowerCase(), recCpf.replace(/\D/g, '')]
    );
    if (!user) return setErroRec('Nenhuma conta encontrada com esse e-mail e CPF.');
    setUsuarioRec(user);
    fade(() => setEtapa(2));
  };

  // ── Recuperação etapa 2 ───────────────────────────────────────
  const salvarNovaSenha = () => {
    setErroRec('');
    const err = validarSenha(novaSenha);
    if (err) return setErroRec(err);
    if (novaSenha !== confSenha) return setErroRec('As senhas não coincidem.');
    if (novaSenha === usuarioRec.senha) return setErroRec('A nova senha não pode ser igual à atual.');
    try {
      db.runSync('UPDATE usuarios SET senha = ? WHERE id = ?', [novaSenha, usuarioRec.id]);
      fade(() => setEtapa(3));
    } catch (e) { setErroRec('Erro ao atualizar. Tente novamente.'); }
  };

  const voltarLogin = () => fade(() => {
    setModo('login'); setEtapa(1);
    setRecEmail(''); setRecCpf('');
    setNovaSenha(''); setConfSenha('');
    setErroRec(''); setUsuarioRec(null);
  });

  // ── Steps indicator ───────────────────────────────────────────
  const Steps = ({ atual }) => (
    <View>
      <View style={styles.stepsRow}>
        {[1,2,3].map(n => (
          <View key={n} style={styles.stepItemRow}>
            <View style={[styles.stepCircle, atual >= n && styles.stepCircleAtivo]}>
              {atual > n
                ? <Ionicons name="checkmark" size={13} color={C.white} />
                : <Text style={[styles.stepNum, atual >= n && { color: C.white }]}>{n}</Text>}
            </View>
            {n < 3 && <View style={[styles.stepLinha, atual > n && styles.stepLinhaAtiva]} />}
          </View>
        ))}
      </View>
      <View style={styles.stepsLabels}>
        {['Verificar','Nova senha','Concluído'].map(l => (
          <Text key={l} style={styles.stepLabel}>{l}</Text>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* LOGO */}
        <View style={styles.topoBox}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImg} resizeMode="contain" />
          </View>
          <Text style={styles.slogan}>Sabor & Qualidade</Text>
        </View>

        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>

          {/* ══════════ LOGIN ══════════ */}
          {modo === 'login' && (<>
            <Text style={styles.cardTitulo}>Bem-vindo de volta</Text>
            <Text style={styles.cardSub}>Faça login para continuar</Text>

            <Campo label="E-mail">
              <Ionicons name="mail-outline" size={17} color={C.caramel} style={{ marginRight: 8 }} />
              <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor={C.textMuted}
                value={email} onChangeText={t => { setEmail(t); setErroLogin(''); }}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </Campo>

            <Campo label="Senha">
              <Ionicons name="lock-closed-outline" size={17} color={C.caramel} style={{ marginRight: 8 }} />
              <TextInput style={[styles.input, { paddingRight: 36 }]} placeholder="••••••••" placeholderTextColor={C.textMuted}
                value={senha} onChangeText={t => { setSenha(t); setErroLogin(''); }}
                secureTextEntry={!verSenha} autoCapitalize="none" />
              <TouchableOpacity onPress={() => setVerSenha(v => !v)} style={{ position: 'absolute', right: 14 }}>
                <Ionicons name={verSenha ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMuted} />
              </TouchableOpacity>
            </Campo>

            {!!erroLogin && (
              <View style={styles.alertaBox}>
                <Ionicons name="warning-outline" size={15} color={C.vermelho} />
                <Text style={styles.alertaTxt}>{erroLogin}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.esqueciBtn} onPress={() => fade(() => setModo('recuperar'))}>
              <Text style={styles.esqueciTxt}>Esqueci minha senha</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnPrimario} onPress={realizarLogin}>
              <Ionicons name="log-in-outline" size={20} color={C.white} />
              <Text style={styles.btnPrimarioTxt}>ENTRAR</Text>
            </TouchableOpacity>

            <View style={styles.divRow}>
              <View style={styles.divLine} /><Text style={styles.divTxt}>ou</Text><View style={styles.divLine} />
            </View>

            <TouchableOpacity style={styles.btnSecundario} onPress={() => navigation.navigate('Cadastro')}>
              <Ionicons name="person-add-outline" size={18} color={C.cafe} />
              <Text style={styles.btnSecundarioTxt}>CRIAR NOVA CONTA</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Admin')} style={{ alignItems: 'center', marginTop: 22 }}>
              <Text style={styles.adminLink}>☕ CaféSenac — Sabor & Qualidade</Text>
            </TouchableOpacity>
          </>)}

          {/* ══════════ RECUPERAÇÃO ══════════ */}
          {modo === 'recuperar' && (<>
            <TouchableOpacity style={styles.recVoltar} onPress={voltarLogin}>
              <Ionicons name="arrow-back" size={19} color={C.cafe} />
              <Text style={styles.recVoltarTxt}>Voltar ao login</Text>
            </TouchableOpacity>

            {/* ETAPA 1 */}
            {etapa === 1 && (<>
              <View style={styles.etapaIconBox}>
                <Ionicons name="shield-checkmark-outline" size={34} color={C.cafe} />
              </View>
              <Text style={styles.cardTitulo}>Recuperar Senha</Text>
              <Text style={styles.cardSub}>Informe seu e-mail e CPF para verificarmos sua identidade.</Text>
              <Steps atual={1} />

              <Campo label="E-mail cadastrado">
                <Ionicons name="mail-outline" size={17} color={C.caramel} style={{ marginRight: 8 }} />
                <TextInput style={styles.input} placeholder="seu@email.com" placeholderTextColor={C.textMuted}
                  value={recEmail} onChangeText={t => { setRecEmail(t); setErroRec(''); }}
                  keyboardType="email-address" autoCapitalize="none" />
              </Campo>

              <Campo label="CPF cadastrado">
                <Ionicons name="id-card-outline" size={17} color={C.caramel} style={{ marginRight: 8 }} />
                <TextInput style={styles.input} placeholder="000.000.000-00" placeholderTextColor={C.textMuted}
                  value={recCpf} onChangeText={t => { setRecCpf(formatarCPF(t)); setErroRec(''); }}
                  keyboardType="numeric" maxLength={14} />
              </Campo>

              {!!erroRec && <View style={styles.alertaBox}><Ionicons name="warning-outline" size={15} color={C.vermelho} /><Text style={styles.alertaTxt}>{erroRec}</Text></View>}

              <TouchableOpacity style={styles.btnPrimario} onPress={verificarIdentidade}>
                <Ionicons name="search-outline" size={19} color={C.white} />
                <Text style={styles.btnPrimarioTxt}>VERIFICAR IDENTIDADE</Text>
              </TouchableOpacity>
            </>)}

            {/* ETAPA 2 */}
            {etapa === 2 && (<>
              <View style={styles.etapaIconBox}>
                <Ionicons name="lock-open-outline" size={34} color={C.cafe} />
              </View>
              <Text style={styles.cardTitulo}>Nova Senha</Text>
              <Text style={styles.cardSub}>Olá, <Text style={{ color: C.cafe, fontWeight: '800' }}>{usuarioRec?.nome?.split(' ')[0]}</Text>! Defina sua nova senha.</Text>
              <Steps atual={2} />

              <Campo label="Nova senha">
                <Ionicons name="lock-closed-outline" size={17} color={C.caramel} style={{ marginRight: 8 }} />
                <TextInput style={[styles.input, { paddingRight: 36 }]} placeholder="Mín. 6 caracteres" placeholderTextColor={C.textMuted}
                  value={novaSenha} onChangeText={t => { setNovaSenha(t); setErroRec(''); }}
                  secureTextEntry={!verNova} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setVerNova(v => !v)} style={{ position: 'absolute', right: 14 }}>
                  <Ionicons name={verNova ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMuted} />
                </TouchableOpacity>
              </Campo>
              <ForcaSenha senha={novaSenha} />

              <Campo label="Confirmar nova senha">
                <Ionicons name="lock-closed-outline" size={17} color={C.caramel} style={{ marginRight: 8 }} />
                <TextInput style={[styles.input, { paddingRight: 36 }]} placeholder="Repita a senha" placeholderTextColor={C.textMuted}
                  value={confSenha} onChangeText={t => { setConfSenha(t); setErroRec(''); }}
                  secureTextEntry={!verConf} autoCapitalize="none" />
                <TouchableOpacity onPress={() => setVerConf(v => !v)} style={{ position: 'absolute', right: 14 }}>
                  <Ionicons name={verConf ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMuted} />
                </TouchableOpacity>
              </Campo>

              {confSenha.length > 0 && (
                <View style={[styles.coincideBox, novaSenha === confSenha ? { backgroundColor: C.verdeClaro } : { backgroundColor: C.vermelhoClaro }]}>
                  <Ionicons name={novaSenha === confSenha ? 'checkmark-circle-outline' : 'close-circle-outline'} size={14} color={novaSenha === confSenha ? C.verde : C.vermelho} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: novaSenha === confSenha ? C.verde : C.vermelho }}>
                    {novaSenha === confSenha ? 'As senhas coincidem' : 'As senhas não coincidem'}
                  </Text>
                </View>
              )}

              {!!erroRec && <View style={styles.alertaBox}><Ionicons name="warning-outline" size={15} color={C.vermelho} /><Text style={styles.alertaTxt}>{erroRec}</Text></View>}

              <TouchableOpacity style={styles.btnPrimario} onPress={salvarNovaSenha}>
                <Ionicons name="save-outline" size={19} color={C.white} />
                <Text style={styles.btnPrimarioTxt}>SALVAR NOVA SENHA</Text>
              </TouchableOpacity>
            </>)}

            {/* ETAPA 3 */}
            {etapa === 3 && (
              <View style={{ alignItems: 'center' }}>
                <Steps atual={3} />
                <Ionicons name="checkmark-circle" size={80} color={C.verde} style={{ marginTop: 10, marginBottom: 12 }} />
                <Text style={[styles.cardTitulo, { color: C.verde }]}>Senha alterada!</Text>
                <Text style={[styles.cardSub, { marginTop: 6 }]}>Sua senha foi atualizada com sucesso.{'\n'}Faça login com a nova senha.</Text>
                <TouchableOpacity style={[styles.btnPrimario, { marginTop: 28, width: '100%' }]} onPress={voltarLogin}>
                  <Ionicons name="log-in-outline" size={19} color={C.white} />
                  <Text style={styles.btnPrimarioTxt}>IR PARA O LOGIN</Text>
                </TouchableOpacity>
              </View>
            )}
          </>)}

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: C.espresso, alignItems: 'center', paddingVertical: 40 },
  topoBox: { alignItems: 'center', marginBottom: 28, marginTop: 20 },
  logoCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: C.milk, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: C.latte, ...S.strongShadow },
  logoImg: { width: 130, height: 130 },
  slogan: { color: C.latte, fontSize: 13, letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 14, fontStyle: 'italic' },

  card: { width: '90%', backgroundColor: C.milk, borderRadius: 28, padding: 26, ...S.strongShadow },
  cardTitulo: { fontSize: 21, fontWeight: '800', color: C.espresso, textAlign: 'center', marginBottom: 4 },
  cardSub: { fontSize: 13, color: C.textLight, textAlign: 'center', marginBottom: 22, lineHeight: 19 },

  label: { fontSize: 10, fontWeight: '800', color: C.textMid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.cream, borderRadius: 14, borderWidth: 1.5, borderColor: C.foam, height: 52, paddingHorizontal: 14, marginBottom: 2 },
  input: { flex: 1, fontSize: 15, color: C.textDark },
  erroRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  erroTxt: { color: C.vermelho, fontSize: 12 },

  alertaBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.vermelhoClaro, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FFCDD2', marginBottom: 14 },
  alertaTxt: { fontSize: 13, color: C.vermelho, flex: 1, lineHeight: 18 },

  esqueciBtn: { alignSelf: 'flex-end', marginBottom: 18, marginTop: -4 },
  esqueciTxt: { fontSize: 13, color: C.cafe, fontWeight: '700' },

  btnPrimario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.cafe, paddingVertical: 16, borderRadius: 16, ...S.cardShadow },
  btnPrimarioTxt: { color: C.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  divRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18, gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: C.foam },
  divTxt: { color: C.textMuted, fontSize: 12 },

  btnSecundario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.cafe, paddingVertical: 14, borderRadius: 16, backgroundColor: C.cream },
  btnSecundarioTxt: { color: C.cafe, fontWeight: '800', fontSize: 14 },

  adminLink: { color: C.latte, fontSize: 12, letterSpacing: 0.5, opacity: 0.7, fontStyle: 'italic' },

  forcaBarra: { flex: 1, height: 4, borderRadius: 2 },

  recVoltar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  recVoltarTxt: { color: C.cafe, fontWeight: '700', fontSize: 14 },
  etapaIconBox: { width: 66, height: 66, borderRadius: 20, backgroundColor: C.cream, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },

  stepsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepItemRow: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: C.foam, backgroundColor: C.cream, justifyContent: 'center', alignItems: 'center' },
  stepCircleAtivo: { borderColor: C.cafe, backgroundColor: C.cafe },
  stepNum: { fontSize: 12, fontWeight: '800', color: C.latte },
  stepLinha: { width: 36, height: 2, backgroundColor: C.foam },
  stepLinhaAtiva: { backgroundColor: C.cafe },
  stepsLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 20 },
  stepLabel: { fontSize: 9, color: C.textMuted, textAlign: 'center', flex: 1, textTransform: 'uppercase', letterSpacing: 0.3 },

  coincideBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, marginBottom: 10, marginTop: -4 },
});