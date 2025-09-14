import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext';
import * as api from '../services/api';

const { width } = Dimensions.get('window');

export default function StatsScreen() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  const periods = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
  ];

  const statsQuery = useQuery({
    queryKey: ['stats', selectedPeriod],
    queryFn: () => api.getStats(selectedPeriod),
    enabled: !!user,
  });

  const formatValue = (value, unit = '') => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k${unit}`;
      }
      return `${Math.round(value)}${unit}`;
    }
    return value;
  };

  const formatTime = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const calculatePowerZones = () => {
    const ftp = user?.ftp || 250;
    return [
      { name: 'Z1 Recovery', range: `< ${Math.round(ftp * 0.55)}W`, color: '#4299e1' },
      { name: 'Z2 Endurance', range: `${Math.round(ftp * 0.55)}-${Math.round(ftp * 0.75)}W`, color: '#48bb78' },
      { name: 'Z3 Tempo', range: `${Math.round(ftp * 0.76)}-${Math.round(ftp * 0.90)}W`, color: '#ed8936' },
      { name: 'Z4 Threshold', range: `${Math.round(ftp * 0.91)}-${Math.round(ftp * 1.05)}W`, color: '#f56565' },
      { name: 'Z5 VO2Max', range: `${Math.round(ftp * 1.06)}-${Math.round(ftp * 1.20)}W`, color: '#9f7aea' },
      { name: 'Z6+ Neuromuscular', range: `> ${Math.round(ftp * 1.20)}W`, color: '#667eea' },
    ];
  };

  const mockStats = {
    rides: 12,
    totalTime: 1440, // 24 hours
    totalDistance: 480, // km
    avgPower: 220,
    maxPower: 485,
    avgSpeed: 32.5,
    elevation: 8200,
    totalTSS: 1250,
    avgTSS: 104,
    powerZoneDistribution: [
      { zone: 'Z1', percentage: 15, time: 216 },
      { zone: 'Z2', percentage: 35, time: 504 },
      { zone: 'Z3', percentage: 25, time: 360 },
      { zone: 'Z4', percentage: 15, time: 216 },
      { zone: 'Z5', percentage: 8, time: 115 },
      { zone: 'Z6+', percentage: 2, time: 29 },
    ],
  };

  const stats = statsQuery.data || mockStats;
  const powerZones = calculatePowerZones();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Stats</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Period Selection */}
        <View style={styles.periodContainer}>
          <View style={styles.periodSelector}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period.key}
                style={[
                  styles.periodButton,
                  selectedPeriod === period.key && styles.periodButtonActive,
                ]}
                onPress={() => setSelectedPeriod(period.key)}
              >
                <Text style={[
                  styles.periodText,
                  selectedPeriod === period.key && styles.periodTextActive,
                ]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {statsQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="sync" size={40} color="#667eea" />
            <Text style={styles.loadingText}>Loading stats...</Text>
          </View>
        ) : (
          <>
            {/* Overview Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.overviewGrid}>
                <View style={styles.overviewCard}>
                  <Ionicons name="bicycle" size={24} color="#667eea" />
                  <Text style={styles.overviewValue}>{formatValue(stats.rides)}</Text>
                  <Text style={styles.overviewLabel}>Rides</Text>
                </View>
                <View style={styles.overviewCard}>
                  <Ionicons name="time" size={24} color="#48bb78" />
                  <Text style={styles.overviewValue}>{formatTime(stats.totalTime)}</Text>
                  <Text style={styles.overviewLabel}>Total Time</Text>
                </View>
                <View style={styles.overviewCard}>
                  <Ionicons name="map" size={24} color="#ed8936" />
                  <Text style={styles.overviewValue}>{formatValue(stats.totalDistance, 'km')}</Text>
                  <Text style={styles.overviewLabel}>Distance</Text>
                </View>
                <View style={styles.overviewCard}>
                  <Ionicons name="trending-up" size={24} color="#f56565" />
                  <Text style={styles.overviewValue}>{formatValue(stats.elevation, 'm')}</Text>
                  <Text style={styles.overviewLabel}>Elevation</Text>
                </View>
              </View>
            </View>

            {/* Power Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Power Performance</Text>
              <View style={styles.powerGrid}>
                <View style={styles.powerCard}>
                  <View style={styles.powerCardHeader}>
                    <Ionicons name="flash" size={20} color="#f6ad55" />
                    <Text style={styles.powerLabel}>Average Power</Text>
                  </View>
                  <Text style={styles.powerValue}>{formatValue(stats.avgPower, 'W')}</Text>
                </View>
                <View style={styles.powerCard}>
                  <View style={styles.powerCardHeader}>
                    <Ionicons name="flash" size={20} color="#e53e3e" />
                    <Text style={styles.powerLabel}>Max Power</Text>
                  </View>
                  <Text style={styles.powerValue}>{formatValue(stats.maxPower, 'W')}</Text>
                </View>
                <View style={styles.powerCard}>
                  <View style={styles.powerCardHeader}>
                    <Ionicons name="speedometer" size={20} color="#38b2ac" />
                    <Text style={styles.powerLabel}>Avg Speed</Text>
                  </View>
                  <Text style={styles.powerValue}>{formatValue(stats.avgSpeed, 'km/h')}</Text>
                </View>
              </View>
            </View>

            {/* Training Load */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Training Load</Text>
              <View style={styles.tssContainer}>
                <View style={styles.tssCard}>
                  <Text style={styles.tssValue}>{formatValue(stats.totalTSS)}</Text>
                  <Text style={styles.tssLabel}>Total TSS</Text>
                </View>
                <View style={styles.tssCard}>
                  <Text style={styles.tssValue}>{formatValue(stats.avgTSS)}</Text>
                  <Text style={styles.tssLabel}>Average TSS/Ride</Text>
                </View>
              </View>
              <Text style={styles.tssHelp}>
                TSS (Training Stress Score) measures training load intensity and duration
              </Text>
            </View>

            {/* Power Zone Distribution */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Power Zone Distribution</Text>
              <View style={styles.zonesContainer}>
                {stats.powerZoneDistribution?.map((zoneData, index) => {
                  const zoneConfig = powerZones[index];
                  const percentage = zoneData.percentage || 0;
                  return (
                    <View key={index} style={styles.zoneItem}>
                      <View style={styles.zoneHeader}>
                        <View style={[styles.zoneColor, { backgroundColor: zoneConfig.color }]} />
                        <Text style={styles.zoneName}>{zoneConfig.name}</Text>
                        <Text style={styles.zoneRange}>{zoneConfig.range}</Text>
                      </View>
                      <View style={styles.zoneStats}>
                        <View style={styles.zoneBar}>
                          <View 
                            style={[
                              styles.zoneBarFill, 
                              { 
                                width: `${percentage}%`, 
                                backgroundColor: zoneConfig.color 
                              }
                            ]} 
                          />
                        </View>
                        <Text style={styles.zonePercentage}>{percentage}%</Text>
                      </View>
                      <Text style={styles.zoneTime}>{formatTime(zoneData.time)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Personal Bests */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Profile</Text>
              <View style={styles.profileContainer}>
                <View style={styles.profileItem}>
                  <Ionicons name="flash" size={20} color="#f6ad55" />
                  <Text style={styles.profileLabel}>FTP</Text>
                  <Text style={styles.profileValue}>{user?.ftp || 250}W</Text>
                </View>
                <View style={styles.profileItem}>
                  <Ionicons name="heart" size={20} color="#e53e3e" />
                  <Text style={styles.profileLabel}>HR Max</Text>
                  <Text style={styles.profileValue}>{user?.hrmax || 180} bpm</Text>
                </View>
                <View style={styles.profileItem}>
                  <Ionicons name="fitness" size={20} color="#9f7aea" />
                  <Text style={styles.profileLabel}>Fiber Type</Text>
                  <Text style={styles.profileValue}>
                    {user?.isFastTwitch === true ? 'Fast-twitch' : user?.isFastTwitch === false ? 'Slow-twitch' : 'Unknown'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  periodContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#667eea',
  },
  periodText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
  },
  section: {
    margin: 20,
    marginTop: 10,
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
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  overviewCard: {
    width: (width - 70) / 2,
    backgroundColor: '#f8f9ff',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#666',
  },
  powerGrid: {
    gap: 12,
  },
  powerCard: {
    backgroundColor: '#f8f9ff',
    padding: 16,
    borderRadius: 12,
  },
  powerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  powerLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  powerValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  tssContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tssCard: {
    flex: 1,
    backgroundColor: '#f8f9ff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  tssValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  tssLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  tssHelp: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  zonesContainer: {
    gap: 10,
  },
  zoneItem: {
    backgroundColor: '#f8f9ff',
    padding: 12,
    borderRadius: 8,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  zoneColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  zoneName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  zoneRange: {
    fontSize: 12,
    color: '#666',
  },
  zoneStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  zoneBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginRight: 10,
  },
  zoneBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  zonePercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 35,
  },
  zoneTime: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  profileContainer: {
    gap: 12,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    padding: 12,
    borderRadius: 8,
  },
  profileLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  profileValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});