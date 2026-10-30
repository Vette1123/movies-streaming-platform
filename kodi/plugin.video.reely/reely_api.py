"""Reely's HTTP API for the Kodi add-on.

No Kodi imports, so kodi/tests can run this anywhere. The standard library only,
because an add-on's dependencies are one more thing to fail on a Fire TV.

The host is www on purpose: the apex answers with a 301, and urllib turns a
redirected POST into a GET.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

VERSION = '0.1.0'
SITE = 'https://www.reely.space'
IMAGE_BASE = 'https://image.tmdb.org/t/p/'
USER_AGENT = 'Reely-Kodi/' + VERSION
TIMEOUT_S = 30


class ApiError(Exception):
    """`status` is the HTTP status, or 0 when Reely could not be reached."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def call(url, body=None, token=None):
    """One JSON request. Every failure comes back as ApiError."""
    headers = {'User-Agent': USER_AGENT, 'Accept': 'application/json'}
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as error:
        try:
            payload = json.loads(error.read().decode('utf-8'))
        except ValueError:
            payload = {}
        raise ApiError(error.code, payload.get('error') or 'Reely answered %d' % error.code)
    except (urllib.error.URLError, OSError, ValueError):
        raise ApiError(0, 'Could not reach Reely. Check your connection.')


def _image(path, size):
    return IMAGE_BASE + size + path if path else ''


def title_item(raw, media_type=None):
    """A TMDB row as one list entry, or None for what cannot play (people)."""
    kind = media_type or raw.get('media_type')
    if kind not in ('movie', 'tv'):
        return None
    date = raw.get('release_date') or raw.get('first_air_date') or ''
    return {
        'type': kind,
        'id': raw['id'],
        'title': raw.get('title') or raw.get('name') or 'Untitled',
        'year': int(date[:4]) if date[:4].isdigit() else 0,
        'plot': raw.get('overview') or '',
        'rating': raw.get('vote_average') or 0,
        'poster': _image(raw.get('poster_path'), 'w342'),
        'fanart': _image(raw.get('backdrop_path'), 'w1280'),
    }


def _titles(payload, media_type=None):
    items = [title_item(row, media_type) for row in payload.get('results') or []]
    return [item for item in items if item]


def popular(media_type, page):
    query = urllib.parse.urlencode({'mediaType': media_type, 'page': page})
    payload = call(SITE + '/api/popular?' + query)
    return _titles(payload, media_type), page < (payload.get('total_pages') or 1)


def search(query):
    return _titles(call(SITE + '/api/search?' + urllib.parse.urlencode({'query': query})))


def seasons(series_id):
    details = call('%s/api/media/tv/%d' % (SITE, series_id)).get('seriesDetails') or {}
    return [
        {
            'number': season['season_number'],
            'title': season.get('name') or 'Season %d' % season['season_number'],
            'plot': season.get('overview') or '',
            'poster': _image(season.get('poster_path'), 'w342'),
        }
        for season in details.get('seasons') or []
        if season.get('episode_count')
    ]


def episodes(series_id, season):
    query = urllib.parse.urlencode({'seasonId': series_id, 'seasonNumber': season})
    payload = call(SITE + '/api/season-details?' + query)
    return [
        {
            'number': episode['episode_number'],
            'title': episode.get('name') or 'Episode %d' % episode['episode_number'],
            'plot': episode.get('overview') or '',
            'still': _image(episode.get('still_path'), 'w300'),
        }
        for episode in payload.get('episodes') or []
    ]


def start_link():
    return call(SITE + '/api/device/start', body={})


def poll_link(device_code):
    """'pending', 'expired', or the session token once a phone has approved."""
    try:
        answer = call(SITE + '/api/device/poll', body={'deviceCode': device_code})
    except ApiError as error:
        if error.status == 410:
            return 'expired'
        raise
    return answer.get('token') or 'pending'


def stream_url(token, media_type, media_id, title, season=None, episode=None):
    """The HLS URL for one title, spending a fresh 90-second ticket.

    The ticket's `url` is the web player's page. Only its origin and `t` are
    used: the private worker's read routes take the ticket directly, and that
    origin is not known until a supporter has been let through.
    """
    target = {'type': media_type, 'id': media_id}
    if media_type == 'tv':
        target.update({'season': season, 'episode': episode})
    ticket = call(SITE + '/api/pro/ticket', body=dict(target, title=title), token=token)

    play = urllib.parse.urlsplit(ticket['url'])
    credential = urllib.parse.parse_qs(play.query)['t'][0]
    query = urllib.parse.urlencode(dict(target, t=credential))
    answer = call('%s://%s/api/stream/resolve?%s' % (play.scheme, play.netloc, query))

    sources = answer.get('sources') or []
    if not sources:
        raise ApiError(502, 'resolve failed')
    return sources[0]['url']
