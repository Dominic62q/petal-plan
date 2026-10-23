// Web Push endpoints are chosen by the client, so the server only delivers to
// the browser vendors' push services. Keep in sync with firestore.rules.
const PUSH_HOST_SUFFIXES = [
    "fcm.googleapis.com",
    "push.services.mozilla.com",
    "notify.windows.com",
    "push.apple.com",
];
export function isAllowedPushEndpoint(endpoint) {
    if (typeof endpoint !== "string")
        return false;
    let url;
    try {
        url = new URL(endpoint);
    }
    catch {
        return false;
    }
    if (url.protocol !== "https:" || url.port !== "" || url.username || url.password)
        return false;
    return PUSH_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
}
