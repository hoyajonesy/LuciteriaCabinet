/**
 * Open Graph share-card image — /og/passport/:handle
 *
 * Placeholder resource loader for the Passport share card referenced by the
 * public page's `og:image` / `twitter:image` meta tags. Dynamic on-the-fly
 * card generation (avatar + stats composited onto a branded template) is
 * planned for a later iteration; for now this endpoint resolves to the
 * Luciteria wordmark so link previews still render a valid image rather than
 * a broken one. The route must exist so the meta URL never 404s.
 */
import { redirect } from "@remix-run/node";

export const loader = async () => {
  // TODO(passport): replace with dynamically generated share-card image
  // (element montage + completion %) once the card renderer is built.
  return redirect("/logo.png", 302);
};
