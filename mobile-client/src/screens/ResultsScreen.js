import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import * as api from '../services/api';

export default function ResultsScreen({ route, navigation }) {
  const { data } = route.params || {};

  const sendToAIMutation = useMutation({
    mutationFn: api.sendToAI,
    onSuccess: () => {
      navigation.navigate('Coaching');
    },
    onError: (error) => {
      console.error('Send to AI error:', error);
    },
  });

  const handleSendToAI = () => {
    if (data) {
      sendToAIMutation.mutate({ analysis: data });
    }
  };

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>No analysis data available</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatMetric = (value, unit = '') => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      return `${Math.round(value)}${unit}`;
    }
    return value;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#667eea" />
          </TouchableOpacity>
          <Text style={styles.title}>Analysis Results</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSendToAI}
            disabled={sendToAIMutation.isPending}
          >
            <Ionicons 
              name={sendToAIMutation.isPending ? "sync" : "chatbubble-ellipses"} 
              size={24} 
              color="#667eea" 
            />
          </TouchableOpacity>
        </View>

        {/* Summary Stats */}
        {data.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout Summary</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{formatMetric(data.summary.duration, 'min')}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{formatMetric(data.summary.avgPower, 'W')}</Text>
                <Text style={styles.statLabel}>Avg Power</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{formatMetric(data.summary.normalizedPower, 'W')}</Text>
                <Text style={styles.statLabel}>NP</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{formatMetric(data.summary.tss)}</Text>
                <Text style={styles.statLabel}>TSS</Text>
              </View>
            </View>
          </View>
        )}

        {/* Power Zones */}
        {data.powerZones && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Power Zone Distribution</Text>
            <View style={styles.zonesContainer}>
              {data.powerZones.map((zone, index) => (
                <View key={index} style={[styles.zoneItem, { borderLeftColor: zone.color }]}>
                  <View style={styles.zoneInfo}>
                    <Text style={styles.zoneName}>{zone.name}</Text>
                    <Text style={styles.zoneRange}>{zone.range}</Text>
                  </View>
                  <View style={styles.zoneStats}>
                    <Text style={styles.zoneTime}>{formatMetric(zone.time, 'min')}</Text>
                    <Text style={styles.zonePercentage}>{formatMetric(zone.percentage, '%')}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Heart Rate Analysis */}
        {data.heartRate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Heart Rate Analysis</Text>
            <View style={styles.hrContainer}>
              <View style={styles.hrStat}>
                <Ionicons name="heart" size={20} color="#e53e3e" />
                <Text style={styles.hrLabel}>Average HR</Text>
                <Text style={styles.hrValue}>{formatMetric(data.heartRate.average, ' bpm')}</Text>
              </View>
              <View style={styles.hrStat}>
                <Ionicons name="trending-up" size={20} color="#f56565" />
                <Text style={styles.hrLabel}>Max HR</Text>
                <Text style={styles.hrValue}>{formatMetric(data.heartRate.max, ' bpm')}</Text>
              </View>
              {data.heartRate.drift && (
                <View style={styles.hrStat}>
                  <Ionicons name="analytics" size={20} color="#ed8936" />
                  <Text style={styles.hrLabel}>HR Drift</Text>
                  <Text style={styles.hrValue}>{formatMetric(data.heartRate.drift, '%')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Training Recommendations */}
        {data.recommendations && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Training Insights</Text>
            <View style={styles.recommendationsContainer}>
              {data.recommendations.map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Ionicons name="bulb" size={16} color="#667eea" />
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Send to AI Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.aiButton, sendToAIMutation.isPending && styles.buttonDisabled]}
            onPress={handleSendToAI}
            disabled={sendToAIMutation.isPending}
          >
            <View style={styles.buttonContent}>
              <Ionicons 
                name={sendToAIMutation.isPending ? "sync" : "chatbubble-ellipses"} 
                size={20} 
                color="white" 
              />
              <Text style={styles.buttonText}>
                {sendToAIMutation.isPending ? 'Sending...' : 'Send to AI Coach'}
              </Text>
            </View>
          </TouchableOpacity>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    margin: 20,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  zonesContainer: {
    gap: 8,
  },
  zoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    backgroundColor: '#f8f9ff',
    borderRadius: 6,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  zoneRange: {
    fontSize: 12,
    color: '#666',
  },
  zoneStats: {
    alignItems: 'flex-end',
  },
  zoneTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  zonePercentage: {
    fontSize: 12,
    color: '#666',
  },
  hrContainer: {
    gap: 12,
  },
  hrStat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9ff',
    borderRadius: 6,
  },
  hrLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  hrValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  recommendationsContainer: {
    gap: 10,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f4ff',
    borderRadius: 6,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginLeft: 8,
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: 30,
  },
  aiButton: {
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
});