// SPDX-License-Identifier: ISC

import { PassThrough } from "node:stream";

const base = new URL("https://hacker-news.firebaseio.com/v0/");

/**
 *
 * @param {String} story The JSON representation of a story, to be parsed and
 * used to build HTML.
 * @returns {String} The HTML article ready to send.
 */
const htmlify = function (story) {
  const { by, title, url } = JSON.parse(story);

  return `
  <article class='hn-article'>
    <h2> ${by} </h2>
    <h3>${title}<h3>
    <a href="${url}">${url}</a>
  </article>
  `;
};

/**
 * @type {RequestInit}
 */
const jsonInit = Object.freeze(
  Object.create(null, {
    headers: {
      value: new Headers({ Accept: "application/json" }),
      writable: false,
      enumerable: true,
      configurable: false,
    },
  }),
);

async function hydrate(stream, max, json) {
  const stories = await fetch(new URL("newstories.json", base), jsonInit).then(
    (response) => {
      if (!response.ok) {
        throw new Error("No data");
      }

      return response.json();
    },
  );

  let comma = "";
  if (json) {
    stream.push("[");
  }

  for (const id of stories) {
    /**
     * @type {String|null} The story: null when there is any error, otherwise
     * the JSON string. The string will be parsed to make HTML and directly
     * streamed if returning JSON.
     */
    const story = await fetch(new URL(`item/${id}.json`, base), jsonInit).then(
      (response) => {
        if (!response.ok) {
          console.error(`Failed to fetch ${response.url}, skipping`);
          return null;
        }

        return response.text();
      },
    );

    if (story === null) {
      continue;
    }

    if (json) {
      stream.push(comma + story);
      comma = ",";
    } else {
      stream.push(htmlify(story));
    }
    if (--max <= 0) break;
  }

  if (json) {
    stream.push("]");
  }

  stream.end();
}

/**
 * Streams HN articles.
 * @param {Number} max The maximum number of articles in a response
 * (i.e. the page size)
 * @param {'html'|'json'} output The output type, either HTML or JSON.
 * If JSON is requested, the stream is created in object mode.
 * @returns {stream.Readable} The stream with the results
 */
function hnLatestStream(max = 10, output = "html") {
  output = (output + "").toLowerCase();
  if (output !== "html" && output !== "json") {
    throw Error('output parameter must be "html" or "json"');
  }
  if (max <= 0) {
    throw Error("max parameter must be greater than 0");
  }
  const json = output === "json";
  const stream = PassThrough();

  hydrate(stream, max, json).catch((err) => {
    stream.emit("error", err);
  });
  return stream;
}

export default hnLatestStream;
