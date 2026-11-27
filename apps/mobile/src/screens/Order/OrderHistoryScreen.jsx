import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Theme } from '../../theme';
import { OrderService } from '../../services/OrderService';
import {
  LoadingOverlay,
  SearchBar,
  CategoryChip,
  StatusBadge,
  PriceTag,
  PrimaryButton,
} from '../../common';

// ─── Constants ────────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Ongoing', 'Completed', 'Cancelled'];

const getStatusColorName = (status) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'error';
    case 'ongoing':
      return 'warning';
    default:
      return 'info';
  }
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrderHistoryScreen({ route, navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (route.params?.filter) {
      setSelectedFilter(route.params.filter);
      // Optional: clear the param so it doesn't get stuck if user navigates back differently
      navigation.setParams({ filter: undefined });
    }
  }, [route.params?.filter]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadOrders);
    return unsubscribe;
  }, [navigation]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await OrderService.getOrders();
      setOrders(data || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Local filtering based on search query and selected filter
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status match
      const matchesFilter =
        selectedFilter === 'All' ||
        order.status.toLowerCase() === selectedFilter.toLowerCase();

      // Search query match (search by order ID or restaurant name)
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        order.id.toLowerCase().includes(query) ||
        (order.restaurantName && order.restaurantName.toLowerCase().includes(query));

      return matchesFilter && matchesSearch;
    });
  }, [orders, searchQuery, selectedFilter]);

  // ─── Renderers ──────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Premium Page Title */}
      <View style={styles.heroHeader}>
        <Text style={styles.heroTitle}>Order History</Text>
        <Text style={styles.heroSubtitle}>View all your previous orders</Text>
      </View>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search orders or restaurants..."
        style={styles.searchBar}
      />

      {/* Filter Chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterChips}
        renderItem={({ item }) => (
          <CategoryChip
            label={item}
            isActive={selectedFilter === item}
            onPress={() => setSelectedFilter(item)}
          />
        )}
      />
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyOuterCircle}>
        <View style={styles.emptyInnerCircle}>
          <Icon name="receipt-outline" size={60} color={Theme.colors.primary} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>No Orders Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || selectedFilter !== 'All'
          ? "We couldn't find any orders matching your criteria."
          : "You haven't placed any orders yet. Let's fix that!"}
      </Text>
      {(!searchQuery && selectedFilter === 'All') && (
        <PrimaryButton
          title="Browse Foods"
          onPress={() => navigation.navigate('HomeStack')}
          style={styles.browseBtn}
        />
      )}
    </View>
  );

  const renderOrderItem = ({ item }) => {
    const itemCount = item.orderDetails?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;

    return (
      <View style={styles.card}>
        {/* Card Header: Restaurant Info + Status */}
        <View style={styles.cardHeader}>
          <View style={styles.thumbnailWrapper}>
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {item.restaurantName || 'Restaurant Name'}
            </Text>
            <Text style={styles.orderId}>Order #{item.id}</Text>
          </View>
          <StatusBadge
            status={getStatusColorName(item.status)}
            label={item.status}
          />
        </View>

        {/* Order Details Row */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Icon name="calendar-outline" size={14} color={Theme.colors.text.secondary} />
            <Text style={styles.detailText}>
              {new Date(item.orderDate).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Icon name="fast-food-outline" size={14} color={Theme.colors.text.secondary} />
            <Text style={styles.detailText}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <PriceTag price={item.totalPrice} />
        </View>

        {/* View Details CTA */}
        <TouchableOpacity
          style={styles.viewDetailsBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
        >
          <Text style={styles.viewDetailsBtnText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 0) }]}>
      {loading ? (
        <LoadingOverlay isVisible={true} message="Loading orders..." />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, Theme.spacing.l) + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          renderItem={renderOrderItem}
          ItemSeparatorComponent={() => <View style={{ height: Theme.spacing.xl }} />}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.light,
  },
  listContent: {
    paddingHorizontal: Theme.spacing.l,
    flexGrow: 1,
  },

  // Hero Header
  heroHeader: {
    marginTop: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  heroTitle: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
  },

  headerContainer: {
    marginBottom: Theme.spacing.l,
  },
  searchBar: {
    marginBottom: Theme.spacing.l,
  },
  filterChips: {
    paddingVertical: Theme.spacing.xs,
    gap: Theme.spacing.s,
    paddingBottom: Theme.spacing.m,
  },

  // Premium Order Card — medium shadow for clear hierarchy above search/chips
  card: {
    backgroundColor: Theme.colors.surface.light,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.xl,
    ...Theme.shadows.medium,
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.l,
  },
  thumbnailWrapper: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: Theme.colors.surface.light,
    marginRight: Theme.spacing.m,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.light,
  },
  thumbnail: {
    width: 96,
    height: 96,
    borderRadius: 20,
  },
  headerMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  restaurantName: {
    ...Theme.typography.h2,
    fontWeight: '700',
    color: Theme.colors.text.primaryLight,
    marginBottom: 4,
  },
  orderId: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
  },

  // Details Row
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.l,
    gap: Theme.spacing.m,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    ...Theme.typography.caption,
    color: Theme.colors.text.secondary,
    fontWeight: '500',
  },

  // View Details CTA — medium shadow, consistent with card hierarchy
  viewDetailsBtn: {
    height: 56,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  viewDetailsBtnText: {
    ...Theme.typography.button,
    color: Theme.colors.surface.light,
    fontWeight: '700',

  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Theme.spacing.xxxl,
  },
  emptyOuterCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Theme.colors.primary + '08',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  emptyInnerCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    ...Theme.typography.h1,
    color: Theme.colors.text.primaryLight,
    fontWeight: '800',
    marginBottom: Theme.spacing.m,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Theme.typography.body1,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.xl,
    lineHeight: 24,
  },
  browseBtn: {
    height: 56,
    borderRadius: Theme.radius.pill,
    minWidth: 200,
    justifyContent: 'center',
  },
});
