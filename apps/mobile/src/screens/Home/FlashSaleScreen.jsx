import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { FoodService } from '../../services/FoodService';
import { FoodCard } from '../../common/organisms/FoodCard';

export default function FlashSaleScreen({ navigation }) {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(2 * 3600 + 15 * 60 + 30); // 2:15:30

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchFoods = async () => {
      try {
        const data = await FoodService.getFlashSaleFoods();
        setFoods(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchFoods();
  }, []);

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleFoodPress = (id) => { navigation.navigate('FoodDetail', { foodId: id }); };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Icon name="arrow-back" size={24} color={Theme.colors.text.primaryLight} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Flash Sale</Text>
          <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>
      <FlatList 
        data={foods} 
        keyExtractor={(item) => item.id} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.listContent} 
        renderItem={({ item }) => <FoodCard {...item} onPress={handleFoodPress} />} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.background.light },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Theme.spacing.l, paddingVertical: Theme.spacing.m },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Theme.colors.surface.light, justifyContent: 'center', alignItems: 'center', ...Theme.shadows.light },
  headerTitle: { ...Theme.typography.h2, color: Theme.colors.text.primaryLight, fontWeight: '700' },
  timerText: { ...Theme.typography.body2, color: Theme.colors.feedback.error, fontWeight: '800', marginTop: 4 },
  listContent: { paddingHorizontal: Theme.spacing.l, paddingBottom: Theme.spacing.xxxl, paddingTop: Theme.spacing.s },
});
