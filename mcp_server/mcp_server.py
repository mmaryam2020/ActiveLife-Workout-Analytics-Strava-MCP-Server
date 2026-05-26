import os
import sys
import json
import requests
from mcp.server.fastmcp import FastMCP
from auth import get_valid_token

# Initialize FastMCP Server
mcp = FastMCP("Strava MCP Server")

@mcp.tool()
def get_athlete_profile() -> str:
    """
    Retrieve details about the authenticated athlete (profile information, weight, bike details, clubs, etc.).
    """
    # Fetch valid token. Do not run interactive browser flow inside the MCP server process 
    # to avoid hangs/failures inside the editor/LLM connection.
    token = get_valid_token(interactive=False)
    if not token:
        return (
            "Error: No valid access token found or token expired. "
            "Please run the authenticator script manually from your terminal first: "
            "`python3 auth.py`"
        )
    
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get("https://www.strava.com/api/v3/athlete", headers=headers)
        if response.status_code != 200:
            return f"Error: Failed to fetch athlete details. Status: {response.status_code}. Details: {response.text}"
        return response.text
    except Exception as e:
        return f"Exception occurred while fetching athlete details: {str(e)}"

@mcp.tool()
def list_activities(before: int = None, after: int = None, page: int = 1, per_page: int = 30) -> str:
    """
    Retrieve a paginated list of recent activities for the authenticated athlete.
    
    Parameters:
    - before: Epoch timestamp (int) to retrieve activities before this time.
    - after: Epoch timestamp (int) to retrieve activities after this time.
    - page: Page number (int) for pagination. Default is 1.
    - per_page: Number of items per page (int, max 200). Default is 30.
    """
    token = get_valid_token(interactive=False)
    if not token:
        return (
            "Error: No valid access token found or token expired. "
            "Please run the authenticator script manually from your terminal first: "
            "`python3 auth.py`"
        )
        
    headers = {"Authorization": f"Bearer {token}"}
    params = {"page": page, "per_page": per_page}
    if before:
        params["before"] = before
    if after:
        params["after"] = after
        
    try:
        response = requests.get("https://www.strava.com/api/v3/athlete/activities", headers=headers, params=params)
        if response.status_code != 200:
            return f"Error: Failed to fetch activities. Status: {response.status_code}. Details: {response.text}"
        return response.text
    except Exception as e:
        return f"Exception occurred while listing activities: {str(e)}"

@mcp.tool()
def get_activity_details(activity_id: int) -> str:
    """
    Retrieve details of a specific activity by its ID (including segment efforts, gear, splits, maps).
    
    Parameters:
    - activity_id: The ID of the activity (int) to retrieve.
    """
    token = get_valid_token(interactive=False)
    if not token:
        return (
            "Error: No valid access token found. "
            "Please run the authenticator script manually from your terminal: "
            "`python3 auth.py`"
        )
        
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(f"https://www.strava.com/api/v3/activities/{activity_id}", headers=headers)
        if response.status_code != 200:
            return f"Error: Failed to fetch activity details. Status: {response.status_code}. Details: {response.text}"
        return response.text
    except Exception as e:
        return f"Exception occurred while fetching activity details: {str(e)}"

@mcp.tool()
def get_activity_streams(
    activity_id: int, 
    keys: str = "time,distance,latlng,altitude,velocity_smooth,heartrate,cadence,watts,temp,moving,grade_smooth"
) -> str:
    """
    Retrieve raw data streams (time-series sensor data) for a specific activity.
    This provides fine-grained, second-by-second data for heartrate, coordinates, velocity, etc.
    
    Parameters:
    - activity_id: The ID of the activity (int).
    - keys: Comma-separated list of stream types to retrieve. 
            Default: "time,distance,latlng,altitude,velocity_smooth,heartrate,cadence,watts,temp,moving,grade_smooth"
    """
    token = get_valid_token(interactive=False)
    if not token:
        return (
            "Error: No valid access token found. "
            "Please run the authenticator script manually from your terminal: "
            "`python3 auth.py`"
        )
        
    headers = {"Authorization": f"Bearer {token}"}
    params = {"keys": keys, "key_by_type": "true"}
    try:
        response = requests.get(
            f"https://www.strava.com/api/v3/activities/{activity_id}/streams", 
            headers=headers, 
            params=params
        )
        if response.status_code != 200:
            return f"Error: Failed to fetch activity streams. Status: {response.status_code}. Details: {response.text}"
        return response.text
    except Exception as e:
        return f"Exception occurred while fetching activity streams: {str(e)}"

if __name__ == "__main__":
    # Start the FastMCP server
    mcp.run()
