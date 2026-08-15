/**
 * Auth cookie names, and nothing else.
 *
 * These live apart from session.ts and google.ts because those modules pull in
 * D1 queries and crypto — fine for the Worker, but the client only needs the
 * NAME of the hint cookie to read `document.cookie`. Importing it from
 * session.ts would risk the bundler pulling database code into the browser
 * bundle on every page of a site that is otherwise entirely static. This module
 * imports nothing, so nothing can ride along with it.
 */

export const SESSION_COOKIE = 'reely_session'

/**
 * A second, deliberately script-readable cookie carrying no user data.
 *
 * The header control has to know whether to draw "Sign in" or an avatar, and it
 * draws on every page. Asking an endpoint would put every page view back on the
 * Worker and spend the 100k/day request budget rendering an avatar — the exact
 * cost the static-export migration was done to remove. So the answer is a cookie
 * the client reads synchronously, with no network call.
 *
 * It is a hint, never a credential. Every real decision still requires the
 * httpOnly session cookie, checked server-side. Forging this one buys an avatar
 * that links to a page telling you to sign in.
 */
export const HINT_COOKIE = 'reely_account'

/** Short-lived, single-use, and gone by the time the callback returns. */
export const OAUTH_STATE_COOKIE = 'reely_oauth_state'
export const OAUTH_VERIFIER_COOKIE = 'reely_oauth_verifier'
