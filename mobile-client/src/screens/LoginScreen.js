import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Image,
  Linking,
  AppState,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import * as api from '../services/api';
import * as Linking from 'expo-linking';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const { login } = useAuth();
  const pollIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Poll for authentication completion
  const startAuthPolling = () => {
    console.log('Starting auth polling...');
    pollIntervalRef.current = setInterval(async () => {
      try {
        console.log('Polling for auth status...');
        const authStatus = await api.checkAuthStatus();
        console.log('Auth status:', authStatus);
        
        if (authStatus.authenticated && authStatus.user) {
          // Authentication successful!
          console.log('Authentication successful! Logging in...');
          clearInterval(pollIntervalRef.current);
          setLoading(false);
          await login(authStatus.user, 'authenticated');
        }
      } catch (error) {
        console.error('Auth polling error:', error);
      }
    }, 2000); // Poll every 2 seconds
  };

  // Stop polling when user returns to app
  const handleAppStateChange = (nextAppState) => {
    console.log('App state changed:', appStateRef.current, '->', nextAppState);
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground, check auth immediately
      console.log('App came to foreground, checking auth...');
      checkAuthenticationStatus();
    }
    appStateRef.current = nextAppState;
  };

  const checkAuthenticationStatus = async () => {
    try {
      console.log('Checking authentication status...');
      const authStatus = await api.checkAuthStatus();
      console.log('Auth check result:', authStatus);
      
      if (authStatus.authenticated && authStatus.user) {
        console.log('User is authenticated, logging in...');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        setLoading(false);
        await login(authStatus.user, 'authenticated');
      }
    } catch (error) {
      console.error('Auth check error:', error);
    }
  };

  // Handle deep links
  React.useEffect(() => {
    const handleDeepLink = (url) => {
      console.log('Deep link received:', url);
      
      // Parse the deep link URL
      if (url.includes('auth/callback')) {
        const parsedUrl = Linking.parse(url);
        const token = parsedUrl.queryParams?.token;
        
        if (token) {
          console.log('Auth token from deep link:', token);
          setTokenInput(token);
          setShowTokenInput(true);
          // Automatically authenticate if we have a token
          handleTokenAuthWithToken(token);
        }
      }
    };

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      appStateSubscription?.remove();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleTokenAuthWithToken = async (token) => {
    try {
      setLoading(true);
      const result = await api.authenticateWithToken(token.trim());
      
      if (result.authenticated && result.user) {
        await login(result.user, 'authenticated');
        setShowTokenInput(false);
        setTokenInput('');
      }
    } catch (error) {
      console.error('Token auth error:', error);
      Alert.alert('Authentication Error', 
        error.response?.data?.error || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTokenAuth = async () => {
    if (!tokenInput.trim()) {
      Alert.alert('Error', 'Please enter the auth code');
      return;
    }
    
    await handleTokenAuthWithToken(tokenInput);
  };

  const handleStravaLogin = async () => {
    try {
      setLoading(true);
      
      // Get the Strava OAuth URL
      const authUrl = api.initiateStravaAuth();
      console.log('Opening OAuth URL:', authUrl);
      
      // Open Strava authorization in browser
      const supported = await Linking.canOpenURL(authUrl);
      
      if (supported) {
        await Linking.openURL(authUrl);
        
        // Check if this might be a development build
        const isDevBuild = typeof expo !== 'undefined' && expo.modules?.ExpoDevClient;
        
        if (isDevBuild) {
          Alert.alert(
            'Complete Login',
            'Complete the authorization in your browser. The app will automatically redirect back when done.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setLoading(false);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Complete Login',
            'After authorizing with Strava, you\'ll get a code to paste back here.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setLoading(false);
                },
              },
              {
                text: 'I have the code',
                onPress: () => {
                  setLoading(false);
                  setShowTokenInput(true);
                },
              },
            ]
          );
        }
      } else {
        Alert.alert('Error', 'Cannot open Strava login page');
        setLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Error', 'Failed to initiate login process');
      setLoading(false);
    }
  };

  // Mock login for development/testing
  const mockLogin = async () => {
    try {
      const mockUser = {
        id: 1,
        firstname: 'Test',
        lastname: 'User',
        ftp: 250,
        hrmax: 180,
        isFastTwitch: null,
      };
      
      const mockToken = 'mock-auth-token';
      await login(mockUser, mockToken);
      
    } catch (error) {
      console.error('Mock login error:', error);
      Alert.alert('Login Error', 'Mock login failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* App Logo/Header */}
        <View style={styles.header}>
          <Ionicons name="bicycle" size={80} color="#667eea" />
          <Text style={styles.appTitle}>Ride Domestique</Text>
          <Text style={styles.subtitle}>
            Analyze your cycling data with AI-powered coaching insights
          </Text>
        </View>

        {/* Login Section */}
        <View style={styles.loginSection}>
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleStravaLogin}
            disabled={loading}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="bicycle" size={24} color="white" />
              <Text style={styles.loginButtonText}>
                {loading ? 'Connecting...' : 'Connect with Strava'}
              </Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.loginInfo}>
            Connect your Strava account to analyze your cycling data and get personalized coaching insights.
          </Text>

          {/* Token Input Section */}
          {showTokenInput && (
            <View style={styles.tokenSection}>
              <Text style={styles.tokenTitle}>Enter Auth Code</Text>
              <TextInput
                style={styles.tokenInput}
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder="Paste your auth code here..."
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.tokenButtons}>
                <TouchableOpacity
                  style={[styles.tokenButton, styles.cancelButton]}
                  onPress={() => {
                    setShowTokenInput(false);
                    setTokenInput('');
                  }}
                >
                  <Text style={styles.tokenButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tokenButton, styles.confirmButton]}
                  onPress={handleTokenAuth}
                  disabled={loading || !tokenInput.trim()}
                >
                  <Text style={styles.tokenButtonText}>
                    {loading ? 'Authenticating...' : 'Login'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Show token input option */}
          {!showTokenInput && (
            <TouchableOpacity
              style={styles.tokenInputButton}
              onPress={() => setShowTokenInput(true)}
            >
              <Ionicons name="key" size={20} color="#667eea" />
              <Text style={styles.tokenInputButtonText}>Have an auth code?</Text>
            </TouchableOpacity>
          )}

          {/* Development Buttons */}
          {__DEV__ && (
            <>
              <TouchableOpacity
                style={styles.mockLoginButton}
                onPress={mockLogin}
              >
                <Text style={styles.mockLoginText}>Mock Login (Dev)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.mockLoginButton, { backgroundColor: '#38b2ac', marginTop: 10 }]}
                onPress={checkAuthenticationStatus}
              >
                <Text style={styles.mockLoginText}>Check Login Status</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Features */}
        <View style={styles.features}>
          <Text style={styles.featuresTitle}>Features:</Text>
          <View style={styles.featureItem}>
            <Ionicons name="analytics-outline" size={20} color="#667eea" />
            <Text style={styles.featureText}>Detailed ride analysis</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="fitness-outline" size={20} color="#667eea" />
            <Text style={styles.featureText}>Power & heart rate zones</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="chatbubble-outline" size={20} color="#667eea" />
            <Text style={styles.featureText}>AI coaching feedback</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="trophy-outline" size={20} color="#667eea" />
            <Text style={styles.featureText}>Training goals tracking</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  loginSection: {
    marginBottom: 40,
  },
  loginButton: {
    backgroundColor: '#FC4C02',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 15,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  loginInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  mockLoginButton: {
    backgroundColor: '#28a745',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignSelf: 'center',
  },
  mockLoginText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  features: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#555',
    marginLeft: 12,
  },
  tokenSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tokenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  tokenInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 15,
    fontSize: 14,
    backgroundColor: '#f8f9ff',
    textAlignVertical: 'top',
    minHeight: 80,
    fontFamily: 'monospace',
  },
  tokenButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10,
  },
  tokenButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e53e3e',
  },
  confirmButton: {
    backgroundColor: '#667eea',
  },
  tokenButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tokenInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#667eea',
    marginTop: 15,
  },
  tokenInputButtonText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});