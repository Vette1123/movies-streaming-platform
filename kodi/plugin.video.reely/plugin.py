"""Reely for Kodi: list, link, play. Everything that talks HTTP is in reely_api."""

import os
import sys
import time
from urllib.parse import parse_qsl, urlencode

import xbmc
import xbmcaddon
import xbmcgui
import xbmcplugin
import xbmcvfs

import reely_api as api

ADDON = xbmcaddon.Addon()
BASE = sys.argv[0]
HANDLE = int(sys.argv[1])
PARAMS = dict(parse_qsl(sys.argv[2].lstrip('?')))
TOKEN_FILE = os.path.join(xbmcvfs.translatePath(ADDON.getAddonInfo('profile')), 'token')

# Why a request failed, in words for someone holding a remote.
REASONS = {
    401: 'Your TV link has expired. Link it again from the Reely menu.',
    402: 'The Reely Player is for supporters. See reely.space/support.',
    451: 'This title is not available.',
    502: 'This title could not be started. Try again in a minute.',
    503: 'Reely is busy. Try again in a minute.',
}


def read_token():
    try:
        with open(TOKEN_FILE) as file:
            return file.read().strip() or None
    except OSError:
        return None


def save_token(token):
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    with open(TOKEN_FILE, 'w') as file:
        file.write(token)


def clear_token():
    try:
        os.remove(TOKEN_FILE)
    except OSError:
        pass


def url_for(**params):
    return BASE + '?' + urlencode(params)


def notify(message):
    xbmcgui.Dialog().notification('Reely', message, xbmcgui.NOTIFICATION_INFO, 6000)


def describe(item, title, plot='', year=0, rating=0, media='video', season=0, episode=0):
    """Kodi 20 replaced setInfo with the tag API; Kodi 19 only has setInfo."""
    if not hasattr(item, 'getVideoInfoTag'):
        info = {'title': title, 'plot': plot, 'year': year, 'rating': rating, 'mediatype': media}
        if season:
            info['season'] = season
        if episode:
            info['episode'] = episode
        item.setInfo('video', info)
        return
    tag = item.getVideoInfoTag()
    tag.setTitle(title)
    tag.setPlot(plot)
    tag.setYear(year)
    tag.setRating(float(rating))
    tag.setMediaType(media)
    if season:
        tag.setSeason(season)
    if episode:
        tag.setEpisode(episode)


def add_folder(label, url, poster=''):
    item = xbmcgui.ListItem(label)
    if poster:
        item.setArt({'poster': poster, 'thumb': poster})
    xbmcplugin.addDirectoryItem(HANDLE, url, item, True)


def add_action(label, url):
    xbmcplugin.addDirectoryItem(HANDLE, url, xbmcgui.ListItem(label), False)


def add_title(title):
    label = '%s (%d)' % (title['title'], title['year']) if title['year'] else title['title']
    item = xbmcgui.ListItem(label)
    item.setArt({'poster': title['poster'], 'thumb': title['poster'], 'fanart': title['fanart']})
    if title['type'] == 'movie':
        describe(item, title['title'], title['plot'], title['year'], title['rating'], 'movie')
        item.setProperty('IsPlayable', 'true')
        url = url_for(mode='play', type='movie', id=title['id'], title=title['title'])
        xbmcplugin.addDirectoryItem(HANDLE, url, item, False)
        return
    describe(item, title['title'], title['plot'], title['year'], title['rating'], 'tvshow')
    url = url_for(mode='seasons', id=title['id'], title=title['title'])
    xbmcplugin.addDirectoryItem(HANDLE, url, item, True)


def end_list(content):
    xbmcplugin.setContent(HANDLE, content)
    xbmcplugin.endOfDirectory(HANDLE)


def show_root():
    add_folder('Movies', url_for(mode='popular', type='movie', page=1))
    add_folder('TV Shows', url_for(mode='popular', type='tv', page=1))
    add_folder('Search', url_for(mode='search'))
    if read_token():
        add_action('Unlink this TV', url_for(mode='unlink'))
    else:
        add_action('Link this TV', url_for(mode='link'))
    end_list('files')


