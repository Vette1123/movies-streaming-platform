"""The add-on against a fake Kodi and a fake Reely.

Kodi cannot run in CI, so this drives plugin.py the way Kodi does (argv in, API
calls out) with every xbmc module stubbed and urlopen answering from a table.
`pnpm test` runs it through tests/kodi-addon.test.ts.
"""

import io
import json
import os
import runpy
import sys
import tempfile
import types
import unittest
import urllib.error
from unittest import mock

ADDON_DIR = os.path.join(os.path.dirname(__file__), '..', 'plugin.video.reely')
sys.path.insert(0, ADDON_DIR)

import reely_api as api  # noqa: E402


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def answer(body):
    return FakeResponse(json.dumps(body).encode('utf-8'))


def refusal(url, status, body):
    return urllib.error.HTTPError(url, status, 'no', {}, io.BytesIO(json.dumps(body).encode()))


class FakeReely:
    """urlopen stand-in: records requests, answers by URL prefix."""

    def __init__(self, routes):
        self.routes = routes
        self.requests = []

    def __call__(self, request, timeout=None):
        self.requests.append(request)
        for prefix, reply in self.routes.items():
            if request.full_url.startswith(prefix):
                if isinstance(reply, Exception):
                    raise reply
                return answer(reply)
        raise AssertionError('unexpected request ' + request.full_url)


PLAY_PAGE = 'https://player.test/play?type=movie&id=603&t=TICKET&o=x&title=y'
TICKET = api.SITE + '/api/pro/ticket'
RESOLVE = 'https://player.test/api/stream/resolve'
MASTER = 'https://relay.test/pl/key?u=x'


class Api(unittest.TestCase):
    def test_title_item_reads_movies_and_series_and_drops_people(self):
        movie = api.title_item({'id': 1, 'title': 'A', 'release_date': '1999-03-31'}, 'movie')
        self.assertEqual((movie['title'], movie['year'], movie['poster']), ('A', 1999, ''))
        series = api.title_item({'id': 2, 'name': 'B', 'media_type': 'tv', 'poster_path': '/p.jpg'})
        self.assertEqual(series['poster'], api.IMAGE_BASE + 'w342/p.jpg')
        self.assertIsNone(api.title_item({'id': 3, 'name': 'C', 'media_type': 'person'}))

    def test_a_missing_date_is_no_year_not_a_crash(self):
        self.assertEqual(api.title_item({'id': 1, 'release_date': ''}, 'movie')['year'], 0)

    def test_stream_url_spends_the_ticket_on_the_private_worker(self):
        fake = FakeReely({
            TICKET: {'success': True, 'url': PLAY_PAGE},
            RESOLVE: {'sources': [{'url': MASTER}]},
        })
        with mock.patch('urllib.request.urlopen', fake):
            url = api.stream_url('TOKEN', 'tv', 1396, 'Show', 2, 3)
        self.assertEqual(url, MASTER)
        ticket, resolve = fake.requests
        self.assertEqual(ticket.get_header('Authorization'), 'Bearer TOKEN')
        self.assertEqual(
            json.loads(ticket.data),
            {'type': 'tv', 'id': 1396, 'season': 2, 'episode': 3, 'title': 'Show'},
        )
        for part in ('type=tv', 'id=1396', 'season=2', 'episode=3', 't=TICKET'):
            self.assertIn(part, resolve.full_url)

    def test_user_agent_stays_off_the_waf_scraper_list(self):
        for token in ('python-requests', 'curl/', 'wget/', 'okhttp', 'axios/', 'Go-http-client'):
            self.assertNotIn(token, api.USER_AGENT)

    def test_poll_reads_all_three_answers(self):
        poll = api.SITE + '/api/device/poll'
        cases = [
            ({'status': 'pending'}, 'pending'),
            ({'status': 'approved', 'token': 'T'}, 'T'),
            (refusal(poll, 410, {'status': 'expired'}), 'expired'),
        ]
        for reply, expected in cases:
            with mock.patch('urllib.request.urlopen', FakeReely({poll: reply})):
                self.assertEqual(api.poll_link('D'), expected)

    def test_a_server_error_without_json_is_still_an_api_error(self):
        broken = urllib.error.HTTPError(TICKET, 503, 'no', {}, io.BytesIO(b'<html>'))
        with mock.patch('urllib.request.urlopen', FakeReely({TICKET: broken})):
            with self.assertRaises(api.ApiError) as caught:
                api.stream_url('T', 'movie', 1, 'A')
        self.assertEqual(caught.exception.status, 503)


