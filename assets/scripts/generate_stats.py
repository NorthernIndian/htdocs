import os
import json
import time
from datetime import datetime, timezone
import requests

# ==============================================================
# Config: read secrets from environment variables
# ==============================================================

CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("STRAVA_REFRESH_TOKEN")

# How many recent activities to pull (enough to cover this year)
MAX_ACTIVITIES = 500  # tweak if needed


def ensure_env():
    """Make sure required environment variables are set."""
    missing = []
    if not CLIENT_ID:
        missing.append("STRAVA_CLIENT_ID")
    if not CLIENT_SECRET:
        missing.append("STRAVA_CLIENT_SECRET")
    if not REFRESH_TOKEN:
        missing.append("STRAVA_REFRESH_TOKEN")

    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )


# ==============================================================
# OAuth: get access token from refresh token
# ==============================================================

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
    if not resp.ok:
        print("Strava token error:", resp.status_code, resp.text)
        resp.raise_for_status()
    data = resp.json()
    return data["access_token"]


# ==============================================================
# Athlete + stats (for true lifetime totals)
# ==============================================================

def get_athlete_and_stats(access_token):
    """Get athlete profile and lifetime stats from Strava."""
    headers = {"Authorization": f"Bearer {access_token}"}

    # Who am I?
    athlete_resp = requests.get(
        "https://www.strava.com/api/v3/athlete", headers=headers
    )
    if not athlete_resp.ok:
        print("Strava /athlete error:", athlete_resp.status_code, athlete_resp.text)
        athlete_resp.raise_for_status()
    athlete = athlete_resp.json()

    # Overall stats for this athlete
    stats_resp = requests.get(
        f"https://www.strava.com/api/v3/athletes/{athlete['id']}/stats",
        headers=headers,
    )
    if not stats_resp.ok:
        print("Strava /athletes/{id}/stats error:", stats_resp.status_code, stats_resp.text)
        stats_resp.raise_for_status()
    athlete_stats = stats_resp.json()

    return athlete, athlete_stats


# ==============================================================
# Activities list (for YTD / MTD / recent runs / PBs)
# ==============================================================

def fetch_activities(access_token, per_page=100, max_activities=MAX_ACTIVITIES):
    """Fetch recent activities from Strava."""
    url = "https://www.strava.com/api/v3/athlete/activities"
    headers = {"Authorization": f"Bearer {access_token}"}

    page = 1
    all_acts = []

    while len(all_acts) < max_activities:
        params = {"page": page, "per_page": per_page}
        resp = requests.get(url, headers=headers, params=params)
        if not resp.ok:
            print("Strava activities error:", resp.status_code, resp.text)
            resp.raise_for_status()
        activities = resp.json()
        if not activities:
            break
        all_acts.extend(activities)
        page += 1
        time.sleep(0.2)  # polite pause

    return all_acts[:max_activities]


def is_run(activity):
    """
    Return True if the activity should be treated as 'running' for the dashboard.
    This covers normal runs and run-like things (e.g. treadmill / virtual run).
    """
    activity_type = activity.get("type")
    sport_type = activity.get("sport_type")

    RUN_LIKE_TYPES = {
        "Run",         # normal outdoor run
        "TrailRun",    # if Strava ever uses this
        "VirtualRun",  # some treadmill setups
        "Workout",     # treadmill workout often appears as this in API
    }

    return (activity_type in RUN_LIKE_TYPES) or (sport_type in RUN_LIKE_TYPES)


# ==============================================================
# Formatting helpers
# ==============================================================

