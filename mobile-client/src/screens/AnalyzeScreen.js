import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import * as api from '../services/api';

export default function AnalyzeScreen({ navigation }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('week');

  const timeframes = [
    { key: 'week', label: 'This Week', icon: 'calendar-outline' },
    { key: '2weeks', label: 'Last 2 Weeks', icon: 'calendar' },
    { key: 'month', label: 'This Month', icon: 'calendar-sharp' },
  ];

  const analyzeMutation = useMutation({
    mutationFn: api.analyzeActivities,
    onSuccess: (data) => {
      navigation.navigate('Results', { data });
    },
    onError: (error) => {
      console.error('Analysis error:', error);
      Alert.alert(
        'Analysis Error',
        'Failed to analyze activities. Please check your connection and try again.'
      );
    },
  });

  const handleAnalyze = () => {
    // Calculate date range based on selected timeframe
    const endDate = new Date();
    const startDate = new Date();
    
    switch (selectedTimeframe) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '2weeks':
        startDate.setDate(endDate.getDate() - 14);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
    }

    analyzeMutation.mutate({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      timeframe: selectedTimeframe,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analyze Your Rides</Text>
          <Text style={styles.subtitle}>
            Select a timeframe to analyze your cycling activities and get detailed insights.
          </Text>
        </View>

        {/* Timeframe Selection */}
        <View style={styles.timeframeContainer}>
          <Text style={styles.sectionTitle}>Select Timeframe</Text>
          {timeframes.map((timeframe) => (
            <TouchableOpacity
              key={timeframe.key}
              style={[
                styles.timeframeCard,
                selectedTimeframe === timeframe.key && styles.selectedCard,
              ]}
              onPress={() => setSelectedTimeframe(timeframe.key)}
            >
              <View style={styles.timeframeContent}>
                <Ionicons 
                  name={timeframe.icon} 
                  size={24} 
                  color={selectedTimeframe === timeframe.key ? '#667eea' : '#666'} 
                />
                <Text style={[
                  styles.timeframeLabel,
                  selectedTimeframe === timeframe.key && styles.selectedText,
                ]}>
                  {timeframe.label}
                </Text>
              </View>
              {selectedTimeframe === timeframe.key && (
                <Ionicons name="checkmark-circle" size={24} color="#667eea" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Analysis Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.sectionTitle}>What You'll Get</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="analytics" size={20} color="#667eea" />
              <Text style={styles.infoText}>Detailed ride analysis</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="heart" size={20} color="#e53e3e" />
              <Text style={styles.infoText}>Heart rate drift analysis</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="flash" size={20} color="#f6ad55" />
              <Text style={styles.infoText}>Power zone distribution</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="trophy" size={20} color="#48bb78" />
              <Text style={styles.infoText}>Training stress score</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="fitness" size={20} color="#9f7aea" />
              <Text style={styles.infoText}>Interval breakdown</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="trending-up" size={20} color="#38b2ac" />
              <Text style={styles.infoText}>Performance trends</Text>
            </View>
          </View>
        </View>

        {/* Analyze Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.analyzeButton, analyzeMutation.isPending && styles.buttonDisabled]}
            onPress={handleAnalyze}
            disabled={analyzeMutation.isPending}
          >
            <View style={styles.buttonContent}>
              {analyzeMutation.isPending ? (
                <Ionicons name="sync" size={20} color="white" />
              ) : (
                <Ionicons name="analytics" size={20} color="white" />
              )}
              <Text style={styles.buttonText}>
                {analyzeMutation.isPending ? 'Analyzing...' : 'Start Analysis'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            The analysis will fetch your Strava activities from the selected timeframe and provide detailed insights including power zones, heart rate analysis, and training recommendations.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  timeframeContainer: {
    padding: 20,
    paddingTop: 0,
  },
  timeframeCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedCard: {
    borderColor: '#667eea',
    backgroundColor: '#f0f4ff',
  },
  timeframeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeframeLabel: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
  selectedText: {
    color: '#667eea',
    fontWeight: '600',
  },
  infoContainer: {
    padding: 20,
    paddingTop: 0,
  },
  infoGrid: {
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
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  buttonContainer: {
    padding: 20,
  },
  analyzeButton: {
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  helpContainer: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 30,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
  },
});