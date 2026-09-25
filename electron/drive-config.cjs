// The desktop OAuth client ID is public. Put the Google Cloud Desktop client ID
// here for packaged builds. The environment fallback is useful for development.
// Never put a client secret here; this native flow uses PKCE.
module.exports = {
  clientId: process.env.CASA_GOOGLE_DRIVE_CLIENT_ID || "",
};
