import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RichText } from "./rich-text";

const html = (text: string) => renderToStaticMarkup(<RichText text={text} />);

describe("RichText", () => {
  it("renders bold, paragraphs and line breaks", () => {
    expect(html("The **Sundarbans** tour.\nThree days.\n\nWant dates?")).toBe(
      '<div class="space-y-2"><p>The <strong>Sundarbans</strong> tour.<br/>Three days.</p><p>Want dates?</p></div>',
    );
  });

  it("renders bullet and numbered lists", () => {
    expect(html("- 3 days\n- From Khulna")).toContain("<ul");
    expect(html("- 3 days\n- From Khulna")).toContain("<li>From Khulna</li>");
    expect(html("1. Ask\n2. Pick")).toContain("<ol");
  });

  it("renders links that open in a new tab", () => {
    expect(html("See [the map](https://example.com/map).")).toContain(
      '<a href="https://example.com/map" target="_blank" rel="noopener noreferrer"',
    );
    expect(html("Go to https://example.com now")).toContain(">https://example.com</a> now");
  });

  it("escapes model text instead of rendering it as HTML", () => {
    expect(html('<img src=x onerror="alert(1)">')).not.toContain("<img");
    expect(html("[x](javascript:alert(1))")).not.toContain("href");
  });

  it("keeps a booking reference on one line", () => {
    expect(html("Your reference is TR-00003.")).toContain('<span class="whitespace-nowrap">TR-00003</span>');
  });
});
