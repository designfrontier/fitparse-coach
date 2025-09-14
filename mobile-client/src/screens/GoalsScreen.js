import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';

export default function GoalsScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalText, setGoalText] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [selectedType, setSelectedType] = useState('performance');

  const queryClient = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: ['goals'],
    queryFn: api.getGoals,
  });

  const createGoalMutation = useMutation({
    mutationFn: api.createGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Goal created successfully!');
    },
    onError: (error) => {
      console.error('Create goal error:', error);
      Alert.alert('Error', 'Failed to create goal. Please try again.');
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.updateGoal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Goal updated successfully!');
    },
    onError: (error) => {
      console.error('Update goal error:', error);
      Alert.alert('Error', 'Failed to update goal. Please try again.');
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: api.deleteGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      Alert.alert('Success', 'Goal deleted successfully!');
    },
    onError: (error) => {
      console.error('Delete goal error:', error);
      Alert.alert('Error', 'Failed to delete goal. Please try again.');
    },
  });

  const goalTypes = [
    { key: 'performance', label: 'Performance', icon: 'trophy', color: '#f6ad55' },
    { key: 'fitness', label: 'Fitness', icon: 'fitness', color: '#48bb78' },
    { key: 'weight', label: 'Weight', icon: 'scale', color: '#9f7aea' },
    { key: 'distance', label: 'Distance', icon: 'location', color: '#38b2ac' },
  ];

  const resetForm = () => {
    setGoalText('');
    setTargetValue('');
    setSelectedType('performance');
    setEditingGoal(null);
  };

  const handleAddGoal = () => {
    resetForm();
    setModalVisible(true);
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setGoalText(goal.goal);
    setTargetValue(goal.targetValue?.toString() || '');
    setSelectedType(goal.type || 'performance');
    setModalVisible(true);
  };

  const handleSaveGoal = () => {
    if (!goalText.trim()) {
      Alert.alert('Invalid Input', 'Please enter a goal description');
      return;
    }

    const goalData = {
      goal: goalText.trim(),
      targetValue: targetValue ? parseFloat(targetValue) : null,
      type: selectedType,
    };

    if (editingGoal) {
      updateGoalMutation.mutate({ id: editingGoal.id, ...goalData });
    } else {
      createGoalMutation.mutate(goalData);
    }
  };

  const handleDeleteGoal = (goal) => {
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete "${goal.goal}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteGoalMutation.mutate(goal.id),
        },
      ]
    );
  };

  const getTypeConfig = (type) => {
    return goalTypes.find(t => t.key === type) || goalTypes[0];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Training Goals</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddGoal}>
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {goalsQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="sync" size={40} color="#667eea" />
            <Text style={styles.loadingText}>Loading goals...</Text>
          </View>
        ) : goalsQuery.error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={40} color="#e53e3e" />
            <Text style={styles.errorText}>Failed to load goals</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => goalsQuery.refetch()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : goalsQuery.data?.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={60} color="#ccc" />
            <Text style={styles.emptyTitle}>No Goals Set</Text>
            <Text style={styles.emptyText}>
              Set your first training goal to track your progress and stay motivated.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={handleAddGoal}>
              <Text style={styles.primaryButtonText}>Add First Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.goalsContainer}>
            {goalsQuery.data?.map((goal) => {
              const typeConfig = getTypeConfig(goal.type);
              return (
                <View key={goal.id} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <View style={[styles.goalIcon, { backgroundColor: typeConfig.color + '20' }]}>
                      <Ionicons name={typeConfig.icon} size={20} color={typeConfig.color} />
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalType}>{typeConfig.label}</Text>
                      <Text style={styles.goalDate}>Created {formatDate(goal.createdAt)}</Text>
                    </View>
                    <View style={styles.goalActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditGoal(goal)}
                      >
                        <Ionicons name="pencil" size={16} color="#667eea" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDeleteGoal(goal)}
                      >
                        <Ionicons name="trash" size={16} color="#e53e3e" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.goalText}>{goal.goal}</Text>
                  {goal.targetValue && (
                    <View style={styles.targetContainer}>
                      <Ionicons name="flag" size={14} color="#666" />
                      <Text style={styles.targetText}>Target: {goal.targetValue}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Goal Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingGoal ? 'Edit Goal' : 'New Goal'}
            </Text>
            <TouchableOpacity
              onPress={handleSaveGoal}
              style={styles.modalButton}
              disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
            >
              <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                {createGoalMutation.isPending || updateGoalMutation.isPending ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Goal Type Selection */}
            <Text style={styles.inputLabel}>Goal Type</Text>
            <View style={styles.typeGrid}>
              {goalTypes.map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeCard,
                    selectedType === type.key && styles.typeCardSelected,
                  ]}
                  onPress={() => setSelectedType(type.key)}
                >
                  <Ionicons
                    name={type.icon}
                    size={24}
                    color={selectedType === type.key ? type.color : '#666'}
                  />
                  <Text style={[
                    styles.typeLabel,
                    selectedType === type.key && styles.typeLabelSelected,
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Goal Description */}
            <Text style={styles.inputLabel}>Goal Description</Text>
            <TextInput
              style={styles.textArea}
              value={goalText}
              onChangeText={setGoalText}
              placeholder="Describe your training goal..."
              multiline
              numberOfLines={4}
            />

            {/* Target Value */}
            <Text style={styles.inputLabel}>Target Value (Optional)</Text>
            <TextInput
              style={styles.textInput}
              value={targetValue}
              onChangeText={setTargetValue}
              placeholder="e.g., 300 (for watts), 5:00 (for time)"
              keyboardType="numeric"
            />
            <Text style={styles.inputHelp}>
              Add a specific target if your goal is measurable (e.g., FTP watts, race time, distance)
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9ff',
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#667eea',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#e53e3e',
    marginTop: 15,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  goalsContainer: {
    padding: 20,
    gap: 15,
  },
  goalCard: {
    backgroundColor: 'white',
    padding: 16,
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
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalInfo: {
    flex: 1,
  },
  goalType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  goalDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
  },
  goalText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
  },
  targetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  targetText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalButton: {
    padding: 8,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#667eea',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButtonText: {
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 20,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  typeCard: {
    width: '47%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f0f4ff',
  },
  typeLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  typeLabelSelected: {
    color: '#667eea',
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    height: 100,
    textAlignVertical: 'top',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  inputHelp: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
});