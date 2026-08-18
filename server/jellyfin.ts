import { JellyfinConfig } from './db.js';

// Generates the standard Authorization header required by Jellyfin
function getAuthHeader(token?: string, username = '') {
  let authParams = `Client="StreamingPortal", Device="Web", DeviceId="portal-${username ? Buffer.from(username).toString('hex').slice(0, 16) : 'backend'}", Version="10.8.0"`;
  if (token) {
    authParams += `, Token="${token}"`;
  }
  const authVal = `MediaBrowser ${authParams}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Emby-Authorization': authVal,
    'Authorization': authVal
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
  private async request(endpoint: string, method: string, body?: any, useAdminToken = true, timeoutMs = 12000) {
    const cleanUrl = this.config.serverUrl.replace(/\/$/, '');
    let url = `${cleanUrl}${endpoint}`;
    
    const token = useAdminToken ? this.config.apiKey : undefined;
    const headers = getAuthHeader(token);

    if (useAdminToken && token) {
      const sep = url.includes('?') ? '&' : '?';
      url += `${sep}api_key=${encodeURIComponent(token)}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const options: RequestInit = {
      method,
      headers,
      signal: controller.signal
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Jellyfin Error (${response.status}): ${errorText || response.statusText}`);
      }

      // Check if response has content
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (error: any) {
      const isAbort = error.name === 'AbortError' || error.message?.includes('aborted');
      const errorMsg = isAbort ? `Request timed out after ${timeoutMs / 1000}s` : error.message;
      console.log(`[JellyfinService] Request Notice [${method} ${endpoint}]: ${errorMsg}`);
      throw new Error(errorMsg);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Verify the provided Jellyfin configuration is valid (tries to fetch admin users/info)
  async verifyConnection(): Promise<boolean> {
    const cleanUrl = this.config.serverUrl ? this.config.serverUrl.replace(/\/$/, '') : '';
    if (!cleanUrl) return false;

    // 1. Primary check: /System/Info with admin API key
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for snappy check
      const url = `${cleanUrl}/System/Info`;
      const token = this.config.apiKey;
      const headers = getAuthHeader(token);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      if (response.ok) {
        return true;
      }
    } catch (err: any) {
      // Gracefully continue to public endpoint fallback
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    // 2. Secondary fallback check: /System/Info/Public (unauthenticated server ping)
    let timeoutIdPublic: NodeJS.Timeout | null = null;
    try {
      const controllerPublic = new AbortController();
      timeoutIdPublic = setTimeout(() => controllerPublic.abort(), 6000); // 6s timeout
      const publicUrl = `${cleanUrl}/System/Info/Public`;
      
      const publicResponse = await fetch(publicUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controllerPublic.signal
      });
      if (publicResponse.ok) {
        return true;
      }
    } catch (publicErr: any) {
      // Jellyfin server not reachable
    } finally {
      if (timeoutIdPublic) clearTimeout(timeoutIdPublic);
    }

    return false;
  }

  // Authenticate user with Jellyfin and get their token
  async authenticateUser(username: string, password: string): Promise<{ userId: string; accessToken: string }> {
    let timeoutId: NodeJS.Timeout | null = null;
    const cleanUsername = username.trim();
    try {
      const payload = {
        Username: cleanUsername,
        Pw: password,
        Password: password
      };

      const cleanUrl = this.config.serverUrl.replace(/\/$/, '');
      const url = `${cleanUrl}/Users/AuthenticateByName`;
      const headers = getAuthHeader(undefined, cleanUsername);

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        // Auto-heal fallback 1: Check if Jellyfin user was created with empty password
        try {
          const emptyRes = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ Username: cleanUsername, Pw: '', Password: '' }),
            signal: controller.signal
          });
          if (emptyRes.ok) {
            const emptyData = await emptyRes.json();
            if (emptyData?.AccessToken && emptyData?.User?.Id) {
              if (password) {
                await this.updateUserPassword(emptyData.User.Id, password);
              }
              return {
                userId: emptyData.User.Id,
                accessToken: emptyData.AccessToken
              };
            }
          }
        } catch (e) {
          // Ignore fallback error
        }

        // Auto-heal fallback 2: Admin password reset and enable account
        const existingUserId = await this.getUserIdByName(cleanUsername);
        if (existingUserId && password) {
          await this.setUserDisabledStatus(existingUserId, false);
          await this.updateUserPassword(existingUserId, password);

          const retryRes = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            if (retryData?.AccessToken && retryData?.User?.Id) {
              return {
                userId: retryData.User.Id,
                accessToken: retryData.AccessToken
              };
            }
          }
        }

        const errorText = await response.text().catch(() => '');
        throw new Error(`Authentication failed (${response.status}): ${errorText || response.statusText}`);
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
      const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
      const errorMsg = isAbort ? 'Jellyfin server authentication timed out' : (err.message || 'Authentication error');
      console.log(`[JellyfinService] Auth notice for ${username}: ${errorMsg}`);
      throw new Error(errorMsg);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  // Create a new user in Jellyfin
  async createUser(username: string, password: string): Promise<string> {
    try {
      const cleanUsername = username.trim();
      const payload = {
        Name: cleanUsername
      };

      const result = await this.request('/Users/New', 'POST', payload, true);
      if (!result || !result.Id) {
        throw new Error('Failed to create Jellyfin user: No ID returned');
      }

      const userId = result.Id;

      // Immediately set user password
      if (password) {
        try {
          await this.updateUserPassword(userId, password);
        } catch (pwErr: any) {
          console.warn(`Could not set initial password for Jellyfin user ${userId}:`, pwErr.message);
        }
      }

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

  // Update password for a Jellyfin user
  async updateUserPassword(jellyfinUserId: string, newPassword: string, username = ''): Promise<boolean> {
    if (!jellyfinUserId || newPassword === undefined || newPassword === null || newPassword === '') {
      return false;
    }

    if (!username) {
      try {
        const userObj = await this.request(`/Users/${jellyfinUserId}`, 'GET', undefined, true);
        if (userObj?.Name) {
          username = userObj.Name;
        }
      } catch (err) {
        // Ignore
      }
    }

    // Method 1: If user currently has an empty password, self-authenticate and update
    if (username) {
      try {
        const authRes = await this.authenticateUser(username, '');
        if (authRes?.accessToken) {
          const selfHeaders = getAuthHeader(authRes.accessToken, username);
          const cleanUrl = this.config.serverUrl.replace(/\/$/, '');
          const pwPayload = {
            Id: jellyfinUserId,
            CurrentPw: '',
            CurrentPassword: '',
            NewPw: newPassword,
            NewPassword: newPassword,
            ResetPassword: false,
            ClearPassword: false
          };
          const resp = await fetch(`${cleanUrl}/Users/${jellyfinUserId}/Password`, {
            method: 'POST',
            headers: selfHeaders,
            body: JSON.stringify(pwPayload)
          });
          if (resp.ok) {
            return true;
          }
        }
      } catch (err) {
        // Continue to method 2
      }
    }

    // Method 2: Admin API token reset
    try {
      const payload = {
        Id: jellyfinUserId,
        CurrentPw: '',
        CurrentPassword: '',
        NewPw: newPassword,
        NewPassword: newPassword,
        ResetPassword: true,
        ClearPassword: false
      };
      try {
        await this.request(`/Users/${jellyfinUserId}/Password`, 'POST', payload, true);
        return true;
      } catch (err1) {
        await this.request(`/Users/Password?userId=${encodeURIComponent(jellyfinUserId)}`, 'POST', payload, true);
        return true;
      }
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
