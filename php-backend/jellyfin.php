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
        $authParams = 'Client="StreamingPortal", Device="Web", DeviceId="portal-backend", Version="10.8.0"';
        if (!empty($token)) {
            $authParams .= ', Token="' . $token . '"';
        }
        $authVal = 'MediaBrowser ' . $authParams;
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'X-Emby-Authorization: ' . $authVal,
            'Authorization: ' . $authVal
        ];
        if (!empty($token)) {
            $headers[] = 'X-MediaBrowser-Token: ' . $token;
            $headers[] = 'X-Emby-Token: ' . $token;
        }
        return $headers;
    }

    private function request($endpoint, $method, $body = null, $useAdminToken = true) {
        $serverUrl = rtrim($this->config['serverUrl'], '/');
        $url = $serverUrl . $endpoint;

        $token = $useAdminToken ? ($this->config['apiKey'] ?? '') : null;
        $headers = $this->getAuthHeaders($token);

        if ($useAdminToken && !empty($token)) {
            $separator = (strpos($url, '?') !== false) ? '&' : '?';
            $url .= $separator . 'api_key=' . urlencode($token);
        }

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
            try {
                $this->request('/System/Info/Public', 'GET', null, false);
                return true;
            } catch (Exception $ex) {
                error_log("Jellyfin connection check failed on all endpoints: " . $e->getMessage() . " | " . $ex->getMessage());
                return false;
            }
        }
    }

    public function authenticateUser($username, $password) {
        try {
            $usernameClean = trim($username);
            $payload = [
                'Username' => $usernameClean,
                'Pw' => $password,
                'Password' => $password
            ];

            $serverUrl = rtrim($this->config['serverUrl'], '/');
            $url = $serverUrl . '/Users/AuthenticateByName';
            
            $headers = [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-Emby-Authorization: MediaBrowser Client="StreamingPortal", Device="Web", DeviceId="portal-session-' . md5($usernameClean) . '", Version="10.8.0"',
                'Authorization: MediaBrowser Client="StreamingPortal", Device="Web", DeviceId="portal-session-' . md5($usernameClean) . '", Version="10.8.0"'
            ];

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
                // If 401 error, try auto-healing fallback:
                // 1. Try empty password (in case user was created with empty password)
                $emptyPayload = ['Username' => $usernameClean, 'Pw' => '', 'Password' => ''];
                $ch2 = curl_init();
                curl_setopt($ch2, CURLOPT_URL, $url);
                curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch2, CURLOPT_POST, true);
                curl_setopt($ch2, CURLOPT_HTTPHEADER, $headers);
                curl_setopt($ch2, CURLOPT_POSTFIELDS, json_encode($emptyPayload));
                curl_setopt($ch2, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);
                curl_setopt($ch2, CURLOPT_SSL_VERIFYHOST, false);
                $res2 = curl_exec($ch2);
                $code2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
                curl_close($ch2);

                if ($code2 < 400 && $res2) {
                    $parsed2 = json_decode($res2, true);
                    if (!empty($parsed2['AccessToken']) && !empty($parsed2['User']['Id'])) {
                        // Empty password succeeded - immediately set their permanent password!
                        if (!empty($password)) {
                            $this->updateUserPassword($parsed2['User']['Id'], $password);
                        }
                        return [
                            'userId' => $parsed2['User']['Id'],
                            'accessToken' => $parsed2['AccessToken']
                        ];
                    }
                }

                // 2. Try looking up user ID, resetting password via admin token, and re-attempting authentication
                $existingUserId = $this->getUserIdByName($usernameClean);
                if ($existingUserId && !empty($password)) {
                    $this->setUserDisabledStatus($existingUserId, false);
                    $this->updateUserPassword($existingUserId, $password);

                    $ch3 = curl_init();
                    curl_setopt($ch3, CURLOPT_URL, $url);
                    curl_setopt($ch3, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch3, CURLOPT_POST, true);
                    curl_setopt($ch3, CURLOPT_HTTPHEADER, $headers);
                    curl_setopt($ch3, CURLOPT_POSTFIELDS, json_encode($payload));
                    curl_setopt($ch3, CURLOPT_TIMEOUT, 10);
                    curl_setopt($ch3, CURLOPT_SSL_VERIFYPEER, false);
                    curl_setopt($ch3, CURLOPT_SSL_VERIFYHOST, false);
                    $res3 = curl_exec($ch3);
                    $code3 = curl_getinfo($ch3, CURLINFO_HTTP_CODE);
                    curl_close($ch3);

                    if ($code3 < 400 && $res3) {
                        $parsed3 = json_decode($res3, true);
                        if (!empty($parsed3['AccessToken']) && !empty($parsed3['User']['Id'])) {
                            return [
                                'userId' => $parsed3['User']['Id'],
                                'accessToken' => $parsed3['AccessToken']
                            ];
                        }
                    }
                }

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
            // Notice level log so non-active/disabled accounts don't trigger fatal error alerts
            error_log("Jellyfin auth notice for user {$username}: " . $e->getMessage());
            throw $e;
        }
    }

    public function createUser($username, $password) {
        try {
            $usernameClean = trim($username);
            $payload = [
                'Name' => $usernameClean
            ];

            $result = $this->request('/Users/New', 'POST', $payload, true);
            if (!isset($result['Id'])) {
                throw new Exception("Failed to create Jellyfin user: No ID returned");
            }

            $userId = $result['Id'];

            // Immediately set password for the newly created Jellyfin user
            if (!empty($password)) {
                try {
                    $this->updateUserPassword($userId, $password, $usernameClean);
                } catch (Exception $pwErr) {
                    error_log("Could not set initial password for Jellyfin user {$userId}: " . $pwErr->getMessage());
                }
            }

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

    public function updateUserPassword($jellyfinUserId, $newPassword, $username = '') {
        if (empty($jellyfinUserId) || $newPassword === null || $newPassword === '') {
            return false;
        }

        // If username not provided, try to find it from user list or fetch
        if (empty($username)) {
            try {
                $userObj = $this->request("/Users/{$jellyfinUserId}", 'GET', null, true);
                if (!empty($userObj['Name'])) {
                    $username = $userObj['Name'];
                }
            } catch (Exception $e) {
                // Ignore
            }
        }

        $serverUrl = rtrim($this->config['serverUrl'], '/');

        // Method 1: If user currently has an empty password (e.g. freshly created or reset),
        // authenticate with empty password and use the user's own token to set the new password.
        // This completely bypasses Jellyfin 10.8's admin API key UpdateUserPassword NullReference bug!
        if (!empty($username)) {
            try {
                $authUrl = $serverUrl . '/Users/AuthenticateByName';
                $emptyPayload = ['Username' => trim($username), 'Pw' => '', 'Password' => ''];
                $authHeaders = [
                    'Content-Type: application/json',
                    'Accept: application/json',
                    'X-Emby-Authorization: MediaBrowser Client="StreamingPortal", Device="Web", DeviceId="portal-self-' . md5(trim($username)) . '", Version="10.8.0"',
                    'Authorization: MediaBrowser Client="StreamingPortal", Device="Web", DeviceId="portal-self-' . md5(trim($username)) . '", Version="10.8.0"'
                ];

                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, $authUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, $authHeaders);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($emptyPayload));
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
                $res = curl_exec($ch);
                $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($code < 400 && $res) {
                    $data = json_decode($res, true);
                    if (!empty($data['AccessToken'])) {
                        $userToken = $data['AccessToken'];
                        // Use user's own token to update password
                        $selfHeaders = [
                            'Content-Type: application/json',
                            'Accept: application/json',
                            'X-Emby-Authorization: MediaBrowser Client="StreamingPortal", Device="Web", DeviceId="portal-self-' . md5(trim($username)) . '", Version="10.8.0", Token="' . $userToken . '"',
                            'Authorization: MediaBrowser Client="StreamingPortal", Device="Web", DeviceId="portal-self-' . md5(trim($username)) . '", Version="10.8.0", Token="' . $userToken . '"',
                            'X-MediaBrowser-Token: ' . $userToken,
                            'X-Emby-Token: ' . $userToken
                        ];

                        $pwPayload = [
                            'Id' => $jellyfinUserId,
                            'CurrentPw' => '',
                            'CurrentPassword' => '',
                            'NewPw' => $newPassword,
                            'NewPassword' => $newPassword,
                            'ResetPassword' => false,
                            'ClearPassword' => false
                        ];

                        $chPw = curl_init();
                        curl_setopt($chPw, CURLOPT_URL, $serverUrl . "/Users/{$jellyfinUserId}/Password");
                        curl_setopt($chPw, CURLOPT_RETURNTRANSFER, true);
                        curl_setopt($chPw, CURLOPT_POST, true);
                        curl_setopt($chPw, CURLOPT_HTTPHEADER, $selfHeaders);
                        curl_setopt($chPw, CURLOPT_POSTFIELDS, json_encode($pwPayload));
                        curl_setopt($chPw, CURLOPT_TIMEOUT, 10);
                        curl_setopt($chPw, CURLOPT_SSL_VERIFYPEER, false);
                        curl_setopt($chPw, CURLOPT_SSL_VERIFYHOST, false);
                        $resPw = curl_exec($chPw);
                        $codePw = curl_getinfo($chPw, CURLINFO_HTTP_CODE);
                        curl_close($chPw);

                        if ($codePw < 400) {
                            return true;
                        }
                    }
                }
            } catch (Exception $selfErr) {
                error_log("Self-password update notice: " . $selfErr->getMessage());
            }
        }

        // Method 2: Admin API token reset with multiple payload formats
        try {
            $payload = [
                'Id' => $jellyfinUserId,
                'CurrentPw' => '',
                'CurrentPassword' => '',
                'NewPw' => $newPassword,
                'NewPassword' => $newPassword,
                'ResetPassword' => true,
                'ClearPassword' => false
            ];
            try {
                $this->request("/Users/{$jellyfinUserId}/Password", 'POST', $payload, true);
                return true;
            } catch (Exception $e1) {
                // Try query param route
                $this->request("/Users/Password?userId=" . urlencode($jellyfinUserId), 'POST', $payload, true);
                return true;
            }
        } catch (Exception $e) {
            error_log("Admin password reset notice for Jellyfin user {$jellyfinUserId}: " . $e->getMessage());
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

    public function deleteUser($jellyfinUserId) {
        try {
            $this->request("/Users/{$jellyfinUserId}", 'DELETE', null, true);
            return true;
        } catch (Exception $e) {
            error_log("Failed to delete Jellyfin user {$jellyfinUserId}: " . $e->getMessage());
            return false;
        }
    }
}
