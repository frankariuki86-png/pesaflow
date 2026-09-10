import "react-native-url-polyfill/auto";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import HomeScreen from "./src/screens/HomeScreen";
import GoalsScreen from "./src/screens/GoalsScreen";
import MoneyScreen from "./src/screens/MoneyScreen";
import ChamaScreen from "./src/screens/ChamaScreen";
import BusinessScreen from "./src/screens/BusinessScreen";
import ReportsScreen from "./src/screens/ReportsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import LoginScreen from "./src/screens/LoginScreen";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { supabaseConfigError } from "./src/services/supabase";
import { ActivityIndicator, Text, View } from "react-native";

const Tab = createBottomTabNavigator();

type ErrorBoundaryState = { error: Error | null };

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PesaFlow mobile render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#FEF2F2" }}>
          <Text style={{ color: "#991B1B", fontSize: 22, fontWeight: "700" }}>PesaFlow could not open</Text>
          <Text style={{ color: "#7F1D1D", marginTop: 12 }}>{this.state.error.message}</Text>
          <Text style={{ color: "#7F1D1D", marginTop: 12 }}>Restart Expo with: npx expo start --clear</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

function AuthenticatedApp() {
  const { session, loading } = useAuth();

  if (supabaseConfigError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#FEF2F2" }}>
        <Text style={{ color: "#991B1B", fontSize: 22, fontWeight: "700" }}>PesaFlow configuration error</Text>
        <Text style={{ color: "#7F1D1D", marginTop: 12 }}>{supabaseConfigError}</Text>
        <Text style={{ color: "#7F1D1D", marginTop: 12 }}>Stop Expo, then restart it from packages/mobile with: npx expo start --clear</Text>
      </View>
    );
  }

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color="#10B981" /><Text>Loading PesaFlow...</Text></View>;
  }

  if (!session) return <LoginScreen />;

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: "#10B981", tabBarStyle: { height: 70, paddingBottom: 10, paddingTop: 8 } }}>
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard" color={color} size={size} /> }} />
        <Tab.Screen name="Goals" component={GoalsScreen} options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="target" color={color} size={size} /> }} />
        <Tab.Screen name="Money" component={MoneyScreen} options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="currency-usd" color={color} size={size} /> }} />
        <Tab.Screen name="Chama" component={ChamaScreen} options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-group" color={color} size={size} /> }} />
        <Tab.Screen name="Business" component={BusinessScreen} options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="briefcase" color={color} size={size} /> }} />
        <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="file-chart" color={color} size={size} /> }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle" color={color} size={size} /> }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return <ErrorBoundary><AuthProvider><AuthenticatedApp /></AuthProvider></ErrorBoundary>;
}
