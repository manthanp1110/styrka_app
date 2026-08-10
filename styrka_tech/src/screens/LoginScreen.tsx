import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, StyleSheet } from 'react-native';
import { useAppState } from '../store/useAppState';
import { supabase } from '../config/supabase';
import { TrackingDataService } from '../services/TrackingDataService';

const LoginScreen = () => {
  const { setSession } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const signInWithSupabase = async (loginEmail: string, loginPassword: string) => {
    const cleanEmail = loginEmail.trim().toLowerCase();
    
    // 1. Try signing in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: loginPassword,
    });

    if (!error && data.user) {
      // Fetch profile from users table
      const { data: profile } = await supabase
        .from('users')
        .select('id, name, role, email')
        .eq('id', data.user.id)
        .single();
      const name = profile?.name || data.user.email?.split('@')[0] || 'User';
      const role: 'admin' | 'employee' = (profile?.role === 'admin') ? 'admin' : 'employee';
      await setSession(data.user.id, role, name, profile?.email || data.user.email || '');
      return;
    }

    // 2. Fallback: check configured local/admin users
    const matchedUser = await TrackingDataService.getUser(cleanEmail);
    if (matchedUser) {
      // Try background signup so account gets created in Supabase Auth automatically
      try {
        await supabase.auth.signUp({
          email: cleanEmail,
          password: loginPassword,
          options: {
            data: {
              name: matchedUser.name,
              role: matchedUser.role,
            },
          },
        });
      } catch {}

      await setSession(matchedUser.id, matchedUser.role, matchedUser.name, matchedUser.email);
      return;
    }

    throw new Error(error?.message || 'Invalid login credentials. Please create this user in Supabase Auth.');
  };

  const handleLogin = async () => {
    if (!email) {
      setErrorMsg('Please enter an email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      await signInWithSupabase(email, password);
    } catch (e: any) {
      setErrorMsg(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsRole = async (role: 'admin' | 'employee') => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // Fetch all profiles and pick first one matching the role
      const { data: profiles, error } = await supabase
        .from('users')
        .select('id, name, role, email')
        .eq('role', role)
        .limit(1);
      if (error || !profiles || profiles.length === 0) {
        throw new Error(`No ${role} account found in Supabase. Check your profiles table.`);
      }
      const profile = profiles[0];
      await setSession(profile.id, role, profile.name || profile.email || role, profile.email || '');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>S</Text>
          </View>
          
          <Text style={styles.title}>STYRKA Live Tracker</Text>
          <Text style={styles.subtitle}>Dispatch & Real-time Location Tracking</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email or Username</Text>
            <TextInput 
              style={styles.input}
              placeholder="manthanpandhare1110@gmail.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput 
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={[styles.loginBtn, isLoading && { backgroundColor: '#34D399' }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading && <ActivityIndicator color="white" style={{ marginRight: 8 }} />}
            <Text style={styles.loginBtnText}>{isLoading ? 'Signing In...' : 'Log In'}</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>QUICK DEMO ACCESS</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.demoButtonsRow}>
            <TouchableOpacity 
              style={[styles.demoBtn, { backgroundColor: '#F59E0B' }]}
              onPress={() => loginAsRole('admin')}
            >
              <Text style={styles.demoBtnText}>Admin Portal</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.demoBtn, { backgroundColor: '#047857' }]}
              onPress={() => loginAsRole('employee')}
            >
              <Text style={styles.demoBtnText}>Employee Portal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      
      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2026 Styrka Live Tracking System
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F4C3A',
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,

    borderWidth: 2,
    borderColor: '#D97706',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    elevation: 6,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#A7F3D0',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    width: '100%',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F4C3A',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#0F4C3A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  demoBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  demoBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  footerText: {
    fontSize: 12,
    color: '#A7F3D0',
    fontWeight: '500',
  },
});

export default LoginScreen;
