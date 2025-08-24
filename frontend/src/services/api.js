const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.authToken = null;
  }

  setAuthToken(token) {
    this.authToken = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (this.authToken) {
      config.headers.Authorization = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication endpoints
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async checkEmailAvailability(email) {
    return this.request(`/auth/check-email/${encodeURIComponent(email)}`);
  }

  async verifyToken() {
    return this.request('/auth/verify');
  }

  async refreshToken() {
    return this.request('/auth/refresh', {
      method: 'POST',
    });
  }

  // User endpoints
  async getProfile() {
    return this.request('/users/profile');
  }

  async updateProfile(userData) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async getUsers() {
    return this.request('/users');
  }

  // Truck endpoints
  async getTrucks() {
    return this.request('/trucks');
  }

  async createTruck(truckData) {
    return this.request('/trucks', {
      method: 'POST',
      body: JSON.stringify(truckData),
    });
  }

  async updateTruck(truckId, truckData) {
    return this.request(`/trucks/${truckId}`, {
      method: 'PUT',
      body: JSON.stringify(truckData),
    });
  }

  async deleteTruck(truckId) {
    return this.request(`/trucks/${truckId}`, {
      method: 'DELETE',
    });
  }

  async updateTruckLocation(truckId, location) {
    return this.request(`/trucks/${truckId}/location`, {
      method: 'PUT',
      body: JSON.stringify(location),
    });
  }

  async uploadTruckDocuments(truckId, formData) {
    return this.request(`/trucks/${truckId}/documents`, {
      method: 'POST',
      headers: {
        // Don't set Content-Type for FormData, let browser set it
      },
      body: formData,
    });
  }

  // Message endpoints
  async getMessages(userId) {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request(`/messages${query}`);
  }

  async sendMessage(messageData) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  async markMessageAsRead(messageId) {
    return this.request(`/messages/read/${messageId}`, {
      method: 'PUT',
    });
  }

  async getConversations() {
    return this.request('/messages/conversations');
  }

  // Branch endpoints
  async getBranches() {
    return this.request('/branches');
  }

  async createBranch(branchData) {
    return this.request('/branches', {
      method: 'POST',
      body: JSON.stringify(branchData),
    });
  }

  async updateBranch(branchId, branchData) {
    return this.request(`/branches/${branchId}`, {
      method: 'PUT',
      body: JSON.stringify(branchData),
    });
  }

  async addBranchStaff(branchId, staffData) {
    return this.request(`/branches/${branchId}/staff`, {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
  }

  async getNearbyBranches(latitude, longitude, maxDistance = 50) {
    return this.request(`/branches/nearby/${latitude}/${longitude}?maxDistance=${maxDistance}`);
  }

  // Booking endpoints
  async getBookings() {
    return this.request('/bookings');
  }

  async createBooking(bookingData) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  async updateBookingStatus(bookingId, status, notes = '') {
    return this.request(`/bookings/${bookingId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  }

  async assignBooking(bookingId, truckId, driverId) {
    return this.request(`/bookings/${bookingId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ truck: truckId, driver: driverId }),
    });
  }

  async getAvailableTrucks(startDate, endDate, serviceType) {
    const params = new URLSearchParams({
      startDate,
      endDate,
      ...(serviceType && { serviceType }),
    });
    return this.request(`/bookings/available-trucks?${params}`);
  }

  async rateBooking(bookingId, score, feedback) {
    return this.request(`/bookings/${bookingId}/rating`, {
      method: 'POST',
      body: JSON.stringify({ score, feedback }),
    });
  }

  // Dashboard endpoints
  async getDashboardOverview(period = 30) {
    return this.request(`/dashboard/overview?period=${period}`);
  }

  async getFleetMapData() {
    return this.request('/dashboard/fleet-map');
  }

  async getDashboardNotifications() {
    return this.request('/dashboard/notifications');
  }

  async getPerformanceMetrics(period = 30) {
    return this.request(`/dashboard/performance?period=${period}`);
  }

  // Analytics endpoints
  async getAnalytics(period = 30) {
    return this.request(`/analytics/dashboard?period=${period}`);
  }

  async getFleetAnalytics() {
    return this.request('/analytics/fleet');
  }

  async getRevenueAnalytics(period = 30, groupBy = 'day') {
    return this.request(`/analytics/revenue?period=${period}&groupBy=${groupBy}`);
  }

  // Pickup endpoints (for backward compatibility)
  async getPickups() {
    return this.request('/pickups');
  }

  async createPickup(pickupData) {
    return this.request('/pickups', {
      method: 'POST',
      body: JSON.stringify(pickupData),
    });
  }

  async updatePickupStatus(pickupId, status) {
    return this.request(`/pickups/${pickupId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async assignPickup(pickupId, truckId) {
    return this.request(`/pickups/${pickupId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ truckId }),
    });
  }

  // Service endpoints
  async getServices() {
    return this.request('/services');
  }

  async createService(serviceData) {
    return this.request('/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  }

  // File upload helper
  async uploadFile(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    return this.request(endpoint, {
      method: 'POST',
      headers: {
        // Remove Content-Type to let browser set it for FormData
        Authorization: this.authToken ? `Bearer ${this.authToken}` : undefined,
      },
      body: formData,
    });
  }

  // Real-time location updates
  async subscribeToLocationUpdates(callback) {
    // This would typically use WebSocket or SSE
    // For now, we'll use polling
    const pollInterval = setInterval(async () => {
      try {
        const data = await this.getFleetMapData();
        callback(data);
      } catch (error) {
        console.error('Location update failed:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }
}

export const apiService = new ApiService();
export default apiService;