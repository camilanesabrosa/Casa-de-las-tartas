// The installed-app OAuth secret is not confidential. The local generated file
// is bundled into releases but stays out of Git; env is useful for local tests.
let localConfig = {};
try {
  localConfig = require("./drive-config.local.cjs");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND" || !error.message.includes("drive-config.local.cjs")) throw error;
}

module.exports = {
  clientId: "620503194734-fllssfmohuthr2k0s25aj8ajvlg88dst.apps.googleusercontent.com",
  clientSecret: process.env.CASA_GOOGLE_CLIENT_SECRET || localConfig.clientSecret || "",
};
