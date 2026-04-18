import kebabCase from 'lodash.kebabcase';

export function slugifyStr(value: string) {
  return kebabCase(value.trim());
}
