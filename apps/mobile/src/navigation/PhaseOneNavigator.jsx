import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSession } from '../auth/SessionContext';
import {
  ChangePasswordScreen, EditProfileScreen, LoginScreen, ProfileScreen,
  RegisterScreen, ResetPasswordScreen, RoleHomeScreen, SessionGateScreen, VerifyEmailScreen,
} from '../screens/P01/SessionScreens';
import { Theme } from '../theme';
import { CustomerHome, FavoritesScreen, FoodScreen, MenuScreen, ShopScreen } from '../screens/P02/CatalogScreens';
import { CartScreen, CustomerAccountScreen } from '../screens/P02/CartScreens';
import { AddressFormScreen, AddressesScreen, HelpScreen, SettingsScreen } from '../screens/P02/AccountScreens';
import { CheckoutScreen } from '../screens/P03/CheckoutScreen';
import { OrderDetailScreen, OrderHistoryScreen, OrderSuccessScreen, ReviewScreen } from '../screens/P03/OrderScreens';
import { OperationsHome, OperationsShop, ShopReport, ShopSettings } from '../screens/P04/ShopScreens';
import { MerchantMenu, MenuItemEditor, StockEditor } from '../screens/P04/MenuScreens';
import { AssignDriver, MerchantOrderDetail, MerchantQueue, ShopDrivers } from '../screens/P04/QueueScreens';
import { AdminUser, AdminUsers, ApproveDriver } from '../screens/P04/AdminScreens';
import { NotificationInbox, OrderChatScreen } from '../screens/P05/ChatInboxScreens';
import { DriverOrderDetail, DriverTrips } from '../screens/P05/DriverTrips';
import { DeliveryTrackingScreen } from '../screens/P06/DeliveryTrackingScreen';
import { NotificationSettings, PushBridge } from '../screens/P05/PushScreens';
import { MenuAssistant } from '../screens/P07/MenuAssistant';
import { ReviewInsights } from '../screens/P07/ReviewInsights';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator();
const titles = { customer: 'Tài khoản khách hàng', merchant: 'Tài khoản nhà hàng', driver: 'Tài khoản tài xế', admin: 'Tài khoản quản trị' };

