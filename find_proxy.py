import urllib.request
import urllib.error
import sys

# List of proxies from ProxyScrape
proxies = [
    "145.220.226.8:8080",
    "145.220.226.46:8080",
    "145.220.226.117:8080",
    "145.220.226.94:8080",
    "145.220.226.173:8080",
    "145.220.226.141:8080",
    "145.220.226.153:8080",
    "176.111.37.5:39811",
    "50.205.246.13:8080",
    "156.38.112.11:80",
    "103.65.237.92:5678",
    "219.93.101.60:80",
    "43.205.89.88:443",
    "101.66.199.247:8085",
    "61.158.175.38:9002",
    "219.65.73.80:80",
    "8.221.126.184:80",
    "50.205.246.13:80"
]

def test_proxy(proxy):
    try:
        proxy_handler = urllib.request.ProxyHandler({'http': proxy, 'https': proxy})
        opener = urllib.request.build_opener(proxy_handler)
        # Use a short timeout of 3 seconds
        req = urllib.request.Request(
            "https://cinjelly.zerolord.com/php-backend/index.php/api/health", 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        response = opener.open(req, timeout=3)
        code = response.getcode()
        if code == 200:
            print(f"SUCCESS: {proxy} is working!")
            return True
    except Exception as e:
        # Silently fail for bad proxies
        pass
    return False

def find_working():
    print("Testing proxies to find a working tunnel...")
    for p in proxies:
        print(f"Testing {p}...")
        if test_proxy(p):
            print(f"\nFound working proxy: {p}")
            sys.exit(0)
    print("No working proxies found.")
    sys.exit(1)

if __name__ == "__main__":
    find_working()
