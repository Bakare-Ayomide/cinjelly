import { JellyfinConfig } from './db.js';

// Generates the standard Authorization header required by Jellyfin
function getAuthHeader(token?: string) {
  const authVal = 'MediaBrowser Client="StreamingPortal", Device="BackendServer", DeviceId="portal-backend", Version="1.0.0"';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Emby-Authorization': authVal
  };
  if (token) {
    headers['X-MediaBrowser-Token'] = token;
    headers['X-Emby-Token'] = token;
  }
  return headers;
}

export class JellyfinService {
  private config: JellyfinConfig;

  constructor(config: JellyfinConfig) {
    this.config = config;
  }

  // Helper for requests
  private async request(endpoint: string, method: string, body?: any, useAdminToken = true) {
    const cleanUrl = this.config.serverUrl.replace(/\/$/, '');
    const url = `${cleanUrl}${endpoint}`;
    
    const token = useAdminToken ? this.config.apiKey : undefined;
    const headers = getAuthHeader(token);

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jellyfin Error (${response.status}): ${errorText || response.statusText}`);
      }

      // Check if response has content
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (error: any) {
      console.error(`Jellyfin API Request failed [${method} ${endpoint}]:`, error.message);
      throw error;
    }
  }

  // Verify the provided Jellyfin configuration is valid (tries to fetch admin users/info)
  async verifyConnection(): Promise<boolean> {
    try {
      // Try to get system info or users list using the API Key
      await this.request('/System/Info', 'GET', undefined, true);
      return true;
    } catch (err) {
      console.error('Jellyfin connection validation failed:', err);
      return false;
    }
  }

  // Authenticate user with Jellyfin and get their token
  async authenticateUser(username: string, password: string): Promise<{ userId: string; accessToken: string }> {
    try {
      // Jellyfin uses POST to /Users/AuthenticateByName
      // In Jellyfin, the payload can use either "Pw" or "Password". We provide both for max compatibility.
      const payload = {
        Username: username,
        Pw: password,
        Password: password
      };

      const cleanUrl = this.config.serverUrl.replace(/\/$/, '');
      const url = `${cleanUrl}/Users/AuthenticateByName`;
      
      // For authenticating users, we MUST set the user-specific authorization header
      const headers = getAuthHeader();

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Authentication failed (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      if (!result.AccessToken || !result.User || !result.User.Id) {
        throw new Error('Jellyfin authentication returned incomplete session data');
      }

      return {
        userId: result.User.Id,
        accessToken: result.AccessToken
      };
    } catch (err: any) {
      console.error(`Jellyfin auth failed for user ${username}:`, err.message);
      throw err;
    }
  }

  // Create a new user in Jellyfin
  async createUser(username: string, password: string): Promise<string> {
    try {
      const payload = {
        Name: username,
        Password: password
      };

      const result = await this.request('/Users/New', 'POST', payload, true);
      if (!result || !result.Id) {
        throw new Error('Failed to create Jellyfin user: No ID returned');
      }

      const userId = result.Id;

      // Immediately grant permission to watch all movies, shows and folders
      try {
        await this.grantAllPermissions(userId);
      } catch (policyErr: any) {
        console.warn(`Could not set initial folder permissions for Jellyfin user ${userId}:`, policyErr.message);
      }

      return userId;
    } catch (err: any) {
      console.error(`Jellyfin user creation failed for ${username}:`, err.message);
      throw err;
    }
  }

  // Grant full folder/library permissions (watch all movies and shows) and general capabilities
  async grantAllPermissions(jellyfinUserId: string): Promise<boolean> {
    try {
      // 1. Fetch user details first to get current policy
      const user = await this.request(`/Users/${jellyfinUserId}`, 'GET', undefined, true);
      if (!user || !user.Policy) {
        throw new Error('User policy not found');
      }

      // 2. Modify policy to grant full access to watch all folders/libraries
      const updatedPolicy = {
        ...user.Policy,
        EnableAllFolders: true,
        EnableAllDevices: true,
        EnableContentPlayback: true,
        EnableVideoPlaybackTranscoding: true,
        EnableAudioPlaybackTranscoding: true,
        EnablePlaybackRemuxing: true
      };

      // 3. Post back modified policy
      await this.request(`/Users/${jellyfinUserId}/Policy`, 'POST', updatedPolicy, true);
      console.log(`Successfully granted all library permissions to Jellyfin User ${jellyfinUserId}`);
      return true;
    } catch (err: any) {
      console.error(`Failed to grant permissions for Jellyfin user ${jellyfinUserId}:`, err.message);
      return false;
    }
  }

  // Enable or disable a Jellyfin user account by updating their Policy
  async setUserDisabledStatus(jellyfinUserId: string, isDisabled: boolean): Promise<boolean> {
    try {
      // 1. Fetch user details first to get current policy
      const user = await this.request(`/Users/${jellyfinUserId}`, 'GET', undefined, true);
      if (!user || !user.Policy) {
        throw new Error('User policy not found');
      }

      // 2. Modify policy
      const updatedPolicy = {
        ...user.Policy,
        IsDisabled: isDisabled,
        EnableAllFolders: true // Ensure they maintain access to watch all media
      };

      // 3. Post back modified policy
      await this.request(`/Users/${jellyfinUserId}/Policy`, 'POST', updatedPolicy, true);
      console.log(`Successfully updated Jellyfin User ${jellyfinUserId} disabled state to ${isDisabled}`);
      return true;
    } catch (err: any) {
      console.error(`Failed to set disabled status for Jellyfin user ${jellyfinUserId}:`, err.message);
      return false;
    }
  }

  // Update password for a Jellyfin user as Admin
  async updateUserPassword(jellyfinUserId: string, newPassword: string): Promise<boolean> {
    try {
      // Jellyfin has POST to /Users/{Id}/Password
      const payload = {
        NewPassword: newPassword,
        ClearPassword: false
      };
      await this.request(`/Users/${jellyfinUserId}/Password`, 'POST', payload, true);
      return true;
    } catch (err: any) {
      console.error(`Failed to change password for Jellyfin user ${jellyfinUserId}:`, err.message);
      return false;
    }
  }

  // Get users in Jellyfin (for debugging or sync)
  async getJellyfinUsers(): Promise<any[]> {
    try {
      return await this.request('/Users', 'GET', undefined, true);
    } catch (err) {
      console.error('Failed to retrieve Jellyfin users list:', err);
      return [];
    }
  }

  // Get user ID by username
  async getUserIdByName(username: string): Promise<string | null> {
    try {
      const users = await this.getJellyfinUsers();
      const cleanUsername = username.toLowerCase().trim();
      const match = users.find((u: any) => u.Name && u.Name.toLowerCase() === cleanUsername);
      return match ? match.Id : null;
    } catch (err) {
      console.error(`Failed to find Jellyfin user by name ${username}:`, err);
      return null;
    }
  }

  // Delete user from Jellyfin
  async deleteUser(jellyfinUserId: string): Promise<boolean> {
    try {
      await this.request(`/Users/${jellyfinUserId}`, 'DELETE', undefined, true);
      console.log(`Successfully deleted Jellyfin User ${jellyfinUserId}`);
      return true;
    } catch (err: any) {
      console.error(`Failed to delete Jellyfin user ${jellyfinUserId}:`, err.message);
      return false;
    }
  }
}
