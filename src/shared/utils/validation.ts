// Lightweight BCP-47 validator (well-formedness only)
// Derived from ietf-language-tag-regex project
// https://github.com/sebinsua/ietf-language-tag-regex
const BCP47_REGEX = /^(?:(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3}){0,3})|[A-Za-z]{4}|[A-Za-z]{5,8})(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|\d{3}))?(?:-(?:[A-Za-z\d]{5,8}|\d[A-Za-z\d]{3}))*?(?:-[A-WY-Za-wy-z0-9]-[A-Za-z0-9]{2,8})*(?:-x(-[A-Za-z0-9]{1,8})+)?$/;

export function isWellFormedBcp47(tag: string): boolean {
  return BCP47_REGEX.test(tag.trim());
}

