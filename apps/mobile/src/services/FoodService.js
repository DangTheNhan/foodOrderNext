import axiosClient from '../api/axiosClient';

export const FoodService = {
  getCategories: async () => {
    const response = await axiosClient.get('/categories');
    return response.data;
  },

  getPopularFoods: async () => {
    const response = await axiosClient.get('/foods?type=popular');
    return response.data; 
  },

  getRecommendedFoods: async () => {
    const response = await axiosClient.get('/foods?type=recommended');
    return response.data;
  },

  getFlashSaleFoods: async () => {
    const response = await axiosClient.get('/foods?type=flash_sale');
    return response.data;
  },

  getNearbyRestaurants: async () => {
    const response = await axiosClient.get('/restaurants');
    return response.data;
  },

  searchFoods: async (query, filters) => {
    let url = `/foods?search=${query || ''}`;
    if (filters?.category && filters.category !== 'all') {
      url += `&category=${filters.category}`;
    }
    const response = await axiosClient.get(url);
    return response.data;
  },

  getFoodById: async (id) => {
    const response = await axiosClient.get(`/foods/${id}`);
    return response.data;
  }
};
