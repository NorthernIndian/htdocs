import os
import json
import time
from datetime import datetime, timezone
import requests

# ==== CONFIG: FILL THESE IN (later use env vars / GitHub secrets) ====
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")

# How many recent activities to pull (you can tweak this)
MAX_ACTIVITIES = 300  # good enough for yearly + some history


def get_access_token():
    """Use the refresh token to get a fresh access token."""
    url = "https://www.strava.com/oauth/token"
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": REFRESH_TOKEN,
    }
    resp = requests.post(url, data=payload)
    resp.raise_for_status()
    data = resp.json()
    # Optionally, you could update REFRESH_TOKEN if Strava rotates it
    return data["access_token"]


def fetch_activities(access_token, per_page=100, max_activities=MAX_ACTIVITIES):
    """Fetch recent activities from Strava."""
    url = "https://www.strava.com/api/v3/athlete/activities"
    headers = {"Authorization": f"Bearer {access_token}"}

    page = 1
    all_acts = []

    while len(all_acts) < max_activities:
        params = {"page": page, "per_page": per_page}
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        activities = resp.json()
        if not activities:
            break
        all_acts.extend(activities)
        page += 1
        time.sleep(0.2)  # polite pause

    return all_acts[:max_activities]


def is_run(activity):
    # Strava type for runs is "Run" (and sometimes "Trail Run" is still "Run" in type)
    return activity.get("type") == "Run"


def build_stats(activities):
    """Compute lifetime-ish, YTD, MTD, PBs, and recent runs."""

    # Use local time zone? For consistency, use UTC then adjust in frontend if needed
    now = datetime.now(timezone.utc)
    year = now.year
    month = now.month

    # Initialize accumulators
    lifetime_distance_km = 0.0
    lifetime_elev_m = 0.0
    lifetime_time_h = 0.0

    ytd_distance_km = 0.0
    ytd_elev_m = 0.0
    ytd_time_h = 0.0
    ytd_num_runs = 0
    ytd_longest_km = 0.0

    mtd_distance_km = 0.0
    mtd_elev_m = 0.0
    mtd_time_h = 0.0
    mtd_num_runs = 0
    mtd_longest_km = 0.0

    recent_runs = []

    # Basic PBs (you can make this more advanced later)
    pb_candidates = {
        "Marathon": None,
        "Half Marathon": None,
        "10K": None,
        "5K": None,
    }

    for act in activities:
        if not is_run(act):
            continue

        dist_km = act["distance"] / 1000.0  # meters -> km
        elev_m = act.get("total_elevation_gain", 0.0) or 0.0
        moving_time_s = act.get("moving_time", 0)
        moving_time_h = moving_time_s / 3600.0
        name = act.get("name", "Run")
        start_date_str = act.get("start_date")  # UTC ISO 8601
        start_dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))

        # Lifetime
        lifetime_distance_km += dist_km
        lifetime_elev_m += elev_m
        lifetime_time_h += moving_time_h

        # Year-to-date
        if start_dt.year == year:
            ytd_distance_km += dist_km
            ytd_elev_m += elev_m
            ytd_time_h += moving_time_h
            ytd_num_runs += 1
            if dist_km > ytd_longest_km:
                ytd_longest_km = dist_km

            # Month-to-date
            if start_dt.month == month:
                mtd_distance_km += dist_km
                mtd_elev_m += elev_m
                mtd_time_h += moving_time_h
                mtd_num_runs += 1
                if dist_km > mtd_longest_km:
                    mtd_longest_km = dist_km

        # Collect recent runs (we’ll sort later)
        recent_runs.append({
            "date": start_dt.date().isoformat(),
            "name": name,
            "distance_km": round(dist_km, 2),
            "elevation_m": round(elev_m, 1),
            "moving_time_min": round(moving_time_s / 60.0),
            "avg_pace": pace_str(moving_time_s, dist_km),
            "link": f"https://www.strava.com/activities/{act['id']}",
        })

        # PB detection (very rough: based on distance)
        classify_and_update_pbs(pb_candidates, act, dist_km, moving_time_s, start_dt)

    # Keep only, say, last 10 runs by date
    recent_runs.sort(key=lambda r: r["date"], reverse=True)
    recent_runs = recent_runs[:10]

    # Build PBs list from candidates (filter out None)
    pbs = []
    for event, pb in pb_candidates.items():
        if pb is None:
            continue
        pbs.append({
            "event": event,
            "time": pb["time_str"],
            "date": pb["date"],
        })

    stats = {
        "updatedAt": now.isoformat(),
        "lifetime": {
            "distance_km": round(lifetime_distance_km, 1),
            "elevation_m": int(round(lifetime_elev_m)),
            "time_hours": round(lifetime_time_h, 1),
        },
        "yearToDate": {
            "year": year,
            "distance_km": round(ytd_distance_km, 1),
            "elevation_m": int(round(ytd_elev_m)),
            "time_hours": round(ytd_time_h, 1),
            "num_runs": ytd_num_runs,
            "longest_run_km": round(ytd_longest_km, 1),
        },
        "monthToDate": {
            "year": year,
            "month": month,
            "distance_km": round(mtd_distance_km, 1),
            "elevation_m": int(round(mtd_elev_m)),
            "time_hours": round(mtd_time_h, 1),
            "num_runs": mtd_num_runs,
            "longest_run_km": round(mtd_longest_km, 1),
        },
        "pbs": pbs,
        "recentRuns": recent_runs,
    }

    return stats


def pace_str(moving_time_s, dist_km):
    """Return pace as mm:ss /km, handling edge cases."""
    if dist_km <= 0:
        return "-"
    pace_s_per_km = moving_time_s / dist_km
    minutes = int(pace_s_per_km // 60)
    seconds = int(round(pace_s_per_km % 60))
    return f"{minutes}:{seconds:02d}"


def classify_and_update_pbs(pb_dict, act, dist_km, moving_time_s, start_dt):
    """Very rough PB classifier based on distance window."""
    # windows in km
    EVENT_WINDOWS = {
        "Marathon": (40, 44),
        "Half Marathon": (20, 22.5),
        "10K": (9, 11),
        "5K": (4.5, 5.5),
    }

    for event, (low, high) in EVENT_WINDOWS.items():
        if low <= dist_km <= high:
            time_str = pace_to_time_str(moving_time_s)
            current = pb_dict[event]
            if current is None or moving_time_s < current["time_s"]:
                pb_dict[event] = {
                    "time_s": moving_time_s,
                    "time_str": time_str,
                    "date": start_dt.date().isoformat(),
                }


def pace_to_time_str(total_seconds):
    """Convert a duration in seconds to H:MM:SS or M:SS."""
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    if hours > 0:
        return f"{int(hours)}:{int(minutes):02d}:{int(seconds):02d}"
    else:
        return f"{int(minutes)}:{int(seconds):02d}"


def main():
    access_token = get_access_token()
    activities = fetch_activities(access_token)
    stats = build_stats(activities)

    # Write to ../data/stats.json (from scripts directory)
    out_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "stats.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"Wrote stats to {out_path}")


if __name__ == "__main__":
    main()
