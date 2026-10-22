import getReadingTime from 'reading-time';
import { toString } from 'mdast-util-to-string';

export function remarkReadingTime() {
  return function (tree, { data }) {
    const textOnPage = toString(tree);
    const readingTime = getReadingTime(textOnPage);
    // Injects into frontmatter for astro pages and markdown rendering
    if (!data.astro) {
      data.astro = {};
    }
    if (!data.astro.frontmatter) {
      data.astro.frontmatter = {};
    }
    data.astro.frontmatter.readingTime = readingTime.text;
    data.astro.frontmatter.minutesRead = Math.ceil(readingTime.minutes);
  };
}
