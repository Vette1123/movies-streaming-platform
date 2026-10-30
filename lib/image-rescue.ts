/**
 * Moves a wsrv image onto the TMDB origin before React is running.
 *
 * `&default=1` covers a source wsrv cannot fetch. It cannot cover wsrv itself
 * being down, and BlurredImage's onError does not exist until hydration, so on a
 * slow phone the first screen would sit on alt text for seconds. Two cases:
 *
 * Refused: `error` does not bubble but it does capture, so one listener in <head>
 * sees every image. It stands aside once React owns the element, so the fallback
 * chain and the breaker stay the only logic after hydration.
 *
 * Hung: no `error` ever fires, and no React handler would either. An eager image
 * still waiting after 8s is either a slow link or a dead host, and only a request
 * can tell them apart, so one 1px file gets 4s. Slow 4G answers that in under 2s.
 * A hung host does not, and everything still waiting moves.
 *
 * `/original/` is swapped for `/w1280/` because this path has no resizer behind
 * it and a full-size backdrop is several megabytes.
 */
export const IMAGE_RESCUE_SCRIPT = `(function(){var R=/^https:\\/\\/wsrv\\.nl\\/\\?url=(https:\\/\\/image\\.tmdb\\.org\\/t\\/p\\/[^&]+)/;function m(t){return(t.currentSrc||t.src||'').match(R)}function go(t,u){t.removeAttribute('srcset');t.removeAttribute('sizes');t.src=u[1].replace('/original/','/w1280/')}document.addEventListener('error',function(e){var t=e.target;if(!t||t.tagName!=='IMG')return;var u=m(t);if(!u||Object.keys(t).some(function(k){return k.indexOf('__reactProps')===0}))return;go(t,u)},true);setTimeout(function(){var w=[].filter.call(document.images,function(t){return !t.complete&&t.loading!=='lazy'&&m(t)});if(!w.length)return;var a=0,p=new Image;p.onload=p.onerror=function(){a=1};p.src=m(w[0])[0]+'&w=1';setTimeout(function(){if(a)return;[].forEach.call(document.images,function(t){var u=!t.complete&&m(t);if(u)go(t,u)})},4000)},8000)})()`
