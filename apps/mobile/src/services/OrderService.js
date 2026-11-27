import axiosClient from '../api/axiosClient';

export const OrderService = {
  getOrders: async () => {
    const response = await axiosClient.get('/orders');
    return response.data;
  },
  
  getOrderById: async (id) => {
    const response = await axiosClient.get(`/orders/${id}`);
    return response.data;
  },
  
  createOrder: async (orderData) => {
    const response = await axiosClient.post('/orders', orderData);
    return response.data;
  },

  updateOrderStatus: async (id, status) => {
    const response = await axiosClient.put(`/orders/${id}/status`, { status });
    return response.data;
  },

  deleteOrder: async (id) => {
    const response = await axiosClient.delete(`/orders/${id}`);
    return response.data;
  }
};
