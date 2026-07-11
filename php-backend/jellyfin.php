<?php
/**
 * Jellyfin Service for PHP.
 * Handles API integration with the Jellyfin Media Server using cURL.
 */

class JellyfinService {
    private $config;

    public function __construct($config) {
        $this->config = $config;
    }

    private function getAuthHeaders($token = null) {
        $authVal = 'MediaBrowser Client="StreamingPortal", Device="BackendServer", DeviceId="portal-backend", Version="1.0.0"';
        $headers = [
            'Content-Type: application/json',
            'X-Emby-Authorization: ' . $authVal
        ];
        if ($token) {
            $headers[] = 'X-MediaBrowser-Token: ' . $token;
            $headers[] = 'X-Emby-Token: ' . $token;
        }
        return $headers;
    }

    private function request($endpoint, $method, $body = null, $useAdminToken = true) {
        $serverUrl = rtrim($this->config['serverUrl'], '/');
        $url = $serverUrl . $endpoint;

        $token = $useAdminToken ? $this->config['apiKey'] : null;
        $headers = $this->getAuthHeaders($token);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For cPanel servers connecting to SSL backends
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            error_log("Jellyfin cURL Error [{$method} {$endpoint}]: " . $err);
            throw new Exception("cURL Error: " . $err);
        }

        if ($httpCode >= 400) {
            error_log("Jellyfin Error Response ({$httpCode}) [{$method} {$endpoint}]: " . $response);
            throw new Exception("Jellyfin Error ({$httpCode}): " . ($response ?: "Unknown error"));
        }

        // Return parsed json if any
        $data = json_decode($response, true);
        return $data !== null ? $data : $response;
    }

    public function verifyConnection() {
        try {
            $this->request('/System/Info', 'GET', null, true);
            return true;
        } catch (Exception $e) {
            error_log("Jellyfin connection check failed: " . $e->getMessage());
            return false;
        }
    }

    public function authenticateUser($username, $password) {
        try {
            $payload = [
                'Username' => $username,
                'Pw' => $password,
                'Password' => $password
            ];

            $serverUrl = rtrim($this->config['serverUrl'], '/');
            $url = $serverUrl . '/Users/AuthenticateByName';
            
            $headers = $this->getAuthHeaders();

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);

            if ($err) {
                throw new Exception("cURL Error: " . $err);
            }

            if ($httpCode >= 400) {
                throw new Exception("Authentication failed ({$httpCode}): " . $response);
            }

            $result = json_decode($response, true);
            if (!isset($result['AccessToken']) || !isset($result['User']['Id'])) {
                throw new Exception("Jellyfin authentication returned incomplete session data");
            }

            return [
                'userId' => $result['User']['Id'],
                'accessToken' => $result['AccessToken']
            ];
        } catch (Exception $e) {
            error_log("Jellyfin auth failed for user {$username}: " . $e->getMessage());
            throw $e;
        }
    }

    public function createUser($username, $password) {
        try {
            $payload = [
                'Name' => $username,
                'Password' => $password
            ];

            $result = $this->request('/Users/New', 'POST', $payload, true);
            if (!isset($result['Id'])) {
                throw new Exception("Failed to create Jellyfin user: No ID returned");
            }

            $userId = $result['Id'];

            // Immediately grant permission to watch all movies, shows and folders
            try {
                $this->grantAllPermissions($userId);
            } catch (Exception $policyErr) {
                error_log("Could not set initial folder permissions for Jellyfin user {$userId}: " . $policyErr->getMessage());
            }

            return $userId;
        } catch (Exception $e) {
            error_log("Jellyfin user creation failed for {$username}: " . $e->getMessage());
            throw $e;
        }
    }

    public function grantAllPermissions($jellyfinUserId) {
        try {
            // 1. Fetch user details first
            $user = $this->request("/Users/{$jellyfinUserId}", 'GET', null, true);
            if (!isset($user['Policy'])) {
                throw new Exception("User policy not found");
            }

            // 2. Modify policy
            $updatedPolicy = array_merge($user['Policy'], [
                'EnableAllFolders' => true,
                'EnableAllDevices' => true,
                'EnableContentPlayback' => true,
                'EnableVideoPlaybackTranscoding' => true,
                'EnableAudioPlaybackTranscoding' => true,
                'EnablePlaybackRemuxing' => true
            ]);

            // 3. Post back
            $this->request("/Users/{$jellyfinUserId}/Policy", 'POST', $updatedPolicy, true);
            return true;
        } catch (Exception $e) {
            error_log("Failed to grant permissions for Jellyfin user {$jellyfinUserId}: " . $e->getMessage());
            return false;
        }
    }

    public function setUserDisabledStatus($jellyfinUserId, $isDisabled) {
        try {
            // 1. Fetch user details first
            $user = $this->request("/Users/{$jellyfinUserId}", 'GET', null, true);
            if (!isset($user['Policy'])) {
                throw new Exception("User policy not found");
            }

            // 2. Modify policy
            $updatedPolicy = array_merge($user['Policy'], [
                'IsDisabled' => (bool)$isDisabled,
                'EnableAllFolders' => true
            ]);

            // 3. Post back
            $this->request("/Users/{$jellyfinUserId}/Policy", 'POST', $updatedPolicy, true);
            return true;
        } catch (Exception $e) {
            error_log("Failed to set disabled status for Jellyfin user {$jellyfinUserId}: " . $e->getMessage());
            return false;
        }
    }

    public function updateUserPassword($jellyfinUserId, $newPassword) {
        try {
            $payload = [
                'NewPassword' => $newPassword,
                'ClearPassword' => false
            ];
            $this->request("/Users/{$jellyfinUserId}/Password", 'POST', $payload, true);
            return true;
        } catch (Exception $e) {
            error_log("Failed to change password for Jellyfin user {$jellyfinUserId}: " . $e->getMessage());
            return false;
        }
    }

    public function getJellyfinUsers() {
        try {
            return $this->request('/Users', 'GET', null, true);
        } catch (Exception $e) {
            error_log("Failed to retrieve Jellyfin users list: " . $e->getMessage());
            return [];
        }
    }

    public function getUserIdByName($username) {
        try {
            $users = $this->getJellyfinUsers();
            $cleanUsername = strtolower(trim($username));
            foreach ($users as $u) {
                if (isset($u['Name']) && strtolower($u['Name']) === $cleanUsername) {
                    return $u['Id'];
                }
            }
            return null;
        } catch (Exception $e) {
            error_log("Failed to find Jellyfin user by name {$username}: " . $e->getMessage());
            return null;
        }
    }
}
