// The installed-app OAuth secret is not confidential, but keep it out of the
// repository. Supply it to the Electron process as CASA_GOOGLE_CLIENT_SECRET.
module.exports = {
  clientId: "620503194734-fllssfmohuthr2k0s25aj8ajvlg88dst.apps.googleusercontent.com",
  clientSecret: process.env.CASA_GOOGLE_CLIENT_SECRET || "",
};
