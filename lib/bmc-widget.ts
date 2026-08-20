/**
 * The Buy Me a Coffee tip jar, built after the page has finished loading.
 *
 * The provider hands you a `<script defer src>` with these settings as data
 * attributes, and that tag works — it is what this file replaces. What it costs
 * is the problem: a deferred script still downloads as part of the page load
 * and still delays DOMContentLoaded, so 8KB of vendor bundle, a webfont and an
 * iframe end up competing with the first paint for a button most readers never
 * touch.
 *
 * `async` is not the way out. The bundle does all of its work inside a
 * `DOMContentLoaded` listener with no `readyState` guard, so any tag that
 * starts executing after that event has fired downloads and then does nothing —
 * which is also why all three next/script strategies were measured loading it
 * and never running it.
 *
 * So the tag is built here instead, after `load` and in idle time, and then
 * handed the event it is waiting for. Faking DOMContentLoaded is only safe
 * because of when it happens: the real one is long gone, so this one fires
 * exactly once and after every other listener for it has already run. Anything
 * added later that needs the real event should listen on `document`.
 *
 * Save-Data skips it entirely. A reader who asked for fewer bytes should not
 * spend them on our donation button.
 *
 * Bottom-LEFT, and lower-case: the bundle compares `data-position` against the
 * literal 'left' and treats everything else as the right edge, where the button
 * lands on the hero's trailer-autoplay toggle and swallows 42% of it. The
 * snippet the dashboard generates says `Right`, capitalised; taking it verbatim
 * would move the button back onto the toggle and, capitalised, only reach the
 * right edge by accident of that same comparison.
 *
 * `message` is empty on purpose. The bubble used to promise "supporters get
 * server switching + calendar feed", and nothing bought through this panel
 * grants either: it sells coffees, and lib/billing/bmc.ts matches on the level
 * names in config/support.ts alone. The bubble was the only surface that could
 * make that promise, so it now says nothing at all — /pro is the path that
 * turns somebody into a supporter.
 *
 * The same loader runs in the downloader project, kept in step by hand — the
 * two share no package, and this is small enough that a shared one would cost
 * more than it saves. The settings below are the only lines that differ.
 */
export const BMC_WIDGET_SCRIPT = `(function(){try{
var n=navigator;if(n.connection&&n.connection.saveData){return;}
var a={name:'BMC-Widget',cfasync:'false',id:'vetteotp',
description:'Support me on Buy me a coffee!',
message:'',
color:'#5F7FFF',position:'left',x_margin:'18',y_margin:'18'};
function load(){var s=document.createElement('script');s.async=true;
s.src='https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';
for(var k in a){s.setAttribute('data-'+k,a[k]);}
s.onload=function(){window.dispatchEvent(new Event('DOMContentLoaded'));};
document.head.appendChild(s);}
function idle(){(window.requestIdleCallback||function(f){setTimeout(f,1200);})(load);}
if(document.readyState==='complete'){idle();}
else{window.addEventListener('load',idle);}
}catch(e){}})();`
