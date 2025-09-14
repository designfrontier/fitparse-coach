import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import * as api from '../services/api';

export default function CoachingScreen() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [includeRecentData, setIncludeRecentData] = useState(true);

  const coachingMutation = useMutation({
    mutationFn: api.sendCoachingMessage,
    onSuccess: (data) => {
      // Add the response to messages
      setMessages(prev => [
        ...prev,
        { text: message, isUser: true, timestamp: new Date() },
        { text: data.response, isUser: false, timestamp: new Date() },
      ]);
      setMessage('');
    },
    onError: (error) => {
      console.error('Coaching error:', error);
      Alert.alert(
        'Coaching Error',
        'Failed to get coaching response. Please check your API key configuration.'
      );
    },
  });

  const handleSendMessage = () => {
    if (!message.trim()) return;

    coachingMutation.mutate({
      message: message.trim(),
      includeRecentData,
    });
  };

  const clearHistory = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear the conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive', 
          onPress: () => setMessages([])
        },
      ]
    );
  };

  const quickPrompts = [
    'Analyze my recent workouts',
    'How can I improve my FTP?',
    'What should I focus on this week?',
    'How is my training load?',
    'Recovery recommendations?',
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Coaching</Text>
        {messages.length > 0 && (
          <TouchableOpacity onPress={clearHistory} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={20} color="#e53e3e" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.welcomeContainer}>
            <Ionicons name="chatbubble-ellipses" size={60} color="#667eea" />
            <Text style={styles.welcomeTitle}>Welcome to AI Coaching!</Text>
            <Text style={styles.welcomeText}>
              Ask questions about your training, get personalized advice, or request analysis of your recent rides.
            </Text>
            
            <Text style={styles.promptsTitle}>Quick prompts:</Text>
            <View style={styles.quickPrompts}>
              {quickPrompts.map((prompt, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.promptButton}
                  onPress={() => setMessage(prompt)}
                >
                  <Text style={styles.promptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.messagesList}>
            {messages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.messageContainer,
                  msg.isUser ? styles.userMessage : styles.aiMessage,
                ]}
              >
                <Text style={[
                  styles.messageText,
                  msg.isUser ? styles.userMessageText : styles.aiMessageText,
                ]}>
                  {msg.text}
                </Text>
                <Text style={styles.messageTime}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionButton, includeRecentData && styles.optionSelected]}
            onPress={() => setIncludeRecentData(!includeRecentData)}
          >
            <Ionicons 
              name={includeRecentData ? "checkbox" : "checkbox-outline"} 
              size={16} 
              color={includeRecentData ? "#667eea" : "#666"} 
            />
            <Text style={[
              styles.optionText,
              includeRecentData && styles.optionSelectedText
            ]}>
              Include recent training data
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.messageInputContainer}>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder="Ask your AI coach..."
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || coachingMutation.isPending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!message.trim() || coachingMutation.isPending}
          >
            {coachingMutation.isPending ? (
              <Ionicons name="sync" size={20} color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
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
  clearButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  promptsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  quickPrompts: {
    width: '100%',
    gap: 10,
  },
  promptButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#667eea',
    alignItems: 'center',
  },
  promptText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '500',
  },
  messagesList: {
    padding: 20,
    paddingBottom: 0,
  },
  messageContainer: {
    marginBottom: 15,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 12,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: 'white',
  },
  aiMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    backgroundColor: 'white',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  optionsContainer: {
    marginBottom: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionSelected: {
    opacity: 1,
  },
  optionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  optionSelectedText: {
    color: '#667eea',
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#667eea',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
});