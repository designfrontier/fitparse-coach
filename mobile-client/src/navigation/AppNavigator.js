import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';

// Screen imports
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AnalyzeScreen from '../screens/AnalyzeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ResultsScreen from '../screens/ResultsScreen';
import GoalsScreen from '../screens/GoalsScreen';
import StatsScreen from '../screens/StatsScreen';
import CoachingScreen from '../screens/CoachingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Analyze') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'Coaching') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#667eea',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Analyze" component={AnalyzeScreen} />
      <Tab.Screen name="Coaching" component={CoachingScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Main App Navigator
export default function AppNavigator() {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen 
              name="Results" 
              component={ResultsScreen}
              options={{ 
                headerShown: true,
                title: 'Analysis Results',
                headerStyle: { backgroundColor: '#667eea' },
                headerTintColor: '#fff'
              }}
            />
            <Stack.Screen 
              name="Goals" 
              component={GoalsScreen}
              options={{ 
                headerShown: true,
                title: 'Training Goals',
                headerStyle: { backgroundColor: '#667eea' },
                headerTintColor: '#fff'
              }}
            />
            <Stack.Screen 
              name="Stats" 
              component={StatsScreen}
              options={{ 
                headerShown: true,
                title: 'Quick Stats',
                headerStyle: { backgroundColor: '#667eea' },
                headerTintColor: '#fff'
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}