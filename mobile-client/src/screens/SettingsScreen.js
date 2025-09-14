import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext';
import * as api from '../services/api';
import { Picker } from '@react-native-picker/picker';

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth();
  const [ftp, setFtp] = useState(user?.ftp?.toString() || '250');
  const [hrmax, setHrmax] = useState(user?.hrmax?.toString() || '180');
  const [isFastTwitch, setIsFastTwitch] = useState(user?.isFastTwitch);

  const settingsMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      updateUser(data.user);
      Alert.alert('Success', 'Settings updated successfully!');
    },
    onError: (error) => {
      console.error('Settings error:', error);
      Alert.alert('Error', 'Failed to update settings. Please try again.');
    },
  });

  const handleSave = () => {
    const ftpValue = parseInt(ftp);
    const hrmaxValue = parseInt(hrmax);

    if (isNaN(ftpValue) || ftpValue < 100 || ftpValue > 600) {
      Alert.alert('Invalid FTP', 'Please enter a valid FTP between 100-600 watts');
      return;
    }

    if (isNaN(hrmaxValue) || hrmaxValue < 120 || hrmaxValue > 220) {
      Alert.alert('Invalid HR Max', 'Please enter a valid HR Max between 120-220 BPM');
      return;
    }

    settingsMutation.mutate({
      ftp: ftpValue,
      hrmax: hrmaxValue,
      isFastTwitch,
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const getFastTwitchLabel = (value) => {
    if (value === true) return 'Fast-twitch (Explosive)';
    if (value === false) return 'Slow-twitch (Endurance)';
    return 'Not determined';
  };

  const powerZones = [
    { name: 'Z1 Recovery', range: `< ${Math.round(parseInt(ftp) * 0.55)}W`, color: '#4299e1' },
    { name: 'Z2 Endurance', range: `${Math.round(parseInt(ftp) * 0.55)}-${Math.round(parseInt(ftp) * 0.75)}W`, color: '#48bb78' },
    { name: 'Z3 Tempo', range: `${Math.round(parseInt(ftp) * 0.76)}-${Math.round(parseInt(ftp) * 0.90)}W`, color: '#ed8936' },
    { name: 'Z4 Threshold', range: `${Math.round(parseInt(ftp) * 0.91)}-${Math.round(parseInt(ftp) * 1.05)}W`, color: '#f56565' },
    { name: 'Z5 VO2Max', range: `${Math.round(parseInt(ftp) * 1.06)}-${Math.round(parseInt(ftp) * 1.20)}W`, color: '#9f7aea' },
    { name: 'Z6+ Neuromuscular', range: `> ${Math.round(parseInt(ftp) * 1.20)}W`, color: '#667eea' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Profile */}
        <View style={styles.profileContainer}>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user?.firstname} {user?.lastname}
            </Text>
            <Text style={styles.userEmail}>Connected with Strava</Text>
          </View>
        </View>

        {/* Training Settings */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Training Parameters</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Functional Threshold Power (FTP)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={ftp}
                onChangeText={setFtp}
                placeholder="250"
                keyboardType="numeric"
              />
              <Text style={styles.inputUnit}>W</Text>
            </View>
            <Text style={styles.inputHelp}>Your sustained power for 1 hour</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Maximum Heart Rate</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={hrmax}
                onChangeText={setHrmax}
                placeholder="180"
                keyboardType="numeric"
              />
              <Text style={styles.inputUnit}>BPM</Text>
            </View>
            <Text style={styles.inputHelp}>Your highest recorded heart rate</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Muscle Fiber Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={isFastTwitch}
                onValueChange={setIsFastTwitch}
                style={styles.picker}
              >
                <Picker.Item label="Not determined" value={null} />
                <Picker.Item label="Fast-twitch (Explosive)" value={true} />
                <Picker.Item label="Slow-twitch (Endurance)" value={false} />
              </Picker>
            </View>
            <Text style={styles.inputHelp}>
              Based on vertical jump: Men ≥20", Women ≥14" = Fast-twitch
            </Text>
          </View>
        </View>

        {/* Power Zones Preview */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Power Zones (Based on FTP)</Text>
          <View style={styles.zonesContainer}>
            {powerZones.map((zone, index) => (
              <View key={index} style={[styles.zoneItem, { borderLeftColor: zone.color }]}>
                <Text style={styles.zoneName}>{zone.name}</Text>
                <Text style={styles.zoneRange}>{zone.range}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, settingsMutation.isPending && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={settingsMutation.isPending}
          >
            <Text style={styles.saveButtonText}>
              {settingsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View style={styles.logoutContainer}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#e53e3e" />
            <Text style={styles.logoutText}>Logout</Text>
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
  profileContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  profileInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  sectionContainer: {
    backgroundColor: 'white',
    margin: 20,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9ff',
  },
  inputUnit: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
    minWidth: 30,
  },
  inputHelp: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#f8f9ff',
  },
  picker: {
    height: 50,
  },
  zonesContainer: {
    gap: 8,
  },
  zoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    backgroundColor: '#f8f9ff',
    borderRadius: 6,
  },
  zoneName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  zoneRange: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    padding: 20,
  },
  saveButton: {
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  logoutContainer: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 30,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e53e3e',
  },
  logoutText: {
    color: '#e53e3e',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});