def pace_str(moving_time_s, dist_km):
    """Return pace as mm:ss / km, handling edge cases."""
    if dist_km <= 0:
        return "-"
    pace_s_per_km = moving_time_s / dist_km
    minutes = int(pace_s_per_km // 60)
    seconds = int(round(pace_s_per_km % 60))
    return f"{minutes}:{seconds:02d}"


def duration_str(total_seconds):
    """Convert a duration in seconds to H:MM:SS or M:SS."""
    total_seconds = int(round(total_seconds))
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        return f"{minutes}:{seconds:02d}"


def classify_and_update_pbs(pb_dict, dist_km, moving_time_s, start_dt):
    """Very rough PB classifier based on distance window."""
    EVENT_WINDOWS = {
        "Marathon": (40, 44),
        "Half Marathon": (20, 22.5),
        "10K": (9, 11),
        "5K": (4.5, 5.5),
    }

    for event, (low, high) in EVENT_WINDOWS.items():
        if low <= dist_km <= high:
            current = pb_dict[event]
            if current is None or moving_time_s < current["time_s"]:
                pb_dict[event] = {
                    "time_s": moving_time_s,
                    "time_str": duration_str(moving_time_s),
                    "date": start_dt.date().isoformat(),
                }


# ==============================================================
# Build stats JSON
# ==============================================================

def build_stats(activities, athlete_stats=None):
    """Compute lifetime (from Strava), plus YTD / MTD / PBs / recent runs from activities."""
    now = datetime.now(timezone.utc)
    year = now.year
    month = now.month

    # ----- Lifetime from Strava athlete stats -----
    if athlete_stats:
        all_totals = athlete_stats.get("all_run_totals", {}) or {}
        lifetime_distance_km = (all_totals.get("distance", 0) or 0) / 1000.0
        lifetime_elev_m = all_totals.get("elevation_gain", 0) or 0
        lifetime_time_h = (all_totals.get("moving_time", 0) or 0) / 3600.0
    else:
        lifetime_distance_km = 0.0
        lifetime_elev_m = 0.0
        lifetime_time_h = 0.0

    # ----- YTD & MTD from activities -----
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
    pb_candidates = {
        "Marathon": None,
        "Half Marathon": None,
        "10K": None,
        "5K": None,
    }

    for act in activities:
        if not is_run(act):
            continue

        dist_km = (act.get("distance") or 0) / 1000.0
        elev_m = act.get("total_elevation_gain", 0.0) or 0.0
        moving_time_s = act.get("moving_time", 0) or 0
        moving_time_h = moving_time_s / 3600.0
        name = act.get("name", "Run")

        start_date_str = act.get("start_date")
        if not start_date_str:
            continue
        start_dt = datetime.fromisoformat(start_date_str.replace("Z", "+00:00"))

        # Year-to-date totals
        if start_dt.year == year:
            ytd_distance_km += dist_km
            ytd_elev_m += elev_m
            ytd_time_h += moving_time_h
            ytd_num_runs += 1
            if dist_km > ytd_longest_km:
                ytd_longest_km = dist_km

            # Month-to-date totals (subset of YTD)
            if start_dt.month == month:
                mtd_distance_km += dist_km
                mtd_elev_m += elev_m
                mtd_time_h += moving_time_h
                mtd_num_runs += 1
                if dist_km > mtd_longest_km:
                    mtd_longest_km = dist_km

        # Recent runs list
        recent_runs.append(
            {
                "date": start_dt.date().isoformat(),
                "name": name,
                "distance_km": round(dist_km, 2),
                "elevation_m": round(elev_m, 1),
                "moving_time_min": round(moving_time_s / 60.0),
                "avg_pace": pace_str(moving_time_s, dist_km),
                "link": f"https://www.strava.com/activities/{act['id']}",
            }
        )

        # PBs
        classify_and_update_pbs(pb_candidates, dist_km, moving_time_s, start_dt)

    # Keep only last 10 runs by date
    recent_runs.sort(key=lambda r: r["date"], reverse=True)
    recent_runs = recent_runs[:10]

    # Build PBs list from candidates
    pbs = []
    for event, pb in pb_candidates.items():
        if pb is None:
            continue
        pbs.append(
            {
                "event": event,
                "time": pb["time_str"],
                "date": pb["date"],
            }
        )

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


# ==============================================================
# Main
# ==============================================================

def main():
    ensure_env()

    access_token = get_access_token()
    athlete, athlete_stats = get_athlete_and_stats(access_token)
    activities = fetch_activities(access_token)
    stats = build_stats(activities, athlete_stats=athlete_stats)

    # Write to assets/data/stats.json (relative to this script at assets/scripts)
    script_dir = os.path.dirname(__file__)
    out_dir = os.path.abspath(os.path.join(script_dir, "..", "data"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "stats.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"Wrote stats to {out_path}")


if __name__ == "__main__":
    main()