def fake_kodi(profile):
    """The five xbmc modules plugin.py imports, as recording mocks."""
    modules = {name: mock.MagicMock() for name in ('xbmc', 'xbmcaddon', 'xbmcgui', 'xbmcplugin')}
    modules['xbmcvfs'] = types.SimpleNamespace(translatePath=lambda path: path)
    modules['xbmcaddon'].Addon.return_value.getAddonInfo.return_value = profile
    modules['xbmc'].LOGWARNING = 2
    return modules


def run_plugin(query, routes, token=None):
    """One add-on invocation. Returns the Kodi mocks and the Reely fake."""
    with tempfile.TemporaryDirectory() as profile:
        if token:
            with open(os.path.join(profile, 'token'), 'w') as file:
                file.write(token)
        modules = fake_kodi(profile)
        fake = FakeReely(routes)
        argv = ['plugin://plugin.video.reely/', '7', query]
        with mock.patch.dict(sys.modules, modules), mock.patch.object(sys, 'argv', argv):
            with mock.patch('urllib.request.urlopen', fake):
                runpy.run_path(os.path.join(ADDON_DIR, 'plugin.py'), run_name='__main__')
        return modules, fake, os.path.exists(os.path.join(profile, 'token'))


class Plugin(unittest.TestCase):
    def test_root_offers_link_until_a_token_exists(self):
        kodi, _, _ = run_plugin('', {})
        labels = [c.args[0] for c in kodi['xbmcgui'].ListItem.call_args_list]
        self.assertEqual(labels, ['Movies', 'TV Shows', 'Search', 'Link this TV'])
        kodi, _, _ = run_plugin('', {}, token='T')
        labels = [c.args[0] for c in kodi['xbmcgui'].ListItem.call_args_list]
        self.assertIn('Unlink this TV', labels)

    def test_popular_lists_titles_and_a_next_page(self):
        routes = {
            api.SITE + '/api/popular': {
                'total_pages': 3,
                'results': [{'id': 603, 'title': 'The Matrix', 'release_date': '1999-03-31'}],
            }
        }
        kodi, _, _ = run_plugin('?mode=popular&type=movie&page=1', routes)
        added = kodi['xbmcplugin'].addDirectoryItem.call_args_list
        self.assertEqual(len(added), 2)
        self.assertIn('mode=play', added[0].args[1])
        self.assertFalse(added[0].args[3])
        self.assertIn('page=2', added[1].args[1])

    def test_play_hands_kodi_the_stream(self):
        routes = {TICKET: {'success': True, 'url': PLAY_PAGE}, RESOLVE: {'sources': [{'url': MASTER}]}}
        kodi, _, _ = run_plugin('?mode=play&type=movie&id=603&title=M', routes, token='T')
        resolved = kodi['xbmcplugin'].setResolvedUrl.call_args
        self.assertTrue(resolved.args[1])
        resolved.args[2].setPath.assert_called_with(MASTER)

    def test_a_lapsed_supporter_is_told_why_and_stays_linked(self):
        routes = {TICKET: refusal(TICKET, 402, {'error': 'supporter feature'})}
        kodi, _, linked = run_plugin('?mode=play&type=movie&id=603&title=M', routes, token='T')
        self.assertFalse(kodi['xbmcplugin'].setResolvedUrl.call_args.args[1])
        message = kodi['xbmcgui'].Dialog.return_value.notification.call_args.args[1]
        self.assertIn('supporters', message)
        self.assertTrue(linked)

    def test_a_dead_session_clears_the_token_so_the_tv_can_relink(self):
        routes = {TICKET: refusal(TICKET, 401, {'error': 'Not signed in'})}
        _, _, linked = run_plugin('?mode=play&type=movie&id=603&title=M', routes, token='T')
        self.assertFalse(linked)


if __name__ == '__main__':
    unittest.main()
