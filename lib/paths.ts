export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Native anchors, fetch and public assets need the deployment prefix too.
export const appPath = (path: string) => `${BASE_PATH}${path}`;