def show_popular():
    page = int(PARAMS.get('page', 1))
    titles, more = api.popular(PARAMS['type'], page)
    for title in titles:
        add_title(title)
    if more:
        add_folder('Next page', url_for(mode='popular', type=PARAMS['type'], page=page + 1))
    end_list('movies' if PARAMS['type'] == 'movie' else 'tvshows')


def show_search():
    query = xbmcgui.Dialog().input('Search Reely')
    if not query:
        xbmcplugin.endOfDirectory(HANDLE, succeeded=False)
        return
    for title in api.search(query):
        add_title(title)
    end_list('videos')


def show_seasons():
    for season in api.seasons(int(PARAMS['id'])):
        url = url_for(
            mode='episodes', id=PARAMS['id'], title=PARAMS['title'], season=season['number']
        )
        add_folder(season['title'], url, season['poster'])
    end_list('seasons')


def show_episodes():
    season = int(PARAMS['season'])
    for episode in api.episodes(int(PARAMS['id']), season):
        item = xbmcgui.ListItem('%d. %s' % (episode['number'], episode['title']))
        item.setArt({'thumb': episode['still']})
        describe(
            item, episode['title'], episode['plot'], media='episode',
            season=season, episode=episode['number'],
        )
        item.setProperty('IsPlayable', 'true')
        url = url_for(
            mode='play', type='tv', id=PARAMS['id'], title=PARAMS['title'],
            season=season, episode=episode['number'],
        )
        xbmcplugin.addDirectoryItem(HANDLE, url, item, False)
    end_list('episodes')


def link():
    """Show the code and wait for a phone. Returns the token, or None."""
    start = api.start_link()
    message = 'On your phone, open %s\nand enter this code:\n[B]%s[/B]' % (
        start['verifyUrl'], start['userCode'],
    )
    progress = xbmcgui.DialogProgress()
    progress.create('Link this TV', message)
    monitor = xbmc.Monitor()
    began = time.time()
    try:
        while not progress.iscanceled() and not monitor.abortRequested():
            elapsed = time.time() - began
            if elapsed >= start['expiresIn']:
                break
            progress.update(int(100 * elapsed / start['expiresIn']), message)
            if monitor.waitForAbort(start['interval']):
                break
            result = api.poll_link(start['deviceCode'])
            if result == 'expired':
                break
            if result != 'pending':
                save_token(result)
                notify('This TV is linked.')
                return result
    finally:
        progress.close()
    return None


def play():
    media_type = PARAMS['type']
    season = int(PARAMS['season']) if 'season' in PARAMS else None
    episode = int(PARAMS['episode']) if 'episode' in PARAMS else None
    item = xbmcgui.ListItem(PARAMS['title'])

    token = read_token() or link()
    if not token:
        xbmcplugin.setResolvedUrl(HANDLE, False, item)
        return
    try:
        url = api.stream_url(
            token, media_type, int(PARAMS['id']), PARAMS['title'], season, episode
        )
    except api.ApiError as error:
        if error.status == 401:
            clear_token()
        xbmcplugin.setResolvedUrl(HANDLE, False, item)
        raise

    item.setPath(url)
    item.setMimeType('application/vnd.apple.mpegurl')
    item.setContentLookup(False)
    xbmcplugin.setResolvedUrl(HANDLE, True, item)


def run_link():
    link()
    xbmc.executebuiltin('Container.Refresh')


def run_unlink():
    clear_token()
    notify('This TV is unlinked.')
    xbmc.executebuiltin('Container.Refresh')


ROUTES = {
    'popular': show_popular,
    'search': show_search,
    'seasons': show_seasons,
    'episodes': show_episodes,
    'play': play,
    'link': run_link,
    'unlink': run_unlink,
}


def main():
    try:
        ROUTES.get(PARAMS.get('mode'), show_root)()
    except api.ApiError as error:
        xbmc.log('Reely: %d %s' % (error.status, error.message), xbmc.LOGWARNING)
        notify(REASONS.get(error.status, error.message))


if __name__ == '__main__':
    main()
