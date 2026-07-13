import urllib.request
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

def test_proxy(proxy):
    proxy = proxy.strip()
    if not proxy:
        return None
    try:
        proxy_handler = urllib.request.ProxyHandler({'http': proxy, 'https': proxy})
        opener = urllib.request.build_opener(proxy_handler)
        req = urllib.request.Request(
            "https://cinjelly.zerolord.com/php-backend/index.php/api/health", 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        response = opener.open(req, timeout=3)
        code = response.getcode()
        if code == 200:
            return proxy
    except Exception:
        pass
    return None

def find_working():
    print("Reading proxies from proxies_list.txt...")
    try:
        with open("proxies_list.txt", "r") as f:
            proxies = f.readlines()
    except Exception as e:
        print("Error reading proxies_list.txt:", e)
        sys.exit(1)
        
    print(f"Loaded {len(proxies)} proxies. Testing concurrently...")
    
    working_proxy = None
    with ThreadPoolExecutor(max_workers=30) as executor:
        futures = {executor.submit(test_proxy, p): p for p in proxies}
        for future in as_completed(futures):
            res = future.result()
            if res:
                working_proxy = res
                print(f"\nFOUND WORKING PROXY: {working_proxy}")
                # Cancel other futures and exit
                executor.shutdown(wait=False, cancel_futures=True)
                break
                
    if working_proxy:
        # Write to working_proxy.txt
        with open("working_proxy.txt", "w") as f:
            f.write(working_proxy)
        print("Working proxy saved to working_proxy.txt")
        sys.exit(0)
    else:
        print("No working proxies found.")
        sys.exit(1)

if __name__ == "__main__":
    find_working()
