import os
import sys
import json
import time
import urllib.parse
import webbrowser
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
from dotenv import load_dotenv

# Load configuration
ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_FILE)

CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
PORT = int(os.getenv("STRAVA_PORT", 8282))
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "strava_tokens.json")

# Shared storage for auth code
auth_code = None

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        
        if "code" in query_params:
            auth_code = query_params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            
            success_html = """
            <html>
                <head>
                    <title>Authorization Successful</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                            background-color: #f4f4f7;
                            color: #333;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            height: 100vh;
                            margin: 0;
                        }
                        .card {
                            background: white;
                            padding: 40px;
                            border-radius: 12px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                            text-align: center;
                            max-width: 400px;
                        }
                        h1 { color: #FC6100; margin-top: 0; }
                        p { font-size: 16px; line-height: 1.5; color: #666; }
                        .success-icon {
                            font-size: 48px;
                            color: #4CAF50;
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="success-icon">✓</div>
                        <h1>Authorized!</h1>
                        <p>You have successfully authenticated with Strava. You can close this window now and return to your terminal.</p>
                    </div>
                </body>
            </html>
            """
            self.wfile.write(success_html.encode("utf-8"))
        else:
            self.send_response(400)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"Error: No authorization code received.")

    def log_message(self, format, *args):
        # Suppress logging to keep output clean
        pass

def save_tokens(token_data):
    # Ensure tokens have an absolute expiry timestamp
    if "expires_in" in token_data and "expires_at" not in token_data:
        token_data["expires_at"] = int(time.time()) + token_data["expires_in"]
        
    with open(TOKEN_FILE, "w") as f:
        json.dump(token_data, f, indent=2)
    print(f"Tokens saved successfully to {TOKEN_FILE}", file=sys.stderr)

def load_tokens():
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading token file: {e}", file=sys.stderr)
            return None
    return None

def refresh_tokens(refresh_token):
    print("Refreshing access token...", file=sys.stderr)
    url = "https://www.strava.com/oauth/token"
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token
    }
    
    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
        new_tokens = response.json()
        save_tokens(new_tokens)
        return new_tokens
    except Exception as e:
        print(f"Error refreshing token: {e}", file=sys.stderr)
        return None

def get_valid_token(interactive=True):
    """Gets a valid access token. Handles refreshing if expired."""
    global CLIENT_ID, CLIENT_SECRET
    # Reload env to ensure fresh values
    load_dotenv()
    CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
    CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
    
    if not CLIENT_ID or not CLIENT_SECRET:
        print("Error: STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in your .env file.", file=sys.stderr)
        return None
        
    tokens = load_tokens()
    if tokens:
        expires_at = tokens.get("expires_at", 0)
        # If token is valid for another 5 minutes, use it
        if expires_at > time.time() + 300:
            return tokens.get("access_token")
        
        # Otherwise try refresh
        refresh_tok = tokens.get("refresh_token")
        if refresh_tok:
            new_tokens = refresh_tokens(refresh_tok)
            if new_tokens:
                return new_tokens.get("access_token")
                
    # If no tokens or refresh failed, trigger the interactive OAuth flow if allowed
    if interactive:
        return run_oauth_flow()
    else:
        print("Error: Token expired or not found, and interactive login is disabled.", file=sys.stderr)
        return None

def run_oauth_flow():
    global auth_code
    if not CLIENT_ID or not CLIENT_SECRET:
        print("Error: Please set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in the .env file.", file=sys.stderr)
        return None

    print("\n--- Starting Strava Authorization ---", file=sys.stderr)
    redirect_uri = f"http://localhost:{PORT}"
    
    # We request activity:read_all to read private activities too.
    scope = "read,activity:read,activity:read_all"
    auth_url = (
        f"https://www.strava.com/oauth/authorize?"
        f"client_id={CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scope}"
    )
    
    server = HTTPServer(("localhost", PORT), OAuthCallbackHandler)
    print(f"1. Starting local redirect server on port {PORT}...", file=sys.stderr)
    print(f"2. Opening browser to authorize application...", file=sys.stderr)
    
    webbrowser.open(auth_url)
    
    print("Waiting for authorization in the browser...", file=sys.stderr)
    while auth_code is None:
        try:
            server.handle_request()
        except KeyboardInterrupt:
            print("\nAuthorization cancelled.", file=sys.stderr)
            sys.exit(1)
            
    print("3. Exchange authorization code for tokens...", file=sys.stderr)
    token_url = "https://www.strava.com/oauth/token"
    token_data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": auth_code,
        "grant_type": "authorization_code"
    }
    
    try:
        response = requests.post(token_url, data=token_data)
        response.raise_for_status()
        tokens = response.json()
        save_tokens(tokens)
        return tokens.get("access_token")
    except Exception as e:
        print(f"Error exchanging authorization code: {e}", file=sys.stderr)
        if 'response' in locals() and response is not None:
            print(f"Details: {response.text}", file=sys.stderr)
        return None

if __name__ == "__main__":
    token = get_valid_token()
    if token:
        print("\nSUCCESS! Valid access token retrieved.", file=sys.stderr)
    else:
        print("\nFAILED! Could not retrieve access token.", file=sys.stderr)
