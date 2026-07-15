import { adminLogout } from "../lib/admin-session.server.js";

export const action = async ({ request }) => {
  return adminLogout(request);
};

export const loader = async ({ request }) => {
  return adminLogout(request);
};
