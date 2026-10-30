/**
 * Moves a failed wsrv image onto the TMDB origin before React is running.
 *
 * `&default=1` covers a source wsrv cannot fetch. It cannot cover wsrv itself
 * being unreachable, and BlurredImage's onError does not exist until hydration,
 * so on a slow phone the first screen would sit on alt text for seconds. `error`
 * does not bubble but it does capture, so one listener in <head> sees every image.
 *
 * It stands aside once React owns the element, so the fallback chain and the
 * breaker stay the only logic after hydration. `/original/` is swapped for
 * `/w1280/` because this path has no resizer behind it and a full-size backdrop
 * is several megabytes.
 */
export const IMAGE_RESCUE_SCRIPT = `document.addEventListener('error',function(e){var t=e.target;if(!t||t.tagName!=='IMG')return;var m=(t.currentSrc||t.src||'').match(/^https:\\/\\/wsrv\\.nl\\/\\?url=(https:\\/\\/image\\.tmdb\\.org\\/t\\/p\\/[^&]+)/);if(!m||Object.keys(t).some(function(k){return k.indexOf('__reactProps')===0}))return;t.removeAttribute('srcset');t.removeAttribute('sizes');t.src=m[1].replace('/original/','/w1280/')},true)`
