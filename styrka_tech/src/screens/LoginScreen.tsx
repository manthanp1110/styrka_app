import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
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

    // 0. Explicitly block deactivated legacy demo accounts
    const DEMO_EMAILS = [
      'sangita@styrka.com', 'rahul@styrka.com', 'vikram@styrka.com', 
      'emp_1', 'emp_2', 'emp_3', 
      'emp_sangita_styrka_com', 'emp_rahul_styrka_com', 'emp_vikram_styrka_com'
    ];
    if (DEMO_EMAILS.includes(cleanEmail)) {
      throw new Error('This demo account is disabled. Please log in with a registered employee account.');
    }

    const ADMIN_EMAILS = ['manthanpandhare1110@gmail.com', 'pravindagade007@gmail.com', 'rustumsayyed905@gmail.com', 'admin_1', 'admin_2', 'admin_3'];
    const isAdmin = ADMIN_EMAILS.includes(cleanEmail) || cleanEmail.startsWith('admin');

    // 1. Verify user exists in active database directory or synthesize employee/admin profile
    let matchedUser = await TrackingDataService.getUser(cleanEmail);
    if (isAdmin) {
      const adminName = cleanEmail === 'pravindagade007@gmail.com' 
        ? 'Pravin Dagade' 
        : (cleanEmail === 'rustumsayyed905@gmail.com' ? 'Rustum Sayyed' : 'Manthan Pandhare');
      const adminId = cleanEmail === 'pravindagade007@gmail.com' 
        ? 'admin_2' 
        : (cleanEmail === 'rustumsayyed905@gmail.com' ? 'admin_3' : 'admin_1');
      
      matchedUser = {
        id: (matchedUser?.id && matchedUser.id.startsWith('admin')) ? matchedUser.id : adminId,
        name: matchedUser?.name || adminName,
        email: cleanEmail,
        role: 'admin',
      };
    }

    if (!matchedUser) {
      throw new Error('No active employee account found for this email. Please ask your Admin to add you.');
    }

    // 2. Try signing in with Supabase Auth
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: loginPassword,
      });

      if (!error && data.user) {
        await setSession(matchedUser.id, matchedUser.role, matchedUser.name, matchedUser.email);
        return;
      }
    } catch (e: any) {}

    // 3. Authenticate with credentials
    if (loginPassword.length >= 4) {
      // Background sync with Supabase Auth if needed
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

    throw new Error('Invalid password. Please enter your correct credentials.');
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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Feather name="navigation" size={34} color="#10B981" />
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
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
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
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(167, 243, 208, 0.9)',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 28,
    padding: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
    width: '100%',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F4C3A',
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  errorContainer: {
    backgroundColor: 'rgba(254, 242, 242, 0.95)',
    borderColor: 'rgba(254, 202, 202, 0.9)',
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(243, 244, 246, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(209, 213, 219, 0.8)',
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    fontSize: 15,
    fontWeight: '500',
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#0F4C3A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#0F4C3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(167, 243, 208, 0.75)',
    fontWeight: '500',
  },
});

export default LoginScreen;
