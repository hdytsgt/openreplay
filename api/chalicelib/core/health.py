from urllib.parse import urlparse

import redis
import requests
from decouple import config

from chalicelib.utils import pg_client

HEALTH_ENDPOINTS = {
    "alerts": "http://alerts-openreplay.app.svc.cluster.local:8888/health",
    "assets": "http://assets-openreplay.app.svc.cluster.local:8888/metrics",
    "assist": "http://assist-openreplay.app.svc.cluster.local:8888/health",
    "chalice": "http://chalice-openreplay.app.svc.cluster.local:8888/metrics",
    "db": "http://db-openreplay.app.svc.cluster.local:8888/metrics",
    "ender": "http://ender-openreplay.app.svc.cluster.local:8888/metrics",
    "heuristics": "http://heuristics-openreplay.app.svc.cluster.local:8888/metrics",
    "http": "http://http-openreplay.app.svc.cluster.local:8888/metrics",
    "ingress-nginx": "http://ingress-nginx-openreplay.app.svc.cluster.local:8888/metrics",
    "integrations": "http://integrations-openreplay.app.svc.cluster.local:8888/metrics",
    "peers": "http://peers-openreplay.app.svc.cluster.local:8888/health",
    "sink": "http://sink-openreplay.app.svc.cluster.local:8888/metrics",
    "sourcemaps-reader": "http://sourcemapreader-openreplay.app.svc.cluster.local:8888/health",
    "storage": "http://storage-openreplay.app.svc.cluster.local:8888/metrics",
}


def __check_database_pg():
    fail_response = {
        "health": False,
        "details": {
            "errors": ["Postgres health-check failed"]
        }
    }
    with pg_client.PostgresClient() as cur:
        try:
            cur.execute("SHOW server_version;")
            server_version = cur.fetchone()
        except Exception as e:
            print("!! health failed: postgres not responding")
            print(str(e))
            return fail_response
        try:
            cur.execute("SELECT openreplay_version() AS version;")
            schema_version = cur.fetchone()
        except Exception as e:
            print("!! health failed: openreplay_version not defined")
            print(str(e))
            return fail_response
    return {
        "health": True,
        "details": {
            # "version": server_version["server_version"],
            # "schema": schema_version["version"]
        }
    }


def __not_supported():
    return {"errors": ["not supported"]}


def __always_healthy():
    return {
        "health": True,
        "details": {}
    }


def __check_be_service(service_name):
    def fn():
        fail_response = {
            "health": False,
            "details": {
                "errors": ["server health-check failed"]
            }
        }
        try:
            results = requests.get(HEALTH_ENDPOINTS.get(service_name), timeout=2)
            if results.status_code != 200:
                print(f"!! issue with the {service_name}-health code:{results.status_code}")
                print(results.text)
                # fail_response["details"]["errors"].append(results.text)
                return fail_response
        except requests.exceptions.Timeout:
            print(f"!! Timeout getting {service_name}-health")
            # fail_response["details"]["errors"].append("timeout")
            return fail_response
        except Exception as e:
            print(f"!! Issue getting {service_name}-health response")
            print(str(e))
            try:
                print(results.text)
                # fail_response["details"]["errors"].append(results.text)
            except:
                print("couldn't get response")
                # fail_response["details"]["errors"].append(str(e))
            return fail_response
        return {
            "health": True,
            "details": {}
        }

    return fn


def __check_redis():
    fail_response = {
        "health": False,
        "details": {"errors": ["server health-check failed"]}
    }
    if config("REDIS_STRING", default=None) is None:
        # fail_response["details"]["errors"].append("REDIS_STRING not defined in env-vars")
        return fail_response

    try:
        u = urlparse(config("REDIS_STRING"))
        r = redis.Redis(host=u.hostname, port=u.port, socket_timeout=2)
        r.ping()
    except Exception as e:
        print("!! Issue getting redis-health response")
        print(str(e))
        # fail_response["details"]["errors"].append(str(e))
        return fail_response

    return {
        "health": True,
        "details": {
            # "version": r.execute_command('INFO')['redis_version']
        }
    }


def get_health():
    health_map = {
        "databases": {
            "postgres": __check_database_pg
        },
        "ingestionPipeline": {
            "redis": __check_redis
        },
        "backendServices": {
            "alerts": __check_be_service("alerts"),
            "assets": __check_be_service("assets"),
            "assist": __check_be_service("assist"),
            "chalice": __always_healthy,
            "db": __check_be_service("db"),
            "ender": __check_be_service("ender"),
            "frontend": __always_healthy,
            "heuristics": __check_be_service("heuristics"),
            "http": __check_be_service("http"),
            "ingress-nginx": __always_healthy,
            "integrations": __check_be_service("integrations"),
            "peers": __check_be_service("peers"),
            "sink": __check_be_service("sink"),
            "sourcemaps-reader": __check_be_service("sourcemaps-reader"),
            "storage": __check_be_service("storage")
        }
    }
    for parent_key in health_map.keys():
        for element_key in health_map[parent_key]:
            health_map[parent_key][element_key] = health_map[parent_key][element_key]()
    return health_map
