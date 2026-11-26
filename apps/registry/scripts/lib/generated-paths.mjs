/*
 * Which files under apps/registry/public are generated, and so belong to the release commit
 * rather than to a feature pull request. One definition, used by the CI gate
 * (check-no-generated-output.mjs) and held against .gitattributes by a test.
 */

export const PUBLIC = 'apps/registry/public';

/** Files under public/ a person writes; everything else there is generated. */
export const HAND_AUTHORED = new Set([`${PUBLIC}/favicon.svg`]);

export const isGenerated = (file) =>
  file.startsWith(`${PUBLIC}/`) && !HAND_AUTHORED.has(file);