export function PhaseOneNavigator() {
  const session = useSession();
  if (session.phase === 'loading' || session.phase === 'locked' || session.phase === 'error') {
    return <SessionGateScreen />;
  }
  if (session.phase === 'needsVerification') { return <VerifyEmailScreen />; }
  const ready = session.phase === 'ready';
  const customer = ready && session.profile.role === 'customer';
  const admin = ready && session.profile.role === 'admin';
  const operator = admin || (ready && session.profile.role === 'merchant');
  const driver = ready && session.profile.role === 'driver';
  const Home = customer ? CustomerHome : operator ? OperationsHome : driver ? DriverTrips : RoleHomeScreen;
  const navKey = ready ? `${session.user.uid}:${session.profile.role}` : 'signed-out';
  return <><NavigationContainer ref={navigationRef}>
    <Stack.Navigator screenOptions={{ headerTintColor: Theme.colors.primary, headerShadowVisible: false,
      headerStyle: { backgroundColor: Theme.colors.background.light }, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Group navigationKey={navKey}>
      {ready ? <>
        <Stack.Screen name={`${session.profile.role}Home`} component={Home}
          options={{ title: customer ? 'FoodOrderNext' : titles[session.profile.role] }} />
        <Stack.Screen name="Profile" component={customer ? CustomerAccountScreen : ProfileScreen} options={{ title: 'Hồ sơ' }} />
        <Stack.Screen name="OrderChat" component={OrderChatScreen} options={{ title: 'Tin nhắn' }} />
        <Stack.Screen name="NotificationInbox" component={NotificationInbox} options={{ title: 'Thông báo' }} />
        <Stack.Screen name="NotificationSettings" component={NotificationSettings} options={{ title: 'Cài đặt thông báo' }} />
        {driver ? <Stack.Screen name="DriverOrderDetail" component={DriverOrderDetail} options={{ title: 'Chi tiết chuyến' }} /> : null}
        {customer ? <>
          <Stack.Screen name="Shop" component={ShopScreen} options={{ title: 'Thông tin quán' }} />
          <Stack.Screen name="ShopMenu" component={MenuScreen} options={{ title: 'Thực đơn' }} />
          <Stack.Screen name="MenuAssistant" component={MenuAssistant} options={{ title: 'Trợ lý chọn món' }} />
          <Stack.Screen name="Food" component={FoodScreen} options={{ title: 'Chi tiết món' }} />
          <Stack.Screen name="CustomerFavorites" component={FavoritesScreen} options={{ title: 'Yêu thích' }} />
          <Stack.Screen name="CustomerCart" component={CartScreen} options={{ title: 'Giỏ hàng' }} />
          <Stack.Screen name="CheckoutDraft" component={CheckoutScreen} options={{ title: 'Thanh toán COD' }} />
          <Stack.Screen name="CustomerOrderSuccess" component={OrderSuccessScreen} options={{ title: 'Đã gửi đơn' }} />
          <Stack.Screen name="CustomerOrderHistory" component={OrderHistoryScreen} options={{ title: 'Đơn hàng' }} />
          <Stack.Screen name="CustomerOrderDetail" component={OrderDetailScreen} options={{ title: 'Chi tiết đơn' }} />
          <Stack.Screen name="CustomerDeliveryTracking" component={DeliveryTrackingScreen} options={{ title: 'Vị trí giao hàng' }} />
          <Stack.Screen name="CustomerReview" component={ReviewScreen} options={{ title: 'Đánh giá' }} />
          <Stack.Screen name="CustomerAddresses" component={AddressesScreen} options={{ title: 'Sổ địa chỉ' }} />
          <Stack.Screen name="CustomerAddressForm" component={AddressFormScreen} options={{ title: 'Thông tin địa chỉ' }} />
          <Stack.Screen name="CustomerSettings" component={SettingsScreen} options={{ title: 'Cài đặt' }} />
          <Stack.Screen name="CustomerHelp" component={HelpScreen} options={{ title: 'Trợ giúp và thông tin' }} />
        </> : null}
        {operator ? <>
          <Stack.Screen name="OperationsShop" component={OperationsShop} options={{ title: 'Vận hành quán' }} />
          <Stack.Screen name="ShopSettings" component={ShopSettings} options={{ title: 'Cài đặt quán' }} />
          <Stack.Screen name="MerchantMenu" component={MerchantMenu} options={{ title: 'Thực đơn của quán' }} />
          <Stack.Screen name="MenuItemEditor" component={MenuItemEditor} options={{ title: 'Chỉnh sửa món' }} />
          <Stack.Screen name="StockEditor" component={StockEditor} options={{ title: 'Điều chỉnh tồn' }} />
          <Stack.Screen name="MerchantQueue" component={MerchantQueue} options={{ title: 'Hàng đợi đơn' }} />
          <Stack.Screen name="MerchantOrderDetail" component={MerchantOrderDetail} options={{ title: 'Xử lý đơn' }} />
          <Stack.Screen name="AssignDriver" component={AssignDriver} options={{ title: 'Phân công tài xế' }} />
          <Stack.Screen name="ShopDrivers" component={ShopDrivers} options={{ title: 'Tài xế của quán' }} />
          <Stack.Screen name="ShopReport" component={ShopReport} options={{ title: 'Báo cáo theo ngày' }} />
          <Stack.Screen name="ReviewInsights" component={ReviewInsights} options={{ title: 'Phân tích đánh giá' }} />
        </> : null}
        {admin ? <>
          <Stack.Screen name="AdminUsers" component={AdminUsers} options={{ title: 'Tài khoản' }} />
          <Stack.Screen name="AdminUser" component={AdminUser} options={{ title: 'Quyền tài khoản' }} />
          <Stack.Screen name="ApproveDriver" component={ApproveDriver} options={{ title: 'Duyệt tài xế' }} />
        </> : null}
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Chỉnh sửa hồ sơ' }} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Bảo mật' }} />
      </> : <>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Đăng ký' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Khôi phục mật khẩu' }} />
      </>}
      </Stack.Group>
    </Stack.Navigator>
  </NavigationContainer>
  {ready ? <PushBridge key={navKey} uid={session.user.uid}
    enabled={session.profile.settings?.notificationsEnabled !== false} /> : null}</>;
}